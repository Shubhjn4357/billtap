import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { ensureSystemAccounts, type SystemAccountCode } from '../accounting/systemAccounts';
import { withTransaction } from '../db/transaction';
import { inventoryMovements, items, journalEntries, journalLines, partyLedgerEntries, transactions } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { hasPermission, requireFeatureGate, requirePermission, withOrganizationContext } from '../middleware/permissions';
import {
    ensurePeriodUnlockedForDate,
    getBusinessControls,
    hasModulePermission,
    writeAuditLog,
} from '../operations/controls';
import { trackMonthlyBillUsage } from '../organizations/access';

const transactionsRoute = new Hono<AppEnv>();

const lineItemSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().positive(),
    price: z.number().nonnegative(), // Unit Price
    tax: z.number().nonnegative().default(0),
    total: z.number().nonnegative(),
});

const transactionSchema = z.object({
    id: z.string().optional(),
    type: z.enum(['SALE', 'PURCHASE']),
    organizationId: z.string().optional(),
    branchId: z.string().optional(),
    partyId: z.string().optional(),
    partyName: z.string().optional(),
    partyPhone: z.string().optional(),
    billNumber: z.string().optional(),
    billDate: z.coerce.date().optional(),
    businessName: z.string().optional(),
    businessAddress: z.string().optional(),
    gstNumber: z.string().optional(),
    items: z.array(lineItemSchema).min(1),
    totalAmount: z.number().nonnegative(),
    discountAmount: z.number().nonnegative().default(0),
    taxAmount: z.number().nonnegative().default(0),
    paidAmount: z.number().nonnegative().optional(),
    paymentMode: z.enum(['CASH', 'CREDIT']).default('CASH'),
    paymentStatus: z.enum(['PAID', 'PARTIAL', 'PENDING']).optional(),
    billMode: z.enum(['GST', 'ESTIMATE']).default('GST'),
    affectsGst: z.boolean().optional(),
    dueDate: z.coerce.date().optional(),
    reminderEnabled: z.boolean().default(false),
    reminderFrequencyDays: z.number().int().positive().default(3),
    nextReminderAt: z.coerce.date().optional(),
    costCenter: z.string().optional(),
    projectCode: z.string().optional(),
    currency: z.string().default('INR'),
    remark: z.string().optional(),
});

const roundAmount = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const toStatusFromAmounts = (totalAmount: number, paidAmount: number): 'PAID' | 'PARTIAL' | 'PENDING' => {
    const roundedTotal = roundAmount(Math.max(totalAmount, 0));
    const roundedPaid = roundAmount(Math.max(paidAmount, 0));
    if (roundedPaid >= roundedTotal) return 'PAID';
    if (roundedPaid <= 0) return 'PENDING';
    return 'PARTIAL';
};

const resolveSettingBoolean = (value: unknown, fallback = false): boolean => {
    if (typeof value === 'boolean') return value;
    return fallback;
};

const toStartOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getPartyRunningBalance = async (params: {
    tx: any;
    userId: string;
    organizationId: string;
    partyId: string;
}): Promise<number> => {
    const rows = await params.tx
        .select({ runningBalance: partyLedgerEntries.runningBalance })
        .from(partyLedgerEntries)
        .where(and(
            eq(partyLedgerEntries.userId, params.userId),
            eq(partyLedgerEntries.organizationId, params.organizationId),
            eq(partyLedgerEntries.partyId, params.partyId),
        ))
        .orderBy(desc(partyLedgerEntries.entryDate), desc(partyLedgerEntries.createdAt))
        .limit(1);
    return Number(rows[0]?.runningBalance ?? 0);
};

interface AccountingPostInput {
    userId: string;
    transactionId: string;
    transactionType: 'SALE' | 'PURCHASE';
    transactionDate: Date;
    branchId?: string | null;
    costCenter?: string | null;
    projectCode?: string | null;
    currency: string;
    totalAmount: number;
    taxAmount: number;
    paidAmount: number;
    paymentMode: 'CASH' | 'CREDIT';
    partyId?: string | null;
    narration?: string | null;
    itemLines: Array<{ id: string; quantity: number }>;
    purchasePriceByItemId: Map<string, number>;
    now: Date;
}

const postTransactionJournal = async (tx: any, input: AccountingPostInput) => {
    const accountMap = await ensureSystemAccounts(tx, input.userId, input.now);
    const getAccountId = (code: SystemAccountCode): string => {
        const accountId = accountMap.get(code);
        if (!accountId) {
            throw new Error(`Missing required system account: ${code}`);
        }
        return accountId;
    };

    const totalAmount = roundAmount(Math.max(input.totalAmount, 0));
    const taxAmount = roundAmount(Math.max(input.taxAmount, 0));
    const taxableBase = roundAmount(Math.max(totalAmount - taxAmount, 0));
    const paidAmount = roundAmount(Math.max(input.paidAmount, 0));
    const receivableAmount = roundAmount(Math.max(totalAmount - paidAmount, 0));
    const payableAmount = roundAmount(Math.max(totalAmount - paidAmount, 0));

    const cashAccountId = getAccountId('1000');
    const receivableAccountId = getAccountId('1200');
    const payableAccountId = getAccountId('2000');
    const salesAccountId = getAccountId('4000');
    const inventoryAccountId = getAccountId('1300');
    const cogsAccountId = getAccountId('5000');
    const purchaseAccountId = getAccountId('5100');
    const gstPayableAccountId = getAccountId('2100');

    const lines: Array<{ accountId: string; debit: number; credit: number; partyId: string | null }> = [];
    const pushLine = (accountId: string, debit: number, credit: number, partyId: string | null = null) => {
        const roundedDebit = roundAmount(debit);
        const roundedCredit = roundAmount(credit);
        if (roundedDebit <= 0 && roundedCredit <= 0) return;
        lines.push({ accountId, debit: roundedDebit, credit: roundedCredit, partyId });
    };

    if (input.transactionType === 'SALE') {
        if (paidAmount > 0) {
            pushLine(cashAccountId, paidAmount, 0, input.partyId ?? null);
        }
        if (input.paymentMode === 'CREDIT' && receivableAmount > 0) {
            pushLine(receivableAccountId, receivableAmount, 0, input.partyId ?? null);
        }
        if (input.paymentMode !== 'CREDIT' && receivableAmount > 0) {
            pushLine(cashAccountId, receivableAmount, 0, input.partyId ?? null);
        }
        pushLine(salesAccountId, 0, taxableBase, null);
        if (taxAmount > 0) {
            pushLine(gstPayableAccountId, 0, taxAmount, null);
        }

        const cogsValue = roundAmount(
            input.itemLines.reduce((sum, line) => {
                const purchasePrice = input.purchasePriceByItemId.get(line.id) ?? 0;
                return sum + (purchasePrice * Number(line.quantity));
            }, 0)
        );
        if (cogsValue > 0) {
            pushLine(cogsAccountId, cogsValue, 0, null);
            pushLine(inventoryAccountId, 0, cogsValue, null);
        }
    } else {
        pushLine(purchaseAccountId, taxableBase, 0, null);
        if (taxAmount > 0) {
            pushLine(gstPayableAccountId, taxAmount, 0, null);
        }
        if (paidAmount > 0) {
            pushLine(cashAccountId, 0, paidAmount, input.partyId ?? null);
        }
        if (input.paymentMode === 'CREDIT' && payableAmount > 0) {
            pushLine(payableAccountId, 0, payableAmount, input.partyId ?? null);
        }
        if (input.paymentMode !== 'CREDIT' && payableAmount > 0) {
            pushLine(cashAccountId, 0, payableAmount, input.partyId ?? null);
        }
    }

    if (lines.length < 2) return;

    const totalDebit = roundAmount(lines.reduce((sum, line) => sum + line.debit, 0));
    const totalCredit = roundAmount(lines.reduce((sum, line) => sum + line.credit, 0));
    const delta = roundAmount(totalDebit - totalCredit);

    if (Math.abs(delta) >= 0.01) {
        const adjustableLine = lines.find((line) => line.accountId === cashAccountId)
            ?? lines.find((line) => line.debit > 0 || line.credit > 0);
        if (!adjustableLine) {
            throw new Error('Unable to auto-balance accounting entry.');
        }

        if (delta > 0) {
            adjustableLine.credit = roundAmount(adjustableLine.credit + delta);
        } else {
            adjustableLine.debit = roundAmount(adjustableLine.debit + Math.abs(delta));
        }
    }

    const entryId = nanoid();
    await tx.insert(journalEntries).values({
        id: entryId,
        userId: input.userId,
        branchId: input.branchId ?? null,
        costCenter: input.costCenter ?? null,
        projectCode: input.projectCode ?? null,
        entryDate: input.transactionDate,
        batchNumber: null,
        referenceType: 'TRANSACTION',
        referenceId: input.transactionId,
        narration: input.narration ?? `${input.transactionType} auto-posted from transaction.`,
        currency: input.currency.toUpperCase(),
        createdAt: input.now,
    });

    for (const line of lines) {
        await tx.insert(journalLines).values({
            id: nanoid(),
            entryId,
            userId: input.userId,
            accountId: line.accountId,
            partyId: line.partyId,
            debit: line.debit,
            credit: line.credit,
            hsn: null,
            gstRate: 0,
            taxType: null,
            createdAt: input.now,
        });
    }
};

// POST /transactions - Create a Purchase or Sale
transactionsRoute.post(
    '/',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_create_bill'),
    requireFeatureGate('bills_per_month'),
    async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const organizationId = c.get('organizationId');
        const organizationSettingsPayload = c.get('organizationSettings') ?? {};
        const authUser = c.get('authUser');
        const db = c.get('db');
        const body = await c.req.json();

        if (!effectiveUserId || !organizationId || !authUser) return c.json({ ok: false, message: 'Unauthorized' }, 401);
        if (!hasModulePermission(authUser, 'billing', 'create')) {
            return c.json({ ok: false, message: 'Billing create access denied.' }, 403);
        }

        const payload = transactionSchema.parse(body);
        const id = payload.id ?? nanoid();
        const now = new Date();
        const billDate = payload.billDate ?? now;
        const billingSettings = ((organizationSettingsPayload as Record<string, unknown>).billing ?? {}) as Record<string, unknown>;
        const inventorySettings = ((organizationSettingsPayload as Record<string, unknown>).inventory ?? {}) as Record<string, unknown>;
        const allowBackDate = resolveSettingBoolean(billingSettings.allowBackDate, false);
        const allowNegativeStock = resolveSettingBoolean(
            inventorySettings.allowNegativeStock ?? billingSettings.allowNegativeStock,
            false
        );
        const isBackDate = toStartOfDay(billDate).getTime() < toStartOfDay(now).getTime();
        if (isBackDate && !allowBackDate && !hasPermission(c, 'can_back_date')) {
            return c.json({ ok: false, message: 'Back-date entry is disabled for your role/store.' }, 403);
        }

        const billMode = payload.billMode;
        const affectsGst = payload.affectsGst ?? billMode !== 'ESTIMATE';
        const normalizedItems = payload.items.map((line) => ({
            ...line,
            tax: affectsGst ? line.tax : 0,
        }));
        const effectiveTaxAmount = affectsGst ? payload.taxAmount : 0;
        const initialPaidAmount = roundAmount(
            payload.paidAmount !== undefined
                ? payload.paidAmount
                : payload.paymentMode === 'CREDIT'
                    ? 0
                    : payload.totalAmount
        );
        const paymentStatus = payload.paymentStatus ?? toStatusFromAmounts(payload.totalAmount, initialPaidAmount);
        const dueDate = payload.paymentMode === 'CREDIT'
            ? (payload.dueDate ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))
            : null;
        const reminderEnabled = payload.paymentMode === 'CREDIT' && payload.reminderEnabled;
        const reminderFrequencyDays = payload.reminderFrequencyDays;
        const nextReminderAt = reminderEnabled
            ? (payload.nextReminderAt ?? dueDate)
            : null;
        const controls = await getBusinessControls(db, effectiveUserId);
        if (controls.periodLockEnabled) {
            await ensurePeriodUnlockedForDate(db, effectiveUserId, billDate);
        }

        // Group items for batch updates
        const grouped = new Map<string, number>();
        for (const line of payload.items) {
            grouped.set(line.id, (grouped.get(line.id) ?? 0) + line.quantity);
        }

        await withTransaction(db, async (tx) => {
            const itemIds = [...grouped.keys()];
            const sourceItems = itemIds.length === 0
                ? []
                : await tx
                    .select({ id: items.id, purchasePrice: items.purchasePrice, name: items.name, stock: items.stock, branchId: items.branchId })
                    .from(items)
                    .where(and(
                        eq(items.userId, effectiveUserId),
                        inArray(items.id, itemIds),
                        ...(payload.branchId ? [eq(items.branchId, payload.branchId)] : []),
                    ));
            const purchasePriceByItemId = new Map(
                sourceItems.map((item) => [item.id, Number(item.purchasePrice ?? 0)])
            );

            // Update Stock
            for (const [itemId, qty] of grouped.entries()) {
                if (payload.type === 'SALE') {
                    // Check stock and deduct (or allow negative stock based on settings).
                    const saleConditions = [
                        eq(items.id, itemId),
                        eq(items.userId, effectiveUserId),
                        ...(payload.branchId ? [eq(items.branchId, payload.branchId)] : []),
                    ];
                    if (!allowNegativeStock) {
                        saleConditions.push(gte(items.stock, qty));
                    }
                    const updatedRows = await tx
                        .update(items)
                        .set({
                            stock: sql`${items.stock} - ${qty}`,
                            updatedAt: now,
                        })
                        .where(and(...saleConditions))
                        .returning({ id: items.id, stock: items.stock });

                    if (!updatedRows[0]) {
                        // Determine why it failed
                        const existing = await tx
                            .select({ id: items.id, name: items.name, stock: items.stock })
                            .from(items)
                            .where(and(
                                eq(items.id, itemId),
                                eq(items.userId, effectiveUserId),
                                ...(payload.branchId ? [eq(items.branchId, payload.branchId)] : []),
                            ))
                            .limit(1);

                        if (!existing[0]) throw new Error(`Item ${itemId} not found.`);
                        throw new Error(`Insufficient stock for "${existing[0].name}". Available: ${existing[0].stock}`);
                    }

                    await tx.insert(inventoryMovements).values({
                        id: nanoid(),
                        userId: effectiveUserId,
                        branchId: payload.branchId ?? null,
                        itemId,
                        transactionId: id,
                        movementType: 'OUT',
                        quantity: qty,
                        balanceAfter: updatedRows[0].stock,
                        unitCost: null,
                        createdAt: now,
                    });
                } else {
                    // Purchase: Add stock
                    const updatedRows = await tx
                        .update(items)
                        .set({
                            stock: sql`${items.stock} + ${qty}`,
                            updatedAt: now,
                        })
                        .where(and(
                            eq(items.id, itemId),
                            eq(items.userId, effectiveUserId),
                            ...(payload.branchId ? [eq(items.branchId, payload.branchId)] : []),
                        ))
                        .returning({ id: items.id, stock: items.stock });

                    if (!updatedRows[0]) {
                        throw new Error(`Item ${itemId} not found.`);
                    }

                    const totalQty = payload.items
                        .filter((line) => line.id === itemId)
                        .reduce((sum, line) => sum + line.quantity, 0);
                    const totalValue = payload.items
                        .filter((line) => line.id === itemId)
                        .reduce((sum, line) => sum + line.quantity * line.price, 0);
                    const unitCost = totalQty > 0 ? totalValue / totalQty : 0;

                    await tx.insert(inventoryMovements).values({
                        id: nanoid(),
                        userId: effectiveUserId,
                        branchId: payload.branchId ?? null,
                        itemId,
                        transactionId: id,
                        movementType: 'IN',
                        quantity: qty,
                        balanceAfter: updatedRows[0].stock,
                        unitCost,
                        createdAt: now,
                    });
                }
            }

            // Create Transaction Record
            await tx.insert(transactions).values({
                id,
                userId: effectiveUserId,
                organizationId,
                branchId: payload.branchId ?? null,
                type: payload.type,
                partyId: payload.partyId ?? null,
                partyName: payload.partyName ?? null,
                partyPhone: payload.partyPhone ?? null,
                billNumber: payload.billNumber ?? null,
                billDate: billDate,
                totalAmount: payload.totalAmount,
                discountAmount: payload.discountAmount,
                taxAmount: effectiveTaxAmount,
                paidAmount: initialPaidAmount,
                paymentMode: payload.paymentMode,
                paymentStatus,
                billMode,
                affectsGst,
                createdByUid: authUser.uid,
                dueDate,
                reminderEnabled,
                reminderFrequencyDays,
                nextReminderAt,
                lastReminderAt: null,
                currency: payload.currency,
                costCenter: payload.costCenter ?? null,
                projectCode: payload.projectCode ?? null,
                businessName: payload.businessName ?? null,
                businessAddress: payload.businessAddress ?? null,
                gstNumber: payload.gstNumber ?? null,
                items: normalizedItems,
                remark: payload.remark ?? null,
                createdAt: now,
                updatedAt: now,
            });

            await postTransactionJournal(tx, {
                userId: effectiveUserId,
                transactionId: id,
                transactionType: payload.type,
                transactionDate: billDate,
                branchId: payload.branchId ?? null,
                costCenter: payload.costCenter ?? null,
                projectCode: payload.projectCode ?? null,
                currency: payload.currency,
                totalAmount: payload.totalAmount,
                taxAmount: effectiveTaxAmount,
                paidAmount: initialPaidAmount,
                paymentMode: payload.paymentMode,
                partyId: payload.partyId ?? null,
                narration: payload.remark ?? null,
                itemLines: normalizedItems.map((line) => ({
                    id: line.id,
                    quantity: line.quantity,
                })),
                purchasePriceByItemId,
                now,
            });

            const dueAmount = roundAmount(Math.max(payload.totalAmount - initialPaidAmount, 0));
            if (payload.partyId && dueAmount > 0) {
                const previousBalance = await getPartyRunningBalance({
                    tx,
                    userId: effectiveUserId,
                    organizationId,
                    partyId: payload.partyId,
                });
                const delta = payload.type === 'SALE' ? dueAmount : -dueAmount;
                const runningBalance = roundAmount(previousBalance + delta);

                await tx.insert(partyLedgerEntries).values({
                    id: nanoid(),
                    userId: effectiveUserId,
                    organizationId,
                    partyId: payload.partyId,
                    sourceType: 'BILL',
                    sourceId: id,
                    direction: payload.type === 'SALE' ? 'DEBIT' : 'CREDIT',
                    amount: dueAmount,
                    runningBalance,
                    entryDate: billDate,
                    narration: payload.remark ?? `${payload.type} bill outstanding`,
                    createdByUid: authUser.uid,
                    createdAt: now,
                });
            }
        });

        await trackMonthlyBillUsage(db, effectiveUserId, 1);

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'billing',
            action: 'transaction.created',
            entityType: 'transaction',
            entityId: id,
            after: {
                type: payload.type,
                totalAmount: payload.totalAmount,
                itemCount: payload.items.length,
                paymentMode: payload.paymentMode,
                billMode,
                affectsGst,
            },
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Transaction failed.' }, 400);
    }
    }
);

// PATCH /transactions/:id/payment - Update payment status/reminder schedule
transactionsRoute.patch(
    '/:id/payment',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_manage_payments'),
    async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const organizationId = c.get('organizationId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !organizationId) return c.json({ ok: false, message: 'Unauthorized' }, 401);
        if (!hasModulePermission(authUser, 'billing', 'update')) {
            return c.json({ ok: false, message: 'Billing update access denied.' }, 403);
        }

        const db = c.get('db');
        const id = c.req.param('id');
        const body = await c.req.json();
        const payload = z.object({
            paidAmount: z.number().nonnegative().optional(),
            markAsPaid: z.boolean().optional(),
            dueDate: z.coerce.date().nullable().optional(),
            reminderEnabled: z.boolean().optional(),
            reminderFrequencyDays: z.number().int().positive().optional(),
            nextReminderAt: z.coerce.date().nullable().optional(),
        }).parse(body);

        const rows = await db
            .select()
            .from(transactions)
            .where(and(
                eq(transactions.id, id),
                eq(transactions.userId, effectiveUserId),
                eq(transactions.organizationId, organizationId),
            ))
            .limit(1);
        const current = rows[0];
        if (!current) return c.json({ ok: false, message: 'Transaction not found.' }, 404);

        const totalAmount = Number(current.totalAmount ?? 0);
        const nextPaidAmount = payload.markAsPaid
            ? totalAmount
            : roundAmount(payload.paidAmount ?? Number(current.paidAmount ?? 0));
        const nextStatus = toStatusFromAmounts(totalAmount, nextPaidAmount);

        const nextReminderEnabled = payload.reminderEnabled ?? Boolean(current.reminderEnabled);
        const nextReminderFrequencyDays = payload.reminderFrequencyDays ?? Number(current.reminderFrequencyDays ?? 3);
        const nextDueDate = payload.dueDate !== undefined ? payload.dueDate : current.dueDate;
        const nextNextReminderAt = payload.nextReminderAt !== undefined
            ? payload.nextReminderAt
            : (nextReminderEnabled ? (current.nextReminderAt ?? nextDueDate ?? null) : null);

        await db
            .update(transactions)
            .set({
                paidAmount: nextPaidAmount,
                paymentStatus: nextStatus,
                paymentMode: nextStatus === 'PAID' ? 'CASH' : current.paymentMode,
                dueDate: nextDueDate,
                reminderEnabled: nextReminderEnabled,
                reminderFrequencyDays: nextReminderFrequencyDays,
                nextReminderAt: nextNextReminderAt,
                lastReminderAt: payload.nextReminderAt !== undefined ? current.lastReminderAt : current.lastReminderAt,
                updatedAt: new Date(),
            })
            .where(and(
                eq(transactions.id, id),
                eq(transactions.userId, effectiveUserId),
                eq(transactions.organizationId, organizationId),
            ));

        return c.json({
            ok: true,
            paymentStatus: nextStatus,
            paidAmount: nextPaidAmount,
            dueAmount: roundAmount(Math.max(totalAmount - nextPaidAmount, 0)),
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update payment.' }, 400);
    }
    }
);

// GET /transactions/pending-reminders - credit/pending records requiring reminders
transactionsRoute.get(
    '/pending-reminders',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_manage_payments'),
    async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const organizationId = c.get('organizationId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !organizationId) return c.json({ ok: false, message: 'Unauthorized' }, 401);
    if (!hasModulePermission(authUser, 'billing', 'view')) {
        return c.json({ ok: false, message: 'Billing access denied.' }, 403);
    }

    const db = c.get('db');
    const dueBeforeRaw = c.req.query('dueBefore');
    const dueBefore = dueBeforeRaw ? new Date(dueBeforeRaw) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const rows = await db
        .select()
        .from(transactions)
        .where(
            and(
                eq(transactions.userId, effectiveUserId),
                eq(transactions.organizationId, organizationId),
                eq(transactions.type, 'SALE'),
                inArray(transactions.paymentStatus, ['PENDING', 'PARTIAL'])
            )
        )
        .orderBy(desc(transactions.dueDate), desc(transactions.billDate))
        .limit(500);

    const reminders = rows
        .filter((entry) => {
            if (!entry.reminderEnabled) return false;
            const dueDate = entry.dueDate ?? entry.nextReminderAt;
            if (!dueDate) return false;
            return dueDate.getTime() <= dueBefore.getTime();
        })
        .map((entry) => {
            const totalAmount = Number(entry.totalAmount ?? 0);
            const paidAmount = Number(entry.paidAmount ?? 0);
            const dueAmount = roundAmount(Math.max(totalAmount - paidAmount, 0));
            const nextReminderAt = entry.nextReminderAt ?? entry.dueDate ?? now;
            return {
                id: entry.id,
                billNumber: entry.billNumber,
                partyName: entry.partyName,
                partyPhone: entry.partyPhone,
                totalAmount,
                paidAmount,
                dueAmount,
                currency: entry.currency ?? 'INR',
                dueDate: entry.dueDate,
                reminderFrequencyDays: entry.reminderFrequencyDays,
                nextReminderAt,
                paymentStatus: entry.paymentStatus,
            };
        });

    return c.json({ ok: true, reminders });
    }
);

// GET /transactions - List transactions
transactionsRoute.get(
    '/',
    requireAuth,
    withOrganizationContext,
    requirePermission('can_create_bill'),
    async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const organizationId = c.get('organizationId');
    const authUser = c.get('authUser');
    const db = c.get('db');
    const type = c.req.query('type') as 'SALE' | 'PURCHASE' | undefined;
    const paymentStatus = c.req.query('paymentStatus') as 'PAID' | 'PARTIAL' | 'PENDING' | undefined;
    const start = c.req.query('start');
    const end = c.req.query('end');
    const limit = Math.min(Number(c.req.query('limit') || 50), 200);

    if (!effectiveUserId || !organizationId) return c.json({ ok: false, message: 'Unauthorized' }, 401);
    if (!hasModulePermission(authUser, 'billing', 'view')) {
        return c.json({ ok: false, message: 'Billing access denied.' }, 403);
    }

    const conditions = [
        eq(transactions.userId, effectiveUserId),
        eq(transactions.organizationId, organizationId),
    ];

    if (type) conditions.push(eq(transactions.type, type));
    if (paymentStatus) conditions.push(eq(transactions.paymentStatus, paymentStatus));
    if (start) conditions.push(gte(transactions.billDate, new Date(start)));
    if (end) conditions.push(lte(transactions.billDate, new Date(end)));

    const data = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.billDate))
        .limit(limit);

    return c.json({ ok: true, transactions: data });
    }
);

export default transactionsRoute;
