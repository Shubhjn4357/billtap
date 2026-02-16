import { Hono } from 'hono';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
    bankAccounts,
    bankLedgerEntries,
    bankReconciliations,
    transactions,
    vouchers,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    ensurePeriodUnlockedForDate,
    getBusinessControls,
    hasModulePermission,
    writeAuditLog,
} from '../operations/controls';

const treasuryRoute = new Hono<AppEnv>();

const parseDateQuery = (value?: string | null): Date | undefined => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
};

const roundAmount = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const getAgingBucket = (ageDays: number): '0-30' | '31-60' | '61-90' | '90+' => {
    if (ageDays <= 30) return '0-30';
    if (ageDays <= 60) return '31-60';
    if (ageDays <= 90) return '61-90';
    return '90+';
};

treasuryRoute.get('/bank-accounts', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Treasury access denied.' }, 403);
    }

    const db = c.get('db');
    const rows = await db
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, effectiveUserId))
        .orderBy(asc(bankAccounts.bankName), asc(bankAccounts.name));

    return c.json({ ok: true, accounts: rows });
});

treasuryRoute.post('/bank-accounts', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'create')) {
            return c.json({ ok: false, message: 'Treasury create access denied.' }, 403);
        }

        const payload = z.object({
            branchId: z.string().optional(),
            name: z.string().min(1).max(120),
            bankName: z.string().min(1).max(120),
            accountNumberMasked: z.string().optional(),
            ifsc: z.string().optional(),
            openingBalance: z.number().default(0),
            isActive: z.boolean().default(true),
        }).parse(await c.req.json());

        const db = c.get('db');
        const now = new Date();
        const id = nanoid();

        await db.insert(bankAccounts).values({
            id,
            userId: effectiveUserId,
            branchId: payload.branchId ?? null,
            name: payload.name.trim(),
            bankName: payload.bankName.trim(),
            accountNumberMasked: payload.accountNumberMasked?.trim() || null,
            ifsc: payload.ifsc?.trim().toUpperCase() || null,
            openingBalance: payload.openingBalance,
            currentBalance: payload.openingBalance,
            isActive: payload.isActive,
            createdAt: now,
            updatedAt: now,
        });

        await writeAuditLog(c.get('db'), {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'accounting',
            action: 'treasury.bank_account_created',
            entityType: 'bank_account',
            entityId: id,
            after: {
                name: payload.name,
                bankName: payload.bankName,
                openingBalance: payload.openingBalance,
            },
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create bank account.' }, 400);
    }
});

treasuryRoute.patch('/bank-accounts/:id', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'update')) {
            return c.json({ ok: false, message: 'Treasury update access denied.' }, 403);
        }

        const id = c.req.param('id');
        const payload = z.object({
            name: z.string().min(1).max(120).optional(),
            bankName: z.string().min(1).max(120).optional(),
            accountNumberMasked: z.string().optional(),
            ifsc: z.string().optional(),
            isActive: z.boolean().optional(),
        }).parse(await c.req.json());

        const updatePayload: Partial<typeof bankAccounts.$inferInsert> = {
            updatedAt: new Date(),
        };
        if (payload.name !== undefined) updatePayload.name = payload.name.trim();
        if (payload.bankName !== undefined) updatePayload.bankName = payload.bankName.trim();
        if (payload.accountNumberMasked !== undefined) updatePayload.accountNumberMasked = payload.accountNumberMasked || null;
        if (payload.ifsc !== undefined) updatePayload.ifsc = payload.ifsc?.trim().toUpperCase() || null;
        if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

        const db = c.get('db');
        const updated = await db
            .update(bankAccounts)
            .set(updatePayload)
            .where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, effectiveUserId)))
            .returning({ id: bankAccounts.id });

        if (!updated[0]) return c.json({ ok: false, message: 'Bank account not found.' }, 404);
        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update bank account.' }, 400);
    }
});

treasuryRoute.get('/bank-accounts/:id/ledger', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Treasury access denied.' }, 403);
    }

    const bankAccountId = c.req.param('id');
    const start = parseDateQuery(c.req.query('start'));
    const end = parseDateQuery(c.req.query('end'));
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 500), 1), 5000);

    const conditions = [
        eq(bankLedgerEntries.userId, effectiveUserId),
        eq(bankLedgerEntries.bankAccountId, bankAccountId),
    ];
    if (start) conditions.push(gte(bankLedgerEntries.entryDate, start));
    if (end) conditions.push(lte(bankLedgerEntries.entryDate, end));

    const db = c.get('db');
    const rows = await db
        .select()
        .from(bankLedgerEntries)
        .where(and(...conditions))
        .orderBy(desc(bankLedgerEntries.entryDate))
        .limit(limit);

    return c.json({ ok: true, entries: rows });
});

treasuryRoute.get('/vouchers', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Treasury access denied.' }, 403);
    }

    const type = c.req.query('type');
    const start = parseDateQuery(c.req.query('start'));
    const end = parseDateQuery(c.req.query('end'));
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 500), 1), 5000);

    const conditions = [eq(vouchers.userId, effectiveUserId)];
    if (type === 'RECEIPT' || type === 'PAYMENT') conditions.push(eq(vouchers.type, type));
    if (start) conditions.push(gte(vouchers.voucherDate, start));
    if (end) conditions.push(lte(vouchers.voucherDate, end));

    const db = c.get('db');
    const rows = await db
        .select()
        .from(vouchers)
        .where(and(...conditions))
        .orderBy(desc(vouchers.voucherDate))
        .limit(limit);

    return c.json({ ok: true, vouchers: rows });
});

treasuryRoute.post('/vouchers', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'create')) {
            return c.json({ ok: false, message: 'Treasury create access denied.' }, 403);
        }

        const payload = z.object({
            branchId: z.string().optional(),
            type: z.enum(['RECEIPT', 'PAYMENT']),
            voucherDate: z.coerce.date().optional(),
            amount: z.number().positive(),
            mode: z.enum(['CASH', 'BANK']).default('CASH'),
            bankAccountId: z.string().optional(),
            partyId: z.string().optional(),
            partyName: z.string().optional(),
            narration: z.string().optional(),
            costCenter: z.string().optional(),
            projectCode: z.string().optional(),
        }).parse(await c.req.json());

        const db = c.get('db');
        const voucherDate = payload.voucherDate ?? new Date();
        const controls = await getBusinessControls(db, effectiveUserId);
        if (controls.periodLockEnabled) {
            await ensurePeriodUnlockedForDate(db, effectiveUserId, voucherDate);
        }

        const now = new Date();
        const voucherId = nanoid();

        await db.insert(vouchers).values({
            id: voucherId,
            userId: effectiveUserId,
            branchId: payload.branchId ?? null,
            type: payload.type,
            voucherDate,
            amount: payload.amount,
            mode: payload.mode,
            bankAccountId: payload.mode === 'BANK' ? (payload.bankAccountId ?? null) : null,
            partyId: payload.partyId ?? null,
            partyName: payload.partyName ?? null,
            narration: payload.narration ?? null,
            costCenter: payload.costCenter ?? null,
            projectCode: payload.projectCode ?? null,
            status: 'posted',
            createdAt: now,
            updatedAt: now,
        });

        let updatedBalance: number | null = null;
        if (payload.mode === 'BANK') {
            if (!payload.bankAccountId) {
                return c.json({ ok: false, message: 'bankAccountId is required for BANK mode vouchers.' }, 400);
            }

            const accountRows = await db
                .select()
                .from(bankAccounts)
                .where(and(eq(bankAccounts.id, payload.bankAccountId), eq(bankAccounts.userId, effectiveUserId)))
                .limit(1);
            const account = accountRows[0];
            if (!account) {
                return c.json({ ok: false, message: 'Bank account not found.' }, 404);
            }

            const currentBalance = Number(account.currentBalance ?? 0);
            const nextBalance = payload.type === 'RECEIPT'
                ? currentBalance + payload.amount
                : currentBalance - payload.amount;

            await db
                .update(bankAccounts)
                .set({ currentBalance: nextBalance, updatedAt: now })
                .where(and(eq(bankAccounts.id, payload.bankAccountId), eq(bankAccounts.userId, effectiveUserId)));

            await db.insert(bankLedgerEntries).values({
                id: nanoid(),
                userId: effectiveUserId,
                bankAccountId: payload.bankAccountId,
                entryDate: voucherDate,
                direction: payload.type === 'RECEIPT' ? 'CREDIT' : 'DEBIT',
                amount: payload.amount,
                balanceAfter: nextBalance,
                referenceType: 'VOUCHER',
                referenceId: voucherId,
                narration: payload.narration ?? `${payload.type} voucher`,
                reconciled: false,
                reconciledAt: null,
                createdAt: now,
            });

            updatedBalance = roundAmount(nextBalance);
        }

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'accounting',
            action: 'treasury.voucher_posted',
            entityType: 'voucher',
            entityId: voucherId,
            after: {
                type: payload.type,
                amount: payload.amount,
                mode: payload.mode,
                bankAccountId: payload.bankAccountId ?? null,
            },
        });

        return c.json({
            ok: true,
            id: voucherId,
            bankBalanceAfter: updatedBalance,
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create voucher.' }, 400);
    }
});

treasuryRoute.get('/reconciliations', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Treasury access denied.' }, 403);
    }

    const bankAccountId = c.req.query('bankAccountId');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 2000);
    const conditions = [eq(bankReconciliations.userId, effectiveUserId)];
    if (bankAccountId) conditions.push(eq(bankReconciliations.bankAccountId, bankAccountId));

    const db = c.get('db');
    const rows = await db
        .select()
        .from(bankReconciliations)
        .where(and(...conditions))
        .orderBy(desc(bankReconciliations.statementEnd))
        .limit(limit);

    return c.json({ ok: true, reconciliations: rows });
});

treasuryRoute.post('/reconciliations', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'create')) {
            return c.json({ ok: false, message: 'Treasury create access denied.' }, 403);
        }

        const payload = z.object({
            bankAccountId: z.string().min(1),
            statementStart: z.coerce.date(),
            statementEnd: z.coerce.date(),
            statementClosingBalance: z.number(),
            notes: z.string().optional(),
        }).parse(await c.req.json());

        if (payload.statementStart.getTime() > payload.statementEnd.getTime()) {
            return c.json({ ok: false, message: 'statementStart must be before statementEnd.' }, 400);
        }

        const db = c.get('db');
        const ledgerRows = await db
            .select({
                balanceAfter: bankLedgerEntries.balanceAfter,
                entryDate: bankLedgerEntries.entryDate,
            })
            .from(bankLedgerEntries)
            .where(
                and(
                    eq(bankLedgerEntries.userId, effectiveUserId),
                    eq(bankLedgerEntries.bankAccountId, payload.bankAccountId),
                    lte(bankLedgerEntries.entryDate, payload.statementEnd)
                )
            )
            .orderBy(desc(bankLedgerEntries.entryDate))
            .limit(1);

        const accountRows = await db
            .select({ currentBalance: bankAccounts.currentBalance })
            .from(bankAccounts)
            .where(and(eq(bankAccounts.userId, effectiveUserId), eq(bankAccounts.id, payload.bankAccountId)))
            .limit(1);
        const account = accountRows[0];
        if (!account) return c.json({ ok: false, message: 'Bank account not found.' }, 404);

        const bookClosingBalance = roundAmount(Number(ledgerRows[0]?.balanceAfter ?? account.currentBalance ?? 0));
        const differenceAmount = roundAmount(payload.statementClosingBalance - bookClosingBalance);
        const status = Math.abs(differenceAmount) < 0.01 ? 'matched' : 'mismatched';
        const now = new Date();
        const reconciliationId = nanoid();

        await db.insert(bankReconciliations).values({
            id: reconciliationId,
            userId: effectiveUserId,
            bankAccountId: payload.bankAccountId,
            statementStart: payload.statementStart,
            statementEnd: payload.statementEnd,
            statementClosingBalance: payload.statementClosingBalance,
            bookClosingBalance,
            differenceAmount,
            notes: payload.notes ?? null,
            status,
            createdBy: authUser.uid,
            createdAt: now,
            updatedAt: now,
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'accounting',
            action: 'treasury.reconciliation_created',
            entityType: 'bank_reconciliation',
            entityId: reconciliationId,
            after: {
                bankAccountId: payload.bankAccountId,
                status,
                differenceAmount,
            },
        });

        return c.json({
            ok: true,
            id: reconciliationId,
            status,
            bookClosingBalance,
            differenceAmount,
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create reconciliation.' }, 400);
    }
});

treasuryRoute.get('/aging', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Treasury access denied.' }, 403);
    }

    const asOf = parseDateQuery(c.req.query('asOf')) ?? new Date();
    const db = c.get('db');

    const rows = await db
        .select({
            id: transactions.id,
            type: transactions.type,
            partyName: transactions.partyName,
            billNumber: transactions.billNumber,
            dueDate: transactions.dueDate,
            billDate: transactions.billDate,
            totalAmount: transactions.totalAmount,
            paidAmount: transactions.paidAmount,
            paymentStatus: transactions.paymentStatus,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.userId, effectiveUserId),
                eq(transactions.paymentMode, 'CREDIT')
            )
        )
        .orderBy(desc(transactions.dueDate));

    const receivablesByBucket = new Map<string, number>();
    const payablesByBucket = new Map<string, number>();
    const details = [];

    for (const row of rows) {
        if (row.paymentStatus === 'PAID') continue;
        const dueAmount = Math.max(Number(row.totalAmount ?? 0) - Number(row.paidAmount ?? 0), 0);
        if (dueAmount <= 0) continue;

        const anchorDate = row.dueDate ?? row.billDate;
        const ageDays = Math.max(0, Math.floor((asOf.getTime() - anchorDate.getTime()) / (24 * 60 * 60 * 1000)));
        const bucket = getAgingBucket(ageDays);

        if (row.type === 'SALE') {
            receivablesByBucket.set(bucket, roundAmount((receivablesByBucket.get(bucket) ?? 0) + dueAmount));
        } else {
            payablesByBucket.set(bucket, roundAmount((payablesByBucket.get(bucket) ?? 0) + dueAmount));
        }

        details.push({
            transactionId: row.id,
            type: row.type,
            partyName: row.partyName,
            billNumber: row.billNumber,
            billDate: row.billDate,
            dueDate: row.dueDate,
            ageDays,
            bucket,
            dueAmount: roundAmount(dueAmount),
        });
    }

    const bucketOrder: Array<'0-30' | '31-60' | '61-90' | '90+'> = ['0-30', '31-60', '61-90', '90+'];
    const receivables = bucketOrder.map((bucket) => ({
        bucket,
        amount: roundAmount(receivablesByBucket.get(bucket) ?? 0),
    }));
    const payables = bucketOrder.map((bucket) => ({
        bucket,
        amount: roundAmount(payablesByBucket.get(bucket) ?? 0),
    }));

    return c.json({
        ok: true,
        asOf,
        receivables,
        payables,
        totals: {
            receivables: roundAmount(receivables.reduce((sum, row) => sum + row.amount, 0)),
            payables: roundAmount(payables.reduce((sum, row) => sum + row.amount, 0)),
        },
        details,
    });
});

treasuryRoute.get('/cash-flow', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Treasury access denied.' }, 403);
    }

    const start = parseDateQuery(c.req.query('start'));
    const end = parseDateQuery(c.req.query('end'));

    const voucherConditions = [eq(vouchers.userId, effectiveUserId)];
    if (start) voucherConditions.push(gte(vouchers.voucherDate, start));
    if (end) voucherConditions.push(lte(vouchers.voucherDate, end));

    const transactionConditions = [eq(transactions.userId, effectiveUserId)];
    if (start) transactionConditions.push(gte(transactions.billDate, start));
    if (end) transactionConditions.push(lte(transactions.billDate, end));

    const db = c.get('db');
    const voucherRows = await db
        .select({ type: vouchers.type, amount: vouchers.amount, voucherDate: vouchers.voucherDate })
        .from(vouchers)
        .where(and(...voucherConditions))
        .orderBy(asc(vouchers.voucherDate));

    const transactionRows = await db
        .select({
            type: transactions.type,
            paidAmount: transactions.paidAmount,
            billDate: transactions.billDate,
        })
        .from(transactions)
        .where(and(...transactionConditions))
        .orderBy(asc(transactions.billDate));

    let voucherInflow = 0;
    let voucherOutflow = 0;
    for (const row of voucherRows) {
        if (row.type === 'RECEIPT') voucherInflow += Number(row.amount ?? 0);
        if (row.type === 'PAYMENT') voucherOutflow += Number(row.amount ?? 0);
    }

    let operatingInflow = 0;
    let operatingOutflow = 0;
    for (const row of transactionRows) {
        const paidAmount = Number(row.paidAmount ?? 0);
        if (row.type === 'SALE') operatingInflow += paidAmount;
        if (row.type === 'PURCHASE') operatingOutflow += paidAmount;
    }

    const totalInflow = roundAmount(voucherInflow + operatingInflow);
    const totalOutflow = roundAmount(voucherOutflow + operatingOutflow);

    return c.json({
        ok: true,
        period: { start, end },
        vouchers: {
            inflow: roundAmount(voucherInflow),
            outflow: roundAmount(voucherOutflow),
            net: roundAmount(voucherInflow - voucherOutflow),
        },
        operating: {
            inflow: roundAmount(operatingInflow),
            outflow: roundAmount(operatingOutflow),
            net: roundAmount(operatingInflow - operatingOutflow),
        },
        summary: {
            totalInflow,
            totalOutflow,
            netCashFlow: roundAmount(totalInflow - totalOutflow),
        },
    });
});

export default treasuryRoute;
