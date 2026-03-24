import { Hono } from 'hono';
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
    businessSettings,
    invoiceItems,
    invoices,
    inventoryMovements,
    items,
    godownStock,
    godowns,
    parties,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    ensurePrimaryBusiness,
    getAccessibleBusiness,
    getActiveSubscription,
    getRequestedBusinessId,
    requireOrganizationAction,
    requireOrganizationCapability,
} from './helpers';
import {
    assertAllowedGstRate,
    assertBillCreationAllowed,
    assertFeatureFlag,
    assertModuleEnabled,
    assertSubscriptionWriteAllowed,
    bumpMonthlyBillUsage,
} from '../services/subscriptionPolicy';
import { withTransaction } from '../db/transaction';

const transactionsRoute = new Hono<AppEnv>();

const transactionItemSchema = z.object({
    id: z.string().optional(),
    godownId: z.string().optional(),
    name: z.string().trim().min(1),
    quantity: z.number().positive(),
    price: z.number().nonnegative(),
    tax: z.number().nonnegative().default(0),
    total: z.number().nonnegative().optional(),
});

const createTransactionSchema = z.object({
    id: z.string().trim().optional(),
    type: z.enum(['SALE', 'PURCHASE', 'RETURN_INWARD', 'RETURN_OUTWARD']).default('SALE'),
    documentKind: z.string().trim().optional(),
    invoiceType: z.enum([
        'TAX_INVOICE',
        'BILL_OF_SUPPLY',
        'ESTIMATE',
        'PROFORMA',
        'CREDIT_NOTE_DOC',
        'DEBIT_NOTE_DOC',
        'DELIVERY_CHALLAN_DOC',
        'POS_BILL',
    ]).optional(),
    partyId: z.string().optional(),
    partyName: z.string().trim().optional(),
    partyPhone: z.string().trim().optional(),
    billNumber: z.string().trim().optional(),
    billDate: z.coerce.date().optional(),
    businessName: z.string().trim().optional(),
    businessAddress: z.string().trim().optional(),
    gstNumber: z.string().trim().optional(),
    currency: z.string().trim().optional(),
    totalAmount: z.number().nonnegative(),
    discountAmount: z.number().nonnegative().optional(),
    taxAmount: z.number().nonnegative().optional(),
    paidAmount: z.number().nonnegative().optional(),
    paymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CARD', 'CREDIT']).optional(),
    paymentStatus: z.enum(['PAID', 'PARTIAL', 'PENDING']).optional(),
    billMode: z.enum(['GST', 'ESTIMATE']).optional(),
    affectsGst: z.boolean().optional(),
    placeOfSupply: z.string().trim().optional(),
    godownId: z.string().trim().optional(),
    reverseCharge: z.boolean().optional(),
    tcsAmount: z.number().nonnegative().optional(),
    tdsAmount: z.number().nonnegative().optional(),
    compositeScheme: z.boolean().optional(),
    eInvoiceIrn: z.string().trim().optional(),
    eInvoiceStatus: z.string().trim().optional(),
    eWayBillNumber: z.string().trim().optional(),
    dueDate: z.coerce.date().optional().nullable(),
    reminderEnabled: z.boolean().optional(),
    reminderFrequencyDays: z.number().int().positive().optional(),
    nextReminderAt: z.coerce.date().optional().nullable(),
    remark: z.string().trim().optional(),
    sourceVoucherId: z.string().trim().optional().nullable(),
    items: z.array(transactionItemSchema).min(1),
});

const patchPaymentSchema = z.object({
    paidAmount: z.number().nonnegative().optional(),
    paymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CARD', 'CREDIT']).optional(),
    paymentStatus: z.enum(['PAID', 'PARTIAL', 'PENDING']).optional(),
    date: z.coerce.date().optional(),
    reminderEnabled: z.boolean().optional(),
    reminderFrequencyDays: z.number().int().positive().optional(),
    nextReminderAt: z.coerce.date().optional().nullable(),
});

const complianceActionSchema = z.object({
    reason: z.string().trim().optional(),
});

const reminderRunSchema = z.object({
    limit: z.number().int().positive().max(500).optional(),
    dryRun: z.boolean().optional(),
});

const toCanonicalPaymentStatus = (status: 'PAID' | 'PARTIAL' | 'PENDING' | undefined) => {
    if (status === 'PAID') return 'PAID';
    if (status === 'PARTIAL') return 'PARTIALLY_PAID';
    return 'UNPAID';
};

const toLegacyPaymentStatus = (status: typeof invoices.$inferSelect['paymentStatus']) => {
    if (status === 'PAID') return 'PAID';
    if (status === 'PARTIALLY_PAID') return 'PARTIAL';
    return 'PENDING';
};

const asMetadataRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const deriveTransactionType = (entry: typeof invoices.$inferSelect) => {
    const metadata = asMetadataRecord(entry.gstRateBreakupJson);
    const rawType = typeof metadata.transactionType === 'string'
        ? metadata.transactionType.toUpperCase()
        : '';
    if (rawType === 'SALE' || rawType === 'PURCHASE' || rawType === 'RETURN_INWARD' || rawType === 'RETURN_OUTWARD') {
        return rawType;
    }
    if (entry.invoiceType === 'CREDIT_NOTE_DOC') return 'RETURN_OUTWARD';
    if (entry.invoiceType === 'DEBIT_NOTE_DOC') return 'RETURN_INWARD';
    return 'SALE';
};

const deriveDocumentKind = (entry: typeof invoices.$inferSelect) => {
    const metadata = asMetadataRecord(entry.gstRateBreakupJson);
    const documentKind = typeof metadata.documentKind === 'string'
        ? metadata.documentKind.trim().toUpperCase()
        : '';
    return documentKind || entry.invoiceType;
};

const resolveTypeDelta = (type: 'SALE' | 'PURCHASE' | 'RETURN_INWARD' | 'RETURN_OUTWARD') => {
    if (type === 'SALE' || type === 'RETURN_OUTWARD') return -1;
    return 1;
};

const generateInvoiceNumber = () => {
    const now = new Date();
    const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `INV-${prefix}-${nanoid(6).toUpperCase()}`;
};

const toInvoiceType = (
    billMode: 'GST' | 'ESTIMATE' | undefined,
    invoiceType?: 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'ESTIMATE' | 'PROFORMA' | 'CREDIT_NOTE_DOC' | 'DEBIT_NOTE_DOC' | 'DELIVERY_CHALLAN_DOC' | 'POS_BILL'
) => {
    if (invoiceType) return invoiceType;
    if (billMode === 'ESTIMATE') return 'ESTIMATE';
    return 'TAX_INVOICE';
};

const isNonPostingInvoiceType = (invoiceType: typeof invoices.$inferSelect['invoiceType']) =>
    invoiceType === 'ESTIMATE' || invoiceType === 'PROFORMA';

const isNonPostingPayload = (payload: z.infer<typeof createTransactionSchema>) =>
    payload.billMode === 'ESTIMATE'
    || payload.invoiceType === 'ESTIMATE'
    || payload.invoiceType === 'PROFORMA';

const asSettingsRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const asSettingBool = (value: unknown, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return fallback;
};

const asSettingNumber = (value: unknown, fallback = 0) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
};

const getTransportLineGodowns = (value: unknown): Record<string, string> => {
    const transport = asMetadataRecord(value);
    const raw = asMetadataRecord(transport.lineGodowns);
    return Object.entries(raw).reduce<Record<string, string>>((acc, [key, entry]) => {
        if (typeof entry === 'string' && entry.trim()) {
            acc[key] = entry.trim();
        }
        return acc;
    }, {});
};

const getTransportDefaultGodownId = (value: unknown): string | null => {
    const transport = asMetadataRecord(value);
    const raw = transport.defaultGodownId;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
};

const repairLegacyGodownPosting = async (params: {
    db: AppEnv['Variables']['db'];
    businessId: string;
    invoice: typeof invoices.$inferSelect;
    payload: z.infer<typeof createTransactionSchema>;
}) => {
    const { db, businessId, invoice, payload } = params;
    if (isNonPostingInvoiceType(invoice.invoiceType)) return;

    const existingLineGodowns = getTransportLineGodowns(invoice.transportDetails);
    if (Object.keys(existingLineGodowns).length > 0) return;

    const defaultGodownId = getTransportDefaultGodownId(invoice.transportDetails)
        ?? payload.godownId?.trim()
        ?? null;
    if (!defaultGodownId && !payload.items.some((entry) => entry.godownId?.trim())) {
        return;
    }

    const delta = resolveTypeDelta(deriveTransactionType(invoice));
    const now = new Date();

    await withTransaction(db, async (tx) => {
        const storedLines = await tx
            .select()
            .from(invoiceItems)
            .where(eq(invoiceItems.invoiceId, invoice.id))
            .orderBy(asc(invoiceItems.createdAt));
        if (storedLines.length === 0) return;

        const nextLineGodowns: Record<string, string> = {};
        for (const [index, line] of storedLines.entries()) {
            const requestedLine = payload.items[index];
            const postingGodownId = requestedLine?.godownId?.trim() || defaultGodownId;
            if (!postingGodownId) continue;
            nextLineGodowns[line.id] = postingGodownId;

            if (!line.itemId) continue;
            const quantity = Number(line.quantity ?? 0);
            await tx.insert(godownStock).values({
                id: `gstk_${nanoid(16)}`,
                businessId,
                godownId: postingGodownId,
                itemId: line.itemId,
                quantity: delta * quantity,
                createdAt: now,
                updatedAt: now,
            }).onConflictDoUpdate({
                target: [godownStock.godownId, godownStock.itemId],
                set: {
                    quantity: sql`${godownStock.quantity} + ${delta * quantity}`,
                    updatedAt: now,
                },
            });
        }

        await tx.update(invoices).set({
            transportDetails: {
                ...asMetadataRecord(invoice.transportDetails),
                defaultGodownId,
                lineGodowns: nextLineGodowns,
            },
            updatedAt: now,
        }).where(and(eq(invoices.id, invoice.id), eq(invoices.businessId, businessId)));
    });
};

transactionsRoute.use('/*', requireAuth);

transactionsRoute.get('/bill-number/check', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const billNumber = (c.req.query('billNumber') ?? '').trim();
    if (!billNumber) {
        return c.json({ ok: true, exists: false });
    }

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Business not found.' }, 404);
    }
    const denied = requireOrganizationCapability(c, 'billing.read');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'GST_INVOICES');
    assertModuleEnabled(business, 'billing');

    const rows = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.businessId, business.id), eq(invoices.invoiceNumber, billNumber)))
        .limit(1);

    return c.json({ ok: true, exists: Boolean(rows[0]) });
});

transactionsRoute.post('/', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await ensurePrimaryBusiness(db, authUser);
        const denied = requireOrganizationCapability(c, 'billing.write');
        if (denied) return denied;
        const deniedAction = requireOrganizationAction(c, 'billing.create');
        if (deniedAction) return deniedAction;
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'GST_INVOICES');
        assertModuleEnabled(business, 'billing');
        const payload = createTransactionSchema.parse(await c.req.json());
        if (payload.type === 'PURCHASE' || payload.type === 'RETURN_INWARD') {
            assertFeatureFlag(subscription, 'PURCHASE_MODULE');
        }
        const now = new Date();
        const requestedGodownIds = Array.from(new Set([
            payload.godownId?.trim(),
            ...payload.items.map((entry) => entry.godownId?.trim()),
        ].filter((entry): entry is string => Boolean(entry))));
        const godownRows = requestedGodownIds.length > 0
            ? await db.select().from(godowns).where(and(
                eq(godowns.businessId, business.id),
                inArray(godowns.id, requestedGodownIds),
                eq(godowns.isActive, true),
            ))
            : [];
        const godownById = new Map(godownRows.map((entry) => [entry.id, entry]));
        if (godownRows.length !== requestedGodownIds.length) {
            return c.json({ ok: false, message: 'One or more selected godowns are invalid.' }, 400);
        }
        const defaultGodownId = payload.godownId?.trim() || null;
        const requestedItemIds = Array.from(new Set(
            payload.items
                .map((entry) => entry.id?.trim())
                .filter((entry): entry is string => Boolean(entry))
        ));
        const itemRows = requestedItemIds.length > 0
            ? await db.select().from(items).where(and(
                eq(items.businessId, business.id),
                inArray(items.id, requestedItemIds),
            ))
            : [];
        if (itemRows.length !== requestedItemIds.length) {
            return c.json({ ok: false, message: 'One or more selected items are invalid.' }, 400);
        }
        const itemStockById = new Map(itemRows.map((entry) => [entry.id, Number(entry.stock ?? 0)]));

        const requestedInvoiceId = payload.id?.trim();
        if (requestedInvoiceId) {
            const existingRows = await db
                .select()
                .from(invoices)
                .where(and(
                    eq(invoices.id, requestedInvoiceId),
                    eq(invoices.businessId, business.id),
                    eq(invoices.isDeleted, false),
                ))
                .limit(1);
            const existingInvoice = existingRows[0];
            if (existingInvoice) {
                await repairLegacyGodownPosting({
                    db,
                    businessId: business.id,
                    invoice: existingInvoice,
                    payload,
                });
                return c.json({ ok: true, id: existingInvoice.id, idempotent: true });
            }
        }

        await assertBillCreationAllowed(db, business.id, subscription, payload.billDate);

        const invoiceId = payload.id?.trim() || `inv_${nanoid(18)}`;
        const invoiceNumber = payload.billNumber?.trim() || generateInvoiceNumber();
        const billDate = payload.billDate ?? now;
        const placeOfSupply = payload.placeOfSupply?.trim() || business.state || null;
        const businessState = business.state?.trim().toLowerCase();
        const supplyState = placeOfSupply?.trim().toLowerCase() ?? null;
        const isInterStateSupply = Boolean(businessState && supplyState && businessState !== supplyState);

        const settingsRows = await db
            .select()
            .from(businessSettings)
            .where(and(
                eq(businessSettings.businessId, business.id),
                inArray(businessSettings.section, ['TAXES_AND_GST']),
            ));
        const settingsBySection = new Map(settingsRows.map((entry) => [entry.section, asSettingsRecord(entry.dataJson)]));
        const taxSettings = settingsBySection.get('TAXES_AND_GST') ?? {};

        const tcsEnabled = asSettingBool(taxSettings.tcs_enabled, false);
        const tdsEnabled = asSettingBool(taxSettings.tds_enabled, false);
        const compositeEnabled = asSettingBool(taxSettings.composite_scheme_enabled, false);

        const tcsAmount = tcsEnabled ? asSettingNumber(payload.tcsAmount, 0) : 0;
        const tdsAmount = tdsEnabled ? asSettingNumber(payload.tdsAmount, 0) : 0;
        const totalTaxAmount = Number(payload.taxAmount ?? 0);
        const totalInvoiceValue = Number(payload.totalAmount ?? 0) + tcsAmount - tdsAmount;
        const isNonPostingDoc = isNonPostingPayload(payload);
        const complianceMeta: Record<string, unknown> = {
            transactionType: payload.type,
            documentKind: payload.documentKind ?? payload.invoiceType ?? payload.type,
            tcsEnabled,
            tcsAmount,
            tdsEnabled,
            tdsAmount,
            defaultGodownId,
            paymentMode: payload.paymentMode ?? 'CASH',
            reverseCharge: Boolean(payload.reverseCharge ?? false),
            compositeSchemeEnabled: compositeEnabled || Boolean(payload.compositeScheme ?? false),
        };
        const transportDetails: Record<string, unknown> = {
            defaultGodownId,
            lineGodowns: {},
        };

        const delta = resolveTypeDelta(payload.type);
        const lineGodowns: Record<string, string> = {};
        await withTransaction(db, async (tx) => {
            let partyId = payload.partyId ?? null;
            if (!partyId && payload.partyName) {
                const newPartyId = `pty_${nanoid(16)}`;
                await tx.insert(parties).values({
                    id: newPartyId,
                    businessId: business.id,
                    type: payload.type === 'PURCHASE' ? 'SUPPLIER' : 'CUSTOMER',
                    name: payload.partyName,
                    nameLowercase: payload.partyName.toLowerCase(),
                    phone: payload.partyPhone ?? null,
                    email: null,
                    billingAddress: null,
                    shippingAddress: null,
                    gstin: null,
                    openingBalance: 0,
                    creditLimit: 0,
                    isActive: true,
                    createdAt: now,
                    updatedAt: now,
                });
                partyId = newPartyId;
            }

            await tx.insert(invoices).values({
                id: invoiceId,
                businessId: business.id,
                invoiceType: toInvoiceType(payload.billMode, payload.invoiceType as 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'ESTIMATE' | 'PROFORMA' | 'CREDIT_NOTE_DOC' | 'DEBIT_NOTE_DOC' | 'DELIVERY_CHALLAN_DOC' | 'POS_BILL' | undefined),
                invoiceNumber,
                invoiceDate: billDate,
                partyId,
                placeOfSupply,
                totalTaxableValue: Number(payload.totalAmount ?? 0) - totalTaxAmount,
                totalTaxAmount,
                totalInvoiceValue,
                discountAmount: payload.discountAmount ?? 0,
                roundOffAmount: 0,
                additionalCharges: 0,
                reverseCharge: payload.reverseCharge ?? false,
                gstRateBreakupJson: complianceMeta,
                eInvoiceIrn: payload.eInvoiceIrn ?? null,
                eInvoiceStatus: payload.eInvoiceStatus ?? null,
                eWayBillNumber: payload.eWayBillNumber ?? null,
                paymentStatus: toCanonicalPaymentStatus(payload.paymentStatus),
                paidAmount: payload.paidAmount ?? 0,
                dueDate: payload.dueDate ?? null,
                notes: payload.remark ?? null,
                sourceVoucherId: payload.sourceVoucherId ?? null,
                transportDetails,
                isDeleted: false,
                createdByUserId: authUser.id,
                createdAt: now,
                updatedAt: now,
            });

            for (const entry of payload.items) {
                assertAllowedGstRate(entry.tax);
                const lineTaxableValue = entry.price * entry.quantity;
                const lineTaxAmount = lineTaxableValue * (entry.tax / 100);
                const cgstRate = isInterStateSupply ? 0 : (entry.tax > 0 ? entry.tax / 2 : 0);
                const sgstRate = isInterStateSupply ? 0 : (entry.tax > 0 ? entry.tax / 2 : 0);
                const igstRate = isInterStateSupply ? entry.tax : 0;
                const cgstAmount = isInterStateSupply ? 0 : lineTaxAmount / 2;
                const sgstAmount = isInterStateSupply ? 0 : lineTaxAmount / 2;
                const igstAmount = isInterStateSupply ? lineTaxAmount : 0;
                const lineItemId = `invi_${nanoid(16)}`;
                const postingGodownId = entry.godownId?.trim() || defaultGodownId;

                await tx.insert(invoiceItems).values({
                    id: lineItemId,
                    invoiceId,
                    itemId: entry.id ?? null,
                    description: entry.name,
                    quantity: entry.quantity,
                    unit: 'pcs',
                    rate: entry.price,
                    discountPercent: 0,
                    taxableValue: lineTaxableValue,
                    cgstRate,
                    cgstAmount,
                    sgstRate,
                    sgstAmount,
                    igstRate,
                    igstAmount,
                    cessRate: 0,
                    cessAmount: 0,
                });
                if (postingGodownId) {
                    lineGodowns[lineItemId] = postingGodownId;
                }

                if (!entry.id || isNonPostingDoc) continue;

                const currentStock = itemStockById.get(entry.id) ?? 0;
                const nextStock = currentStock + (delta * entry.quantity);
                itemStockById.set(entry.id, nextStock);

                await tx.update(items).set({
                    stock: nextStock,
                    updatedAt: now,
                }).where(and(eq(items.id, entry.id), eq(items.businessId, business.id)));

                await tx.insert(inventoryMovements).values({
                    id: `mov_${nanoid(16)}`,
                    businessId: business.id,
                    itemId: entry.id,
                    movementType: delta >= 0 ? 'IN' : 'OUT',
                    quantity: entry.quantity,
                    balanceAfter: nextStock,
                    reason: payload.type,
                    referenceId: invoiceId,
                    createdByUserId: authUser.id,
                    createdAt: now,
                });

                if (postingGodownId && godownById.has(postingGodownId)) {
                    await tx.insert(godownStock).values({
                        id: `gstk_${nanoid(16)}`,
                        businessId: business.id,
                        godownId: postingGodownId,
                        itemId: entry.id,
                        quantity: delta * entry.quantity,
                        createdAt: now,
                        updatedAt: now,
                    }).onConflictDoUpdate({
                        target: [godownStock.godownId, godownStock.itemId],
                        set: {
                            quantity: sql`${godownStock.quantity} + ${delta * entry.quantity}`,
                            updatedAt: now,
                        },
                    });
                }
            }

            await tx.update(invoices).set({
                transportDetails: {
                    defaultGodownId,
                    lineGodowns,
                },
                updatedAt: now,
            }).where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, business.id)));

            await bumpMonthlyBillUsage(tx, business.id, subscription, billDate);
        });

        return c.json({ ok: true, id: invoiceId });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create transaction.' }, 400);
    }
});

transactionsRoute.get('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Business not found.' }, 404);
    }
    const denied = requireOrganizationCapability(c, 'billing.read');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'GST_INVOICES');
    assertModuleEnabled(business, 'billing');

    const limit = Math.min(Number(c.req.query('limit') ?? 200), 1000);
    const start = c.req.query('start') ?? c.req.query('from');
    const end = c.req.query('end') ?? c.req.query('to');
    const includeDeleted = (c.req.query('includeDeleted') ?? '').trim().toLowerCase() === 'true';
    const typeQuery = (c.req.query('type') ?? '').trim().toUpperCase();
    const statusQuery = (c.req.query('status') ?? '').trim().toUpperCase();
    const partyIdQuery = (c.req.query('partyId') ?? '').trim();

    const whereFilters = [eq(invoices.businessId, business.id)];
    if (!includeDeleted) whereFilters.push(eq(invoices.isDeleted, false));
    if (start) whereFilters.push(gte(invoices.invoiceDate, new Date(start)));
    if (end) whereFilters.push(lte(invoices.invoiceDate, new Date(end)));
    if (partyIdQuery) whereFilters.push(eq(invoices.partyId, partyIdQuery));

    const invoiceRows = await db
        .select()
        .from(invoices)
        .where(and(...whereFilters))
        .orderBy(desc(invoices.invoiceDate))
        .limit(limit);

    if (invoiceRows.length === 0) {
        return c.json({ ok: true, transactions: [] });
    }

    const invoiceIds = invoiceRows.map((entry) => entry.id);
    const lines = await db
        .select()
        .from(invoiceItems)
        .where(inArray(invoiceItems.invoiceId, invoiceIds))
        .orderBy(asc(invoiceItems.createdAt));

    const partyIds = Array.from(new Set(invoiceRows.map((entry) => entry.partyId).filter(Boolean))) as string[];
    const partyRows = partyIds.length > 0
        ? await db.select().from(parties).where(inArray(parties.id, partyIds))
        : [];
    const partyById = new Map(partyRows.map((entry) => [entry.id, entry]));

    const linesByInvoiceId = new Map<string, typeof lines>();
    for (const line of lines) {
        const bucket = linesByInvoiceId.get(line.invoiceId) ?? [];
        bucket.push(line);
        linesByInvoiceId.set(line.invoiceId, bucket);
    }

    const transactions = invoiceRows.map((entry) => {
        const party = entry.partyId ? partyById.get(entry.partyId) : null;
        const metadata = asMetadataRecord(entry.gstRateBreakupJson);
        const transportDetails = asMetadataRecord(entry.transportDetails);
        const lineGodowns = asMetadataRecord(transportDetails.lineGodowns);
        const defaultGodownId = typeof transportDetails.defaultGodownId === 'string'
            ? transportDetails.defaultGodownId
            : null;
        const transactionType = deriveTransactionType(entry);
        const documentKind = deriveDocumentKind(entry);
        const mappedLines = (linesByInvoiceId.get(entry.id) ?? []).map((line) => ({
            id: line.itemId ?? `line_${line.id}`,
            godownId: typeof lineGodowns[line.id] === 'string' ? String(lineGodowns[line.id]) : defaultGodownId,
            name: line.description,
            quantity: Number(line.quantity ?? 0),
            price: Number(line.rate ?? 0),
            tax: Number((line.cgstRate ?? 0) + (line.sgstRate ?? 0) + (line.igstRate ?? 0)),
            total: Number((line.taxableValue ?? 0) + (line.cgstAmount ?? 0) + (line.sgstAmount ?? 0) + (line.igstAmount ?? 0) + (line.cessAmount ?? 0)),
        }));

        return {
            id: entry.id,
            userId: authUser.id,
            type: transactionType,
            invoiceType: entry.invoiceType,
            documentKind,
            partyId: entry.partyId,
            partyName: party?.name,
            partyPhone: party?.phone,
            billNumber: entry.invoiceNumber,
            billDate: entry.invoiceDate,
            items: mappedLines,
            totalAmount: Number(entry.totalInvoiceValue ?? 0),
            discountAmount: 0,
            taxAmount: Number(entry.totalTaxAmount ?? 0),
            paidAmount: Number(entry.paidAmount ?? 0),
            paymentStatus: toLegacyPaymentStatus(entry.paymentStatus),
            billMode: entry.invoiceType === 'ESTIMATE' ? 'ESTIMATE' : 'GST',
            affectsGst: entry.invoiceType !== 'ESTIMATE',
            dueDate: entry.dueDate,
            reminderEnabled: Boolean(entry.dueDate && entry.paymentStatus !== 'PAID'),
            reminderFrequencyDays: 3,
            nextReminderAt: entry.dueDate,
            lastReminderAt: null,
            billingAddress: business.address,
            currency: business.currency ?? 'INR',
            remark: entry.notes,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            businessName: business.name,
            businessAddress: business.address,
            gstNumber: business.gstin,
            placeOfSupply: entry.placeOfSupply,
            godownId: defaultGodownId,
            reverseCharge: Boolean(entry.reverseCharge),
            tcsAmount: Number(metadata.tcsAmount ?? 0),
            tdsAmount: Number(metadata.tdsAmount ?? 0),
            compositeScheme: Boolean(metadata.compositeSchemeEnabled ?? false),
            paymentMode: typeof metadata.paymentMode === 'string' ? metadata.paymentMode : 'CASH',
            paymentDate: typeof metadata.paymentDate === 'string' ? metadata.paymentDate : null,
        };
    });
    const filtered = transactions.filter((entry) => {
        if (typeQuery) {
            if (typeQuery === 'PURCHASE_BILL' && entry.type !== 'PURCHASE') return false;
            else if (typeQuery !== 'PURCHASE_BILL') {
                const normalizedInvoiceType = String(entry.invoiceType ?? '').toUpperCase();
                const normalizedDocKind = String(entry.documentKind ?? '').toUpperCase();
                const normalizedTxnType = String(entry.type ?? '').toUpperCase();
                if (typeQuery !== normalizedInvoiceType && typeQuery !== normalizedDocKind && typeQuery !== normalizedTxnType) {
                    return false;
                }
            }
        }

        if (statusQuery) {
            const normalizedStatus = String(entry.paymentStatus ?? '').toUpperCase();
            if (statusQuery !== normalizedStatus) return false;
        }

        return true;
    });

    return c.json({ ok: true, transactions: filtered });
});

transactionsRoute.get('/pending-reminders', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Business not found.' }, 404);
    }
    const denied = requireOrganizationCapability(c, 'billing.read');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'GST_INVOICES');
    assertModuleEnabled(business, 'billing');

    const dueBeforeRaw = c.req.query('dueBefore');
    const dueBefore = dueBeforeRaw ? new Date(dueBeforeRaw) : new Date();

    const rows = await db
        .select()
        .from(invoices)
        .where(and(
            eq(invoices.businessId, business.id),
            ne(invoices.paymentStatus, 'PAID'),
            lte(invoices.dueDate, dueBefore),
        ))
        .orderBy(asc(invoices.dueDate));

    return c.json({
        ok: true,
        reminders: rows.map((entry) => ({
            id: entry.id,
            billNumber: entry.invoiceNumber,
            dueDate: entry.dueDate,
            totalAmount: entry.totalInvoiceValue,
            paidAmount: entry.paidAmount,
            paymentStatus: toLegacyPaymentStatus(entry.paymentStatus),
        })),
    });
});

transactionsRoute.get('/reminders/config', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'billing.read');
    if (denied) return denied;

    return c.json({
        ok: true,
        config: {
            autoSchedulerEnabled: false,
            scheduleHour: null,
            deliveryChannel: 'IN_APP',
            notificationOnly: true,
        },
    });
});

transactionsRoute.post('/reminders/run', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const denied = requireOrganizationCapability(c, 'billing.write');
        if (denied) return denied;
        const deniedAction = requireOrganizationAction(c, 'billing.update');
        if (deniedAction) return deniedAction;
        const payload = reminderRunSchema.parse(await c.req.json().catch(() => ({})));

        return c.json({
            ok: true,
            processed: 0,
            queued: 0,
            skipped: 0,
            dryRun: Boolean(payload.dryRun),
            reason: 'REMINDERS_DISABLED_NOTIFICATION_ONLY',
        });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to run reminder scheduler.' }, 400);
    }
});

transactionsRoute.delete('/:id', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const denied = requireOrganizationCapability(c, 'billing.write');
        if (denied) return denied;
        const deniedAction = requireOrganizationAction(c, 'billing.delete');
        if (deniedAction) return deniedAction;
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'GST_INVOICES');
        assertModuleEnabled(business, 'billing');

        const id = c.req.param('id');
        const invoiceRows = await db
            .select()
            .from(invoices)
            .where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)))
            .limit(1);
        const invoice = invoiceRows[0];
        if (!invoice) return c.json({ ok: false, message: 'Transaction not found.' }, 404);
        if (invoice.isDeleted) return c.json({ ok: false, message: 'Transaction already deleted.' }, 400);

        const transactionType = deriveTransactionType(invoice);
        const isNonPostingDoc = isNonPostingInvoiceType(invoice.invoiceType);
        const now = new Date();
        const transportDetails = asMetadataRecord(invoice.transportDetails);
        const lineGodowns = getTransportLineGodowns(transportDetails);
        const defaultGodownId = getTransportDefaultGodownId(transportDetails);

        await db.transaction(async (tx) => {
            if (!isNonPostingDoc) {
                const lines = await tx
                    .select()
                    .from(invoiceItems)
                    .where(eq(invoiceItems.invoiceId, id));
                const delta = resolveTypeDelta(transactionType);
                for (const line of lines) {
                    if (!line.itemId) continue;
                    const itemRows = await tx
                        .select()
                        .from(items)
                        .where(and(eq(items.id, line.itemId), eq(items.businessId, business.id)))
                        .limit(1);
                    const item = itemRows[0];
                    if (!item) continue;
                    const quantity = Number(line.quantity ?? 0);
                    const currentStock = Number(item.stock ?? 0);
                    const nextStock = currentStock - (delta * quantity);

                    await tx
                        .update(items)
                        .set({ stock: nextStock, updatedAt: now })
                        .where(and(eq(items.id, line.itemId), eq(items.businessId, business.id)));

                    await tx.insert(inventoryMovements).values({
                        id: `mov_${nanoid(16)}`,
                        businessId: business.id,
                        itemId: line.itemId,
                        movementType: delta >= 0 ? 'OUT' : 'IN',
                        quantity,
                        balanceAfter: nextStock,
                        reason: `DELETE_${transactionType}`,
                        referenceId: id,
                        createdByUserId: authUser.id,
                        createdAt: now,
                    });

                    const postingGodownId = typeof lineGodowns[line.id] === 'string'
                        ? lineGodowns[line.id]
                        : defaultGodownId;
                    if (postingGodownId) {
                        const adjustment = -(delta * quantity);
                        await tx.insert(godownStock).values({
                            id: `gstk_${nanoid(16)}`,
                            businessId: business.id,
                            godownId: postingGodownId,
                            itemId: line.itemId,
                            quantity: adjustment,
                            createdAt: now,
                            updatedAt: now,
                        }).onConflictDoUpdate({
                            target: [godownStock.godownId, godownStock.itemId],
                            set: {
                                quantity: sql`${godownStock.quantity} + ${adjustment}`,
                                updatedAt: now,
                            },
                        });
                    }
                }
            }

            await tx
                .update(invoices)
                .set({ isDeleted: true, updatedAt: now })
                .where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)));
        });

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete transaction.' }, 400);
    }
});

transactionsRoute.get('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Business not found.' }, 404);
    }
    const denied = requireOrganizationCapability(c, 'billing.read');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'GST_INVOICES');
    assertModuleEnabled(business, 'billing');

    const id = c.req.param('id');
    const rows = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.businessId, business.id), eq(invoices.isDeleted, false)))
        .limit(1);

    if (!rows[0]) {
        return c.json({ ok: false, message: 'Transaction not found.' }, 404);
    }

    const lines = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id));
    const metadata = asMetadataRecord(rows[0].gstRateBreakupJson);
    const transportDetails = asMetadataRecord(rows[0].transportDetails);
    const lineGodowns = asMetadataRecord(transportDetails.lineGodowns);
    const defaultGodownId = typeof transportDetails.defaultGodownId === 'string'
        ? transportDetails.defaultGodownId
        : null;

    return c.json({
        ok: true,
        transaction: {
            id: rows[0].id,
            userId: authUser.id,
            type: deriveTransactionType(rows[0]),
            invoiceType: rows[0].invoiceType,
            documentKind: deriveDocumentKind(rows[0]),
            billNumber: rows[0].invoiceNumber,
            billDate: rows[0].invoiceDate,
            totalAmount: Number(rows[0].totalInvoiceValue ?? 0),
            taxAmount: Number(rows[0].totalTaxAmount ?? 0),
            paidAmount: Number(rows[0].paidAmount ?? 0),
            paymentMode: typeof metadata.paymentMode === 'string' ? metadata.paymentMode : 'CASH',
            paymentDate: typeof metadata.paymentDate === 'string' ? metadata.paymentDate : null,
            paymentStatus: toLegacyPaymentStatus(rows[0].paymentStatus),
            placeOfSupply: rows[0].placeOfSupply,
            godownId: defaultGodownId,
            reverseCharge: Boolean(rows[0].reverseCharge),
            items: lines.map((line) => ({
                id: line.itemId ?? `line_${line.id}`,
                godownId: typeof lineGodowns[line.id] === 'string' ? String(lineGodowns[line.id]) : defaultGodownId,
                name: line.description,
                quantity: Number(line.quantity ?? 0),
                price: Number(line.rate ?? 0),
                tax: Number((line.cgstRate ?? 0) + (line.sgstRate ?? 0) + (line.igstRate ?? 0)),
                total: Number((line.taxableValue ?? 0) + (line.cgstAmount ?? 0) + (line.sgstAmount ?? 0) + (line.igstAmount ?? 0) + (line.cessAmount ?? 0)),
            })),
        },
    });
});

transactionsRoute.patch('/:id/payment', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) {
            return c.json({ ok: false, message: 'Business not found.' }, 404);
        }
        const denied = requireOrganizationCapability(c, 'billing.write');
        if (denied) return denied;
        const deniedAction = requireOrganizationAction(c, 'billing.update');
        if (deniedAction) return deniedAction;
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'GST_INVOICES');
        assertModuleEnabled(business, 'billing');

        const id = c.req.param('id');
        const payload = patchPaymentSchema.parse(await c.req.json());

        const currentRows = await db
            .select()
            .from(invoices)
            .where(and(eq(invoices.id, id), eq(invoices.businessId, business.id), eq(invoices.isDeleted, false)))
            .limit(1);

        const current = currentRows[0];
        if (!current) {
            return c.json({ ok: false, message: 'Transaction not found.' }, 404);
        }

        const nextPaid = payload.paidAmount ?? Number(current.paidAmount ?? 0);
        const total = Number(current.totalInvoiceValue ?? 0);

        let status = payload.paymentStatus;
        if (!status) {
            if (nextPaid >= total) status = 'PAID';
            else if (nextPaid > 0) status = 'PARTIAL';
            else status = 'PENDING';
        }
        const nextMetadata = {
            ...asMetadataRecord(current.gstRateBreakupJson),
            ...(payload.paymentMode ? { paymentMode: payload.paymentMode } : {}),
            ...(payload.date ? { paymentDate: payload.date.toISOString() } : {}),
        };

        await db.update(invoices).set({
            paidAmount: nextPaid,
            paymentStatus: toCanonicalPaymentStatus(status),
            dueDate: payload.nextReminderAt ?? current.dueDate,
            gstRateBreakupJson: nextMetadata,
            updatedAt: new Date(),
        }).where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)));

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update payment.' }, 400);
    }
});

transactionsRoute.post('/:id/e-invoice/generate', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const denied = requireOrganizationCapability(c, 'billing.write');
        if (denied) return denied;
        const deniedAction = requireOrganizationAction(c, 'billing.update');
        if (deniedAction) return deniedAction;
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'E_INVOICE');
        assertModuleEnabled(business, 'billing');

        const id = c.req.param('id');
        const rows = await db.select().from(invoices).where(and(
            eq(invoices.id, id),
            eq(invoices.businessId, business.id),
            eq(invoices.isDeleted, false),
        )).limit(1);
        const invoice = rows[0];
        if (!invoice) return c.json({ ok: false, message: 'Invoice not found.' }, 404);

        const irn = invoice.eInvoiceIrn ?? `IRN${new Date().getUTCFullYear()}${nanoid(18).toUpperCase()}`;
        await db.update(invoices).set({
            eInvoiceIrn: irn,
            eInvoiceStatus: 'GENERATED',
            updatedAt: new Date(),
        }).where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)));

        return c.json({
            ok: true,
            eInvoiceIrn: irn,
            eInvoiceStatus: 'GENERATED',
            provider: 'SIMULATED_GSP',
            ackNo: `ACK-${nanoid(10).toUpperCase()}`,
            validatedAt: new Date().toISOString(),
        });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to generate e-invoice.' }, 400);
    }
});

transactionsRoute.post('/:id/e-invoice/cancel', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const denied = requireOrganizationCapability(c, 'billing.write');
        if (denied) return denied;
        const deniedAction = requireOrganizationAction(c, 'billing.update');
        if (deniedAction) return deniedAction;
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'E_INVOICE');
        assertModuleEnabled(business, 'billing');

        complianceActionSchema.parse(await c.req.json().catch(() => ({})));
        const id = c.req.param('id');
        const rows = await db.select().from(invoices).where(and(
            eq(invoices.id, id),
            eq(invoices.businessId, business.id),
            eq(invoices.isDeleted, false),
        )).limit(1);
        if (!rows[0]) return c.json({ ok: false, message: 'Invoice not found.' }, 404);
        await db.update(invoices).set({
            eInvoiceStatus: 'CANCELLED',
            updatedAt: new Date(),
        }).where(and(
            eq(invoices.id, id),
            eq(invoices.businessId, business.id),
            eq(invoices.isDeleted, false),
        ));

        return c.json({
            ok: true,
            eInvoiceStatus: 'CANCELLED',
            provider: 'SIMULATED_GSP',
            cancelledAt: new Date().toISOString(),
        });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to cancel e-invoice.' }, 400);
    }
});

transactionsRoute.get('/:id/e-invoice/status', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'billing.read');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'E_INVOICE');
    assertModuleEnabled(business, 'billing');

    const id = c.req.param('id');
    const rows = await db.select().from(invoices).where(and(
        eq(invoices.id, id),
        eq(invoices.businessId, business.id),
        eq(invoices.isDeleted, false),
    )).limit(1);
    const invoice = rows[0];
    if (!invoice) return c.json({ ok: false, message: 'Invoice not found.' }, 404);

    return c.json({
        ok: true,
        status: {
            invoiceId: invoice.id,
            eInvoiceIrn: invoice.eInvoiceIrn,
            eInvoiceStatus: invoice.eInvoiceStatus ?? 'NOT_GENERATED',
            provider: 'SIMULATED_GSP',
            lastCheckedAt: new Date().toISOString(),
        },
    });
});

transactionsRoute.post('/:id/e-way-bill/generate', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const denied = requireOrganizationCapability(c, 'billing.write');
        if (denied) return denied;
        const deniedAction = requireOrganizationAction(c, 'billing.update');
        if (deniedAction) return deniedAction;
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'E_WAY_BILL');
        assertModuleEnabled(business, 'billing');

        const id = c.req.param('id');
        const rows = await db.select().from(invoices).where(and(
            eq(invoices.id, id),
            eq(invoices.businessId, business.id),
            eq(invoices.isDeleted, false),
        )).limit(1);
        const invoice = rows[0];
        if (!invoice) return c.json({ ok: false, message: 'Invoice not found.' }, 404);

        const eWayBillNumber = invoice.eWayBillNumber ?? `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        await db.update(invoices).set({
            eWayBillNumber,
            updatedAt: new Date(),
        }).where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)));

        return c.json({
            ok: true,
            eWayBillNumber,
            provider: 'SIMULATED_GSP',
            generatedAt: new Date().toISOString(),
        });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to generate e-way bill.' }, 400);
    }
});

transactionsRoute.post('/:id/e-way-bill/cancel', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const denied = requireOrganizationCapability(c, 'billing.write');
        if (denied) return denied;
        const deniedAction = requireOrganizationAction(c, 'billing.update');
        if (deniedAction) return deniedAction;
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'E_WAY_BILL');
        assertModuleEnabled(business, 'billing');

        complianceActionSchema.parse(await c.req.json().catch(() => ({})));
        const id = c.req.param('id');
        const rows = await db.select().from(invoices).where(and(
            eq(invoices.id, id),
            eq(invoices.businessId, business.id),
            eq(invoices.isDeleted, false),
        )).limit(1);
        if (!rows[0]) return c.json({ ok: false, message: 'Invoice not found.' }, 404);
        await db.update(invoices).set({
            eWayBillNumber: null,
            updatedAt: new Date(),
        }).where(and(
            eq(invoices.id, id),
            eq(invoices.businessId, business.id),
            eq(invoices.isDeleted, false),
        ));

        return c.json({ ok: true, cancelledAt: new Date().toISOString() });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to cancel e-way bill.' }, 400);
    }
});

transactionsRoute.get('/:id/e-way-bill/status', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'billing.read');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'E_WAY_BILL');
    assertModuleEnabled(business, 'billing');

    const id = c.req.param('id');
    const rows = await db.select().from(invoices).where(and(
        eq(invoices.id, id),
        eq(invoices.businessId, business.id),
        eq(invoices.isDeleted, false),
    )).limit(1);
    const invoice = rows[0];
    if (!invoice) return c.json({ ok: false, message: 'Invoice not found.' }, 404);

    return c.json({
        ok: true,
        status: {
            invoiceId: invoice.id,
            eWayBillNumber: invoice.eWayBillNumber,
            eWayBillStatus: invoice.eWayBillNumber ? 'GENERATED' : 'NOT_GENERATED',
            provider: 'SIMULATED_GSP',
            lastCheckedAt: new Date().toISOString(),
        },
    });
});

export default transactionsRoute;
