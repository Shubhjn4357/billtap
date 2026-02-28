import { Hono } from 'hono';
import { and, asc, desc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
    invoiceItems,
    invoices,
    inventoryMovements,
    items,
    parties,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { ensurePrimaryBusiness, getAccessibleBusiness, getActiveSubscription, getRequestedBusinessId } from './helpers';
import {
    assertAllowedGstRate,
    assertBillCreationAllowed,
    assertFeatureFlag,
    assertModuleEnabled,
    assertSubscriptionWriteAllowed,
    bumpMonthlyBillUsage,
} from '../services/subscriptionPolicy';

const transactionsRoute = new Hono<AppEnv>();

const transactionItemSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1),
    quantity: z.number().positive(),
    price: z.number().nonnegative(),
    tax: z.number().nonnegative().default(0),
    total: z.number().nonnegative().optional(),
});

const createTransactionSchema = z.object({
    type: z.enum(['SALE', 'PURCHASE', 'RETURN_INWARD', 'RETURN_OUTWARD']).default('SALE'),
    invoiceType: z.enum([
        'TAX_INVOICE',
        'BILL_OF_SUPPLY',
        'ESTIMATE',
        'PROFORMA',
        'CREDIT_NOTE_DOC',
        'DEBIT_NOTE_DOC',
        'DELIVERY_CHALLAN',
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
    reverseCharge: z.boolean().optional(),
    eInvoiceIrn: z.string().trim().optional(),
    eInvoiceStatus: z.string().trim().optional(),
    eWayBillNumber: z.string().trim().optional(),
    dueDate: z.coerce.date().optional().nullable(),
    reminderEnabled: z.boolean().optional(),
    reminderFrequencyDays: z.number().int().positive().optional(),
    nextReminderAt: z.coerce.date().optional().nullable(),
    remark: z.string().trim().optional(),
    items: z.array(transactionItemSchema).min(1),
});

const patchPaymentSchema = z.object({
    paidAmount: z.number().nonnegative().optional(),
    paymentStatus: z.enum(['PAID', 'PARTIAL', 'PENDING']).optional(),
    reminderEnabled: z.boolean().optional(),
    reminderFrequencyDays: z.number().int().positive().optional(),
    nextReminderAt: z.coerce.date().optional().nullable(),
});

const complianceActionSchema = z.object({
    reason: z.string().trim().optional(),
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
    invoiceType?: 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'ESTIMATE' | 'PROFORMA' | 'CREDIT_NOTE_DOC' | 'DEBIT_NOTE_DOC' | 'DELIVERY_CHALLAN'
) => {
    if (invoiceType) return invoiceType;
    if (billMode === 'ESTIMATE') return 'ESTIMATE';
    return 'TAX_INVOICE';
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
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'GST_INVOICES');
        assertModuleEnabled(business, 'billing');
        const payload = createTransactionSchema.parse(await c.req.json());
        if (payload.type === 'PURCHASE' || payload.type === 'RETURN_INWARD') {
            assertFeatureFlag(subscription, 'PURCHASE_MODULE');
        }
        await assertBillCreationAllowed(db, business.id, subscription, payload.billDate);
        const now = new Date();

        let partyId = payload.partyId ?? null;
        if (!partyId && payload.partyName) {
            const newPartyId = `pty_${nanoid(16)}`;
            await db.insert(parties).values({
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

        const invoiceId = `inv_${nanoid(18)}`;
        const invoiceNumber = payload.billNumber?.trim() || generateInvoiceNumber();
        const billDate = payload.billDate ?? now;
        const placeOfSupply = payload.placeOfSupply?.trim() || business.state || null;
        const businessState = business.state?.trim().toLowerCase();
        const supplyState = placeOfSupply?.trim().toLowerCase() ?? null;
        const isInterStateSupply = Boolean(businessState && supplyState && businessState !== supplyState);

        await db.insert(invoices).values({
            id: invoiceId,
            businessId: business.id,
            invoiceType: toInvoiceType(payload.billMode, payload.invoiceType),
            invoiceNumber,
            invoiceDate: billDate,
            partyId,
            placeOfSupply,
            totalTaxableValue: payload.totalAmount - (payload.taxAmount ?? 0),
            totalTaxAmount: payload.taxAmount ?? 0,
            totalInvoiceValue: payload.totalAmount,
            reverseCharge: payload.reverseCharge ?? false,
            gstRateBreakupJson: {},
            eInvoiceIrn: payload.eInvoiceIrn ?? null,
            eInvoiceStatus: payload.eInvoiceStatus ?? null,
            eWayBillNumber: payload.eWayBillNumber ?? null,
            paymentStatus: toCanonicalPaymentStatus(payload.paymentStatus),
            paidAmount: payload.paidAmount ?? 0,
            dueDate: payload.dueDate ?? null,
            notes: payload.remark ?? null,
            createdByUserId: authUser.id,
            createdAt: now,
            updatedAt: now,
        });

        const delta = resolveTypeDelta(payload.type);

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

            await db.insert(invoiceItems).values({
                id: `invi_${nanoid(16)}`,
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

            if (entry.id) {
                const itemRows = await db
                    .select()
                    .from(items)
                    .where(and(eq(items.id, entry.id), eq(items.businessId, business.id)))
                    .limit(1);

                const item = itemRows[0];
                if (item) {
                    const currentStock = Number(item.stock ?? 0);
                    const nextStock = currentStock + (delta * entry.quantity);

                    await db.update(items).set({
                        stock: nextStock,
                        updatedAt: now,
                    }).where(and(eq(items.id, entry.id), eq(items.businessId, business.id)));

                    await db.insert(inventoryMovements).values({
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
                }
            }
        }

        await bumpMonthlyBillUsage(db, business.id, subscription, billDate);

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
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'GST_INVOICES');
    assertModuleEnabled(business, 'billing');

    const limit = Math.min(Number(c.req.query('limit') ?? 200), 1000);
    const start = c.req.query('start');
    const end = c.req.query('end');

    const whereFilters = [eq(invoices.businessId, business.id)];
    if (start) whereFilters.push(gte(invoices.invoiceDate, new Date(start)));
    if (end) whereFilters.push(lte(invoices.invoiceDate, new Date(end)));

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
        const mappedLines = (linesByInvoiceId.get(entry.id) ?? []).map((line) => ({
            id: line.itemId ?? `line_${line.id}`,
            name: line.description,
            quantity: Number(line.quantity ?? 0),
            price: Number(line.rate ?? 0),
            tax: Number((line.cgstRate ?? 0) + (line.sgstRate ?? 0) + (line.igstRate ?? 0)),
            total: Number((line.taxableValue ?? 0) + (line.cgstAmount ?? 0) + (line.sgstAmount ?? 0) + (line.igstAmount ?? 0) + (line.cessAmount ?? 0)),
        }));

        return {
            id: entry.id,
            userId: authUser.id,
            type: 'SALE',
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
            paymentMode: 'CASH',
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
        };
    });

return c.json({ ok: true, transactions });
});

transactionsRoute.get('/pending-reminders', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Business not found.' }, 404);
    }
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

transactionsRoute.get('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Business not found.' }, 404);
    }
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'GST_INVOICES');
    assertModuleEnabled(business, 'billing');

    const id = c.req.param('id');
    const rows = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)))
        .limit(1);

    if (!rows[0]) {
        return c.json({ ok: false, message: 'Transaction not found.' }, 404);
    }

    const lines = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id));

    return c.json({
        ok: true,
        transaction: {
            id: rows[0].id,
            userId: authUser.id,
            type: 'SALE',
            billNumber: rows[0].invoiceNumber,
            billDate: rows[0].invoiceDate,
            totalAmount: Number(rows[0].totalInvoiceValue ?? 0),
            taxAmount: Number(rows[0].totalTaxAmount ?? 0),
            paidAmount: Number(rows[0].paidAmount ?? 0),
            paymentStatus: toLegacyPaymentStatus(rows[0].paymentStatus),
            items: lines.map((line) => ({
                id: line.itemId ?? `line_${line.id}`,
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
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'GST_INVOICES');
        assertModuleEnabled(business, 'billing');

        const id = c.req.param('id');
        const payload = patchPaymentSchema.parse(await c.req.json());

        const currentRows = await db
            .select()
            .from(invoices)
            .where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)))
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

        await db.update(invoices).set({
            paidAmount: nextPaid,
            paymentStatus: toCanonicalPaymentStatus(status),
            dueDate: payload.nextReminderAt ?? current.dueDate,
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
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'E_INVOICE');
        assertModuleEnabled(business, 'billing');

        const id = c.req.param('id');
        const rows = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.businessId, business.id))).limit(1);
        const invoice = rows[0];
        if (!invoice) return c.json({ ok: false, message: 'Invoice not found.' }, 404);

        const irn = invoice.eInvoiceIrn ?? `IRN${new Date().getUTCFullYear()}${nanoid(18).toUpperCase()}`;
        await db.update(invoices).set({
            eInvoiceIrn: irn,
            eInvoiceStatus: 'GENERATED',
            updatedAt: new Date(),
        }).where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)));

        return c.json({ ok: true, eInvoiceIrn: irn, eInvoiceStatus: 'GENERATED' });
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
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'E_INVOICE');
        assertModuleEnabled(business, 'billing');

        complianceActionSchema.parse(await c.req.json().catch(() => ({})));
        const id = c.req.param('id');
        await db.update(invoices).set({
            eInvoiceStatus: 'CANCELLED',
            updatedAt: new Date(),
        }).where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)));

        return c.json({ ok: true, eInvoiceStatus: 'CANCELLED' });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to cancel e-invoice.' }, 400);
    }
});

transactionsRoute.post('/:id/e-way-bill/generate', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'E_WAY_BILL');
        assertModuleEnabled(business, 'billing');

        const id = c.req.param('id');
        const rows = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.businessId, business.id))).limit(1);
        const invoice = rows[0];
        if (!invoice) return c.json({ ok: false, message: 'Invoice not found.' }, 404);

        const eWayBillNumber = invoice.eWayBillNumber ?? `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        await db.update(invoices).set({
            eWayBillNumber,
            updatedAt: new Date(),
        }).where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)));

        return c.json({ ok: true, eWayBillNumber });
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
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'E_WAY_BILL');
        assertModuleEnabled(business, 'billing');

        complianceActionSchema.parse(await c.req.json().catch(() => ({})));
        const id = c.req.param('id');
        await db.update(invoices).set({
            eWayBillNumber: null,
            updatedAt: new Date(),
        }).where(and(eq(invoices.id, id), eq(invoices.businessId, business.id)));

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to cancel e-way bill.' }, 400);
    }
});

export default transactionsRoute;
