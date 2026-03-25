import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { accounts, voucherLines, vouchers } from '../db/schema';
import { withTransaction } from '../db/transaction';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    getAccessibleBusiness,
    getRequestedBusinessId,
    getActiveSubscription,
    requireOrganizationCapability,
} from './helpers';
import { nanoid } from 'nanoid';
import { assertModuleEnabled, assertSubscriptionWriteAllowed } from '../services/subscriptionPolicy';
import { ensureDefaultAccounts } from '../services/accountingDefaults';

const cashBankRoute = new Hono<AppEnv>();

cashBankRoute.use('/*', requireAuth);

const contraSchema = z.object({
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    amount: z.number().positive(),
    date: z.coerce.date().optional().nullable(),
    narration: z.string().max(500).optional().nullable(),
    description: z.string().max(500).optional().nullable(),
});

const depositSchema = z.object({
    accountId: z.string().min(1),
    amount: z.number().positive(),
    partyId: z.string().optional().nullable(),
    paymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CHEQUE', 'CARD']).default('CASH'),
    date: z.coerce.date().optional().nullable(),
    narration: z.string().max(500).optional().nullable(),
    description: z.string().max(500).optional().nullable(),
});

const withdrawSchema = z.object({
    accountId: z.string().min(1),
    amount: z.number().positive(),
    partyId: z.string().optional().nullable(),
    paymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CHEQUE', 'CARD']).default('CASH'),
    date: z.coerce.date().optional().nullable(),
    narration: z.string().max(500).optional().nullable(),
    description: z.string().max(500).optional().nullable(),
});

const chequeReceiveSchema = z.object({
    chequeAccountId: z.string().min(1),
    amount: z.number().positive(),
    partyId: z.string().optional().nullable(),
    chequeNumber: z.string().trim().min(1),
    chequeDate: z.coerce.date().optional().nullable(),
    narration: z.string().max(500).optional().nullable(),
});

const chequeDepositSchema = z.object({
    chequeAccountId: z.string().min(1),
    bankAccountId: z.string().min(1),
    amount: z.number().positive(),
    date: z.coerce.date().optional().nullable(),
    narration: z.string().max(500).optional().nullable(),
});

const chequeBounceSchema = z.object({
    chequeAccountId: z.string().min(1),
    bankAccountId: z.string().min(1),
    amount: z.number().positive(),
    reason: z.string().trim().optional().nullable(),
    date: z.coerce.date().optional().nullable(),
});

const resolveCashBankKind = (accountName: string) => {
    const normalized = accountName.toLowerCase();
    if (normalized.includes('cash')) return 'CASH';
    if (normalized.includes('bank')) return 'BANK';
    if (normalized.includes('cheque')) return 'CHEQUE';
    return 'OTHER';
};

const isCashBankAssetAccount = (account: typeof accounts.$inferSelect) =>
    !account.isSystem
    || account.code === '1000'
    || account.code === '1010'
    || resolveCashBankKind(account.name) !== 'OTHER';

const resolveNarration = (
    body: { narration?: string | null; description?: string | null },
    fallback: string
) => body.narration?.trim() || body.description?.trim() || fallback;

const assertAuthBusiness = async (
    c: Parameters<typeof requireAuth>[0],
    capability?: string,
    options?: {
        requireWrite?: boolean;
        moduleKey?: 'accounts' | 'inventory' | 'settings' | 'operations' | 'billing' | 'staff' | 'reports' | 'parties' | 'home';
    }
) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) {
        return { error: c.json({ ok: false, message: 'Unauthorized.' }, 401), db: null, business: null, authUser: null, subscription: null };
    }
    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return { error: c.json({ ok: false, message: 'Business not found.' }, 404), db: null, business: null, authUser: null, subscription: null };
    }
    if (capability) {
        const denied = requireOrganizationCapability(c, capability);
        if (denied) return { error: denied, db: null, business: null, authUser: null, subscription: null };
    }
    if (options?.moduleKey) {
        assertModuleEnabled(business, options.moduleKey);
    }
    const subscription = options?.requireWrite
        ? await getActiveSubscription(db, business.id)
        : null;
    if (subscription) {
        assertSubscriptionWriteAllowed(subscription);
    }
    return { error: null, db, business, authUser, subscription };
};

const getBusinessAssetAccounts = async (db: AppEnv['Variables']['db'], businessId: string) => {
    await ensureDefaultAccounts(db, businessId);
    const rows = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.businessId, businessId), eq(accounts.type, 'ASSET'), eq(accounts.isActive, true)))
        .orderBy(asc(accounts.code));
    return rows.filter(isCashBankAssetAccount);
};

const getAccountBalances = async (
    db: AppEnv['Variables']['db'],
    businessId: string,
    accountIds: string[]
) => {
    if (accountIds.length === 0) return new Map<string, number>();

    const lines = await db
        .select({
            accountId: voucherLines.accountId,
            debit: voucherLines.debit,
            credit: voucherLines.credit,
        })
        .from(voucherLines)
        .innerJoin(vouchers, eq(vouchers.id, voucherLines.voucherId))
        .where(and(eq(vouchers.businessId, businessId), inArray(voucherLines.accountId, accountIds)));

    const balances = new Map<string, number>();
    for (const line of lines) {
        const current = balances.get(line.accountId) ?? 0;
        balances.set(line.accountId, current + Number(line.debit) - Number(line.credit));
    }
    return balances;
};

const ensureAuxiliaryAccount = async (
    db: AppEnv['Variables']['db'],
    businessId: string,
    name: string,
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
) => {
    const existing = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.businessId, businessId), eq(accounts.name, name), eq(accounts.type, type), eq(accounts.isActive, true)))
        .limit(1);
    if (existing[0]) return existing[0];

    const now = new Date();
    const inserted = await db
        .insert(accounts)
        .values({
            id: `acc_${nanoid(16)}`,
            businessId,
            name,
            code: `${type[0]}${Date.now().toString().slice(-7)}`,
            type,
            parentAccountId: null,
            isDefault: false,
            isSystem: true,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        })
        .returning();
    return inserted[0];
};

const createVoucher = async (params: {
    db: AppEnv['Variables']['db'];
    businessId: string;
    createdByUserId: string;
    voucherType: 'PAYMENT_IN' | 'PAYMENT_OUT' | 'CONTRA' | 'JOURNAL';
    voucherNumberPrefix: string;
    date?: string;
    partyId?: string;
    amount: number;
    narration: string;
    lines: Array<{ accountId: string; debit: number; credit: number }>;
}) => {
    const now = new Date();
    const voucherId = `v_${nanoid(18)}`;
    const voucherNumber = `${params.voucherNumberPrefix}-${Date.now()}`;

    await withTransaction(params.db, async (tx) => {
        await tx.insert(vouchers).values({
            id: voucherId,
            businessId: params.businessId,
            voucherType: params.voucherType,
            date: params.date ? new Date(params.date) : now,
            number: voucherNumber,
            partyId: params.partyId ?? null,
            totalAmount: params.amount,
            narration: params.narration,
            status: 'POSTED',
            createdByUserId: params.createdByUserId,
            createdAt: now,
            updatedAt: now,
        });

        await tx.insert(voucherLines).values(params.lines.map((line) => ({
            id: `vl_${nanoid(18)}`,
            voucherId,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            createdAt: now,
        })));
    });

    return { voucherId, voucherNumber };
};

cashBankRoute.get('/operations', async (c) => {
    const denied = requireOrganizationCapability(c, 'cashbank.read');
    if (denied) return denied;

    return c.json({
        ok: true,
        operations: {
            bankAccount: ['Deposit', 'Withdraw'],
            cashInHand: ['Transfer to Bank', 'Adjustments'],
            cheque: ['Receive Cheque', 'Cheque Deposit', 'Cheque Bounce'],
        },
        voucherMapping: {
            Deposit: 'PAYMENT_IN or CONTRA',
            Withdraw: 'PAYMENT_OUT or CONTRA',
            CashToBank: 'CONTRA',
            BankToCash: 'CONTRA',
        },
    });
});

// Get cash & bank account balances
cashBankRoute.get('/balances', async (c) => {
    const context = await assertAuthBusiness(c, 'cashbank.read', { moduleKey: 'accounts' });
    if (context.error || !context.db || !context.business) return context.error!;

    const cashBankAccounts = await getBusinessAssetAccounts(context.db, context.business.id);
    const balances = await getAccountBalances(context.db, context.business.id, cashBankAccounts.map((entry) => entry.id));

    const withBalance = cashBankAccounts.map((entry) => ({
        ...entry,
        balance: balances.get(entry.id) ?? 0,
        kind: resolveCashBankKind(entry.name),
    }));

    return c.json({ ok: true, data: withBalance });
});

cashBankRoute.get('/summary', async (c) => {
    const context = await assertAuthBusiness(c, 'cashbank.read', { moduleKey: 'accounts' });
    if (context.error || !context.db || !context.business) return context.error!;

    const accountsList = await getBusinessAssetAccounts(context.db, context.business.id);
    const balances = await getAccountBalances(context.db, context.business.id, accountsList.map((entry) => entry.id));

    const recentVouchers = await context.db
        .select({
            id: vouchers.id,
            voucherType: vouchers.voucherType,
            number: vouchers.number,
            totalAmount: vouchers.totalAmount,
            date: vouchers.date,
            narration: vouchers.narration,
        })
        .from(vouchers)
        .where(and(eq(vouchers.businessId, context.business.id), inArray(vouchers.voucherType, ['PAYMENT_IN', 'PAYMENT_OUT', 'CONTRA', 'JOURNAL'])))
        .orderBy(desc(vouchers.date))
        .limit(20);

    return c.json({
        ok: true,
        data: {
            accounts: accountsList.map((entry) => ({
                ...entry,
                balance: balances.get(entry.id) ?? 0,
                kind: resolveCashBankKind(entry.name),
            })),
            recentVouchers,
            totalBalance: accountsList.reduce((sum, entry) => sum + (balances.get(entry.id) ?? 0), 0),
        },
    });
});

// Contra entry
cashBankRoute.post('/contra', async (c) => {
    const context = await assertAuthBusiness(c, 'cashbank.write', { requireWrite: true, moduleKey: 'accounts' });
    if (context.error || !context.db || !context.business || !context.authUser) return context.error!;

    try {
        const body = contraSchema.parse(await c.req.json());

        if (body.fromAccountId === body.toAccountId) {
            return c.json({ ok: false, message: 'Source and destination accounts must differ' }, 400);
        }

        const fromRows = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.fromAccountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);
        const toRows = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.toAccountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);

        const fromAcc = fromRows[0];
        const toAcc = toRows[0];
        if (!fromAcc || !toAcc) return c.json({ ok: false, message: 'Invalid account' }, 400);

        const created = await createVoucher({
            db: context.db,
            businessId: context.business.id,
            createdByUserId: context.authUser.id,
            voucherType: 'CONTRA',
            voucherNumberPrefix: 'CON',
            date: body.date ? body.date.toISOString() : undefined,
            amount: body.amount,
            narration: resolveNarration(body, `Transfer from ${fromAcc.name} to ${toAcc.name}`),
            lines: [
                { accountId: body.toAccountId, debit: body.amount, credit: 0 },
                { accountId: body.fromAccountId, debit: 0, credit: body.amount },
            ],
        });

        return c.json({ ok: true, voucherNumber: created.voucherNumber, message: 'Contra entry posted' }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Contra entry failed.' }, 400);
    }
});

// Alias transfer -> contra
cashBankRoute.post('/transfer', async (c) => {
    const context = await assertAuthBusiness(c, 'cashbank.write', { requireWrite: true, moduleKey: 'accounts' });
    if (context.error || !context.db || !context.business || !context.authUser) return context.error!;

    try {
        const body = contraSchema.parse(await c.req.json());

        if (body.fromAccountId === body.toAccountId) {
            return c.json({ ok: false, message: 'Source and destination accounts must differ' }, 400);
        }

        const fromRows = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.fromAccountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);
        const toRows = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.toAccountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);

        const fromAcc = fromRows[0];
        const toAcc = toRows[0];
        if (!fromAcc || !toAcc) return c.json({ ok: false, message: 'Invalid account' }, 400);

        const created = await createVoucher({
            db: context.db,
            businessId: context.business.id,
            createdByUserId: context.authUser.id,
            voucherType: 'CONTRA',
            voucherNumberPrefix: 'CON',
            date: body.date ? body.date.toISOString() : undefined,
            amount: body.amount,
            narration: resolveNarration(body, `Transfer from ${fromAcc.name} to ${toAcc.name}`),
            lines: [
                { accountId: body.toAccountId, debit: body.amount, credit: 0 },
                { accountId: body.fromAccountId, debit: 0, credit: body.amount },
            ],
        });

        return c.json({ ok: true, voucherNumber: created.voucherNumber, message: 'Transfer entry posted' }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Transfer failed.' }, 400);
    }
});

// Deposit
cashBankRoute.post('/deposit', async (c) => {
    const context = await assertAuthBusiness(c, 'cashbank.write', { requireWrite: true, moduleKey: 'accounts' });
    if (context.error || !context.db || !context.business || !context.authUser) return context.error!;

    try {
        const body = depositSchema.parse(await c.req.json());

        const accountRows = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.accountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);
        const account = accountRows[0];
        if (!account) return c.json({ ok: false, message: 'Account not found' }, 400);

        const clearingAccount = await ensureAuxiliaryAccount(
            context.db,
            context.business.id,
            'Cash/Bank Clearing',
            'LIABILITY'
        );

        const created = await createVoucher({
            db: context.db,
            businessId: context.business.id,
            createdByUserId: context.authUser.id,
            voucherType: 'PAYMENT_IN',
            voucherNumberPrefix: 'DEP',
            date: body.date ? body.date.toISOString() : undefined,
            partyId: body.partyId ?? undefined,
            amount: body.amount,
            narration: resolveNarration(body, `Deposit via ${body.paymentMode}`),
            lines: [
                { accountId: body.accountId, debit: body.amount, credit: 0 },
                { accountId: clearingAccount.id, debit: 0, credit: body.amount },
            ],
        });

        return c.json({ ok: true, voucherNumber: created.voucherNumber, message: 'Deposit recorded' }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Deposit failed.' }, 400);
    }
});

// Withdrawal
cashBankRoute.post('/withdraw', async (c) => {
    const context = await assertAuthBusiness(c, 'cashbank.write', { requireWrite: true, moduleKey: 'accounts' });
    if (context.error || !context.db || !context.business || !context.authUser) return context.error!;

    try {
        const body = withdrawSchema.parse(await c.req.json());
        const accountRows = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.accountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);
        const account = accountRows[0];
        if (!account) return c.json({ ok: false, message: 'Account not found' }, 400);

        const clearingAccount = await ensureAuxiliaryAccount(
            context.db,
            context.business.id,
            'Cash/Bank Clearing',
            'LIABILITY'
        );

        const created = await createVoucher({
            db: context.db,
            businessId: context.business.id,
            createdByUserId: context.authUser.id,
            voucherType: 'PAYMENT_OUT',
            voucherNumberPrefix: 'WDR',
            date: body.date ? body.date.toISOString() : undefined,
            partyId: body.partyId ?? undefined,
            amount: body.amount,
            narration: resolveNarration(body, `Withdrawal via ${body.paymentMode}`),
            lines: [
                { accountId: clearingAccount.id, debit: body.amount, credit: 0 },
                { accountId: body.accountId, debit: 0, credit: body.amount },
            ],
        });

        return c.json({ ok: true, voucherNumber: created.voucherNumber, message: 'Withdrawal recorded' }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Withdrawal failed.' }, 400);
    }
});

cashBankRoute.post('/cheques/receive', async (c) => {
    const context = await assertAuthBusiness(c, 'cashbank.write', { requireWrite: true, moduleKey: 'accounts' });
    if (context.error || !context.db || !context.business || !context.authUser) return context.error!;

    try {
        const body = chequeReceiveSchema.parse(await c.req.json());

        const chequeAccountRows = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.chequeAccountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);
        if (!chequeAccountRows[0]) return c.json({ ok: false, message: 'Cheque account not found' }, 400);

        const clearingAccount = await ensureAuxiliaryAccount(
            context.db,
            context.business.id,
            'Cheque Clearing',
            'LIABILITY'
        );

        const created = await createVoucher({
            db: context.db,
            businessId: context.business.id,
            createdByUserId: context.authUser.id,
            voucherType: 'PAYMENT_IN',
            voucherNumberPrefix: 'CHQ-RCV',
            amount: body.amount,
            partyId: body.partyId ?? undefined,
            narration: body.narration ?? `Cheque ${body.chequeNumber} received`,
            lines: [
                { accountId: body.chequeAccountId, debit: body.amount, credit: 0 },
                { accountId: clearingAccount.id, debit: 0, credit: body.amount },
            ],
        });

        return c.json({
            ok: true,
            voucherNumber: created.voucherNumber,
            message: 'Cheque received.',
            cheque: {
                chequeNumber: body.chequeNumber,
                chequeDate: body.chequeDate ?? null,
            },
        }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Cheque receive failed.' }, 400);
    }
});

cashBankRoute.post('/cheques/deposit', async (c) => {
    const context = await assertAuthBusiness(c, 'cashbank.write', { requireWrite: true, moduleKey: 'accounts' });
    if (context.error || !context.db || !context.business || !context.authUser) return context.error!;

    try {
        const body = chequeDepositSchema.parse(await c.req.json());
        if (body.chequeAccountId === body.bankAccountId) {
            return c.json({ ok: false, message: 'Cheque account and bank account must differ.' }, 400);
        }

        const [chequeAcc] = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.chequeAccountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);
        const [bankAcc] = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.bankAccountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);
        if (!chequeAcc || !bankAcc) return c.json({ ok: false, message: 'Account not found' }, 400);

        const created = await createVoucher({
            db: context.db,
            businessId: context.business.id,
            createdByUserId: context.authUser.id,
            voucherType: 'CONTRA',
            voucherNumberPrefix: 'CHQ-DEP',
            date: body.date ? body.date.toISOString() : undefined,
            amount: body.amount,
            narration: body.narration ?? `Cheque deposited from ${chequeAcc.name} to ${bankAcc.name}`,
            lines: [
                { accountId: body.bankAccountId, debit: body.amount, credit: 0 },
                { accountId: body.chequeAccountId, debit: 0, credit: body.amount },
            ],
        });

        return c.json({ ok: true, voucherNumber: created.voucherNumber, message: 'Cheque deposited.' }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Cheque deposit failed.' }, 400);
    }
});

cashBankRoute.post('/cheques/bounce', async (c) => {
    const context = await assertAuthBusiness(c, 'cashbank.write', { requireWrite: true, moduleKey: 'accounts' });
    if (context.error || !context.db || !context.business || !context.authUser) return context.error!;

    try {
        const body = chequeBounceSchema.parse(await c.req.json());
        if (body.chequeAccountId === body.bankAccountId) {
            return c.json({ ok: false, message: 'Cheque account and bank account must differ.' }, 400);
        }

        const [chequeAcc] = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.chequeAccountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);
        const [bankAcc] = await context.db.select().from(accounts)
            .where(and(eq(accounts.id, body.bankAccountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
            .limit(1);
        if (!chequeAcc || !bankAcc) return c.json({ ok: false, message: 'Account not found' }, 400);

        const created = await createVoucher({
            db: context.db,
            businessId: context.business.id,
            createdByUserId: context.authUser.id,
            voucherType: 'JOURNAL',
            voucherNumberPrefix: 'CHQ-BNC',
            date: body.date ? body.date.toISOString() : undefined,
            amount: body.amount,
            narration: `Cheque bounce${body.reason ? `: ${body.reason}` : ''}`,
            lines: [
                { accountId: body.chequeAccountId, debit: body.amount, credit: 0 },
                { accountId: body.bankAccountId, debit: 0, credit: body.amount },
            ],
        });

        return c.json({ ok: true, voucherNumber: created.voucherNumber, message: 'Cheque bounce recorded.' }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Cheque bounce failed.' }, 400);
    }
});

// Account ledger
cashBankRoute.get('/ledger/:accountId', async (c) => {
    const context = await assertAuthBusiness(c, 'cashbank.read', { moduleKey: 'accounts' });
    if (context.error || !context.db || !context.business) return context.error!;

    const accountId = c.req.param('accountId');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const offset = Number(c.req.query('offset') ?? 0);

    const accountRows = await context.db.select().from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.businessId, context.business.id), eq(accounts.isActive, true)))
        .limit(1);
    const account = accountRows[0];
    if (!account) return c.json({ ok: false, message: 'Account not found' }, 404);

    const lines = await context.db
        .select({
            id: voucherLines.id,
            voucherId: voucherLines.voucherId,
            debit: voucherLines.debit,
            credit: voucherLines.credit,
            voucherType: vouchers.voucherType,
            voucherNumber: vouchers.number,
            date: vouchers.date,
            narration: vouchers.narration,
        })
        .from(voucherLines)
        .innerJoin(vouchers, eq(vouchers.id, voucherLines.voucherId))
        .where(and(eq(voucherLines.accountId, accountId), eq(vouchers.businessId, context.business.id)))
        .orderBy(desc(vouchers.date))
        .limit(limit)
        .offset(offset);

    const fullLines = await context.db
        .select({
            debit: voucherLines.debit,
            credit: voucherLines.credit,
        })
        .from(voucherLines)
        .innerJoin(vouchers, eq(vouchers.id, voucherLines.voucherId))
        .where(and(eq(voucherLines.accountId, accountId), eq(vouchers.businessId, context.business.id)));
    const currentBalance = fullLines.reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0);

    let rolling = currentBalance;
    const withBalance = lines.map((line) => {
        const row = {
            ...line,
            runningBalance: rolling,
        };
        rolling -= Number(line.debit) - Number(line.credit);
        return row;
    });

    return c.json({
        ok: true,
        data: withBalance,
        accountName: account.name,
        currentBalance,
        accountKind: resolveCashBankKind(account.name),
    });
});

export default cashBankRoute;


