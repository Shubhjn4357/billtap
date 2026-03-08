import { Hono } from 'hono';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
    accounts,
    invoices,
    invoiceItems,
    inventoryMovements,
    items,
    voucherLines,
    vouchers,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    ensurePrimaryBusiness,
    getAccessibleBusiness,
    getActiveSubscription,
    getRequestedBusinessId,
    requireOrganizationCapability,
} from './helpers';
import {
    GST_RATE_SLABS,
    assertFeatureFlag,
    assertModuleEnabled,
    assertSubscriptionWriteAllowed,
} from '../services/subscriptionPolicy';

const accountingRoute = new Hono<AppEnv>();

const accountSchema = z.object({
    id: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
    parentId: z.string().optional().nullable(),
});

const accountPatchSchema = z.object({
    code: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    parentId: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
});

const journalLineSchema = z.object({
    accountId: z.string().min(1),
    debit: z.number().nonnegative().optional().default(0),
    credit: z.number().nonnegative().optional().default(0),
});

const journalSchema = z.object({
    date: z.coerce.date().optional(),
    narration: z.string().trim().optional(),
    lines: z.array(journalLineSchema).min(2),
});

const DEFAULT_SYSTEM_ACCOUNTS = [
    { code: '1000', name: 'Cash in Hand', type: 'ASSET' as const },
    { code: '1010', name: 'Bank Account', type: 'ASSET' as const },
    { code: '1100', name: 'Accounts Receivable', type: 'ASSET' as const },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' as const },
    { code: '3000', name: 'Owner Equity', type: 'EQUITY' as const },
    { code: '4000', name: 'Sales', type: 'INCOME' as const },
    { code: '5000', name: 'Purchases', type: 'EXPENSE' as const },
    { code: '5100', name: 'Direct Expense', type: 'EXPENSE' as const },
    { code: '5200', name: 'Indirect Expense', type: 'EXPENSE' as const },
];

const resolveBusiness = async (c: Parameters<typeof requireAuth>[0]) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return null;

    return getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
};

accountingRoute.use('/*', requireAuth);

accountingRoute.get('/accounts', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'accounts.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertModuleEnabled(business, 'accounting');
    const type = c.req.query('type');

    const rows = type
        ? await db.select().from(accounts)
            .where(and(eq(accounts.businessId, business.id), eq(accounts.type, type as typeof accounts.$inferSelect['type'])))
            .orderBy(asc(accounts.code))
        : await db.select().from(accounts)
            .where(eq(accounts.businessId, business.id))
            .orderBy(asc(accounts.code));

    return c.json({
        ok: true,
        accounts: rows.map((entry) => ({
            id: entry.id,
            code: entry.code,
            name: entry.name,
            type: entry.type,
            parentId: entry.parentAccountId,
            isDefault: entry.isDefault,
            isActive: entry.isActive,
            isSystem: entry.isSystem,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            balance: 0,
        })),
    });
});

accountingRoute.get('/ledgers', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'accounts.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertModuleEnabled(business, 'accounting');

    const includeInactive = c.req.query('includeInactive') === 'true';
    const ledgerAccounts = includeInactive
        ? await db.select().from(accounts).where(eq(accounts.businessId, business.id)).orderBy(asc(accounts.code))
        : await db.select().from(accounts).where(and(eq(accounts.businessId, business.id), eq(accounts.isActive, true))).orderBy(asc(accounts.code));

    const voucherRows = await db.select({ id: vouchers.id }).from(vouchers).where(eq(vouchers.businessId, business.id));
    const voucherIds = voucherRows.map((entry) => entry.id);
    const lines = voucherIds.length === 0
        ? []
        : await db.select().from(voucherLines).where(inArray(voucherLines.voucherId, voucherIds));

    const totalsByAccount = new Map<string, { debit: number; credit: number }>();
    for (const line of lines) {
        const current = totalsByAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
        current.debit += Number(line.debit ?? 0);
        current.credit += Number(line.credit ?? 0);
        totalsByAccount.set(line.accountId, current);
    }

    const data = ledgerAccounts.map((entry) => {
        const totals = totalsByAccount.get(entry.id) ?? { debit: 0, credit: 0 };
        return {
            id: entry.id,
            code: entry.code,
            name: entry.name,
            type: entry.type,
            isSystem: entry.isSystem,
            isDefault: entry.isDefault,
            isActive: entry.isActive,
            debitTotal: totals.debit,
            creditTotal: totals.credit,
            balance: totals.debit - totals.credit,
        };
    });

    return c.json({
        ok: true,
        data,
        totals: {
            debit: data.reduce((sum, row) => sum + row.debitTotal, 0),
            credit: data.reduce((sum, row) => sum + row.creditTotal, 0),
        },
    });
});

accountingRoute.get('/ledgers/:accountId', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'accounts.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertModuleEnabled(business, 'accounting');

    const accountId = c.req.param('accountId');
    const limit = Math.min(Number(c.req.query('limit') ?? 200), 1000);
    const offset = Math.max(Number(c.req.query('offset') ?? 0), 0);

    const accountRows = await db.select().from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.businessId, business.id)))
        .limit(1);
    const account = accountRows[0];
    if (!account) return c.json({ ok: false, message: 'Account not found.' }, 404);

    const allLines = await db
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
        .where(and(eq(voucherLines.accountId, accountId), eq(vouchers.businessId, business.id)))
        .orderBy(desc(vouchers.date));

    const currentBalance = allLines.reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0);
    const pagedLines = allLines.slice(offset, offset + limit);

    let running = currentBalance;
    const rows = pagedLines.map((line) => {
        const row = {
            ...line,
            runningBalance: running,
        };
        running -= Number(line.debit) - Number(line.credit);
        return row;
    });

    return c.json({
        ok: true,
        data: {
            account: {
                id: account.id,
                code: account.code,
                name: account.name,
                type: account.type,
            },
            currentBalance,
            entries: rows,
        },
    });
});

accountingRoute.post('/accounts', async (c) => {
    try {
        const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'accounts.write');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounting');
    const payload = accountSchema.parse(await c.req.json());

        const now = new Date();
        const id = payload.id?.trim() || `acc_${nanoid(18)}`;
        await db.insert(accounts).values({
            id,
            businessId: business.id,
            code: payload.code,
            name: payload.name,
            type: payload.type,
            parentAccountId: payload.parentId ?? null,
            isDefault: false,
            isSystem: false,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create account.' }, 400);
    }
});

accountingRoute.patch('/accounts/:id', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationCapability(c, 'accounts.write');
        if (denied) return denied;

        const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'accounting');

        const accountId = c.req.param('id');
        const payload = accountPatchSchema.parse(await c.req.json());

        const existingRows = await db.select().from(accounts)
            .where(and(eq(accounts.id, accountId), eq(accounts.businessId, business.id)))
            .limit(1);
        const existing = existingRows[0];
        if (!existing) return c.json({ ok: false, message: 'Account not found.' }, 404);

        if (existing.isSystem && payload.name === undefined && payload.code === undefined && payload.parentId === undefined && payload.isActive !== undefined && payload.isActive !== existing.isActive) {
            return c.json({ ok: false, message: 'System account status cannot be changed directly.' }, 400);
        }

        await db.update(accounts).set({
            ...(payload.code !== undefined ? { code: payload.code } : {}),
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.parentId !== undefined ? { parentAccountId: payload.parentId } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
        }).where(and(eq(accounts.id, accountId), eq(accounts.businessId, business.id)));

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update account.' }, 400);
    }
});

accountingRoute.post('/accounts/:id/deactivate', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationCapability(c, 'accounts.write');
        if (denied) return denied;

        const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'accounting');

        const accountId = c.req.param('id');
        const rows = await db.select().from(accounts)
            .where(and(eq(accounts.id, accountId), eq(accounts.businessId, business.id)))
            .limit(1);
        const account = rows[0];
        if (!account) return c.json({ ok: false, message: 'Account not found.' }, 404);
        if (account.isSystem || account.isDefault) {
            return c.json({ ok: false, message: 'System/default accounts cannot be deactivated.' }, 400);
        }
        const [usage] = await db
            .select({ total: count() })
            .from(voucherLines)
            .innerJoin(vouchers, eq(vouchers.id, voucherLines.voucherId))
            .where(and(
                eq(voucherLines.accountId, account.id),
                eq(vouchers.businessId, business.id),
            ));
        if (Number(usage?.total ?? 0) > 0) {
            return c.json({
                ok: false,
                message: 'Ledger has posted entries and cannot be deactivated.',
                error: {
                    code: 'LEDGER_HAS_ENTRIES',
                    message: 'Ledger has posted entries and cannot be deactivated.',
                },
            }, 409);
        }

        await db.update(accounts).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(and(eq(accounts.id, accountId), eq(accounts.businessId, business.id)));

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to deactivate account.' }, 400);
    }
});

accountingRoute.post('/accounts/seed-default', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'accounts.write');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounting');

    const existing = await db.select().from(accounts).where(eq(accounts.businessId, business.id)).limit(1);
    if (existing[0]) {
        return c.json({ ok: true, message: 'Accounts already initialized.' });
    }

    const now = new Date();
    await db.insert(accounts).values(DEFAULT_SYSTEM_ACCOUNTS.map((entry, index) => ({
        id: `acc_${nanoid(16)}`,
        businessId: business.id,
        code: entry.code,
        name: entry.name,
        type: entry.type,
        parentAccountId: null,
        isDefault: true,
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    })));

    return c.json({ ok: true });
});

accountingRoute.post('/journals', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationCapability(c, 'accounts.write');
        if (denied) return denied;

        const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'accounting');
        const payload = journalSchema.parse(await c.req.json());

        const debitTotal = payload.lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0);
        const creditTotal = payload.lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0);

        if (Math.abs(debitTotal - creditTotal) > 0.0001) {
            return c.json({ ok: false, message: 'Double-entry mismatch: debit and credit totals must be equal.' }, 400);
        }

        const now = new Date();
        const voucherId = `vch_${nanoid(18)}`;
        await db.insert(vouchers).values({
            id: voucherId,
            businessId: business.id,
            voucherType: 'JOURNAL',
            date: payload.date ?? now,
            number: `JRN-${Date.now()}`,
            partyId: null,
            totalAmount: debitTotal,
            narration: payload.narration ?? null,
            status: 'POSTED',
            createdByUserId: authUser.id,
            createdAt: now,
            updatedAt: now,
        });

        await db.insert(voucherLines).values(payload.lines.map((line) => ({
            id: `vln_${nanoid(16)}`,
            voucherId,
            accountId: line.accountId,
            debit: Number(line.debit ?? 0),
            credit: Number(line.credit ?? 0),
            createdAt: now,
        })));

        return c.json({ ok: true, id: voucherId });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to post journal.' }, 400);
    }
});

accountingRoute.get('/trial-balance', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'accounts.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'ADVANCED_REPORTS');
    assertModuleEnabled(business, 'accounting');

    const accountRows = await db.select().from(accounts).where(eq(accounts.businessId, business.id));
    const voucherRows = await db.select().from(vouchers).where(eq(vouchers.businessId, business.id));
    const voucherIds = voucherRows.map((entry) => entry.id);
    const lineRows = voucherIds.length === 0
        ? []
        : await db.select().from(voucherLines).where(inArray(voucherLines.voucherId, voucherIds));

    const totalsByAccount = new Map<string, { debit: number; credit: number }>();
    for (const line of lineRows) {
        const current = totalsByAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
        current.debit += Number(line.debit ?? 0);
        current.credit += Number(line.credit ?? 0);
        totalsByAccount.set(line.accountId, current);
    }

    const rows = accountRows.map((account) => {
        const totals = totalsByAccount.get(account.id) ?? { debit: 0, credit: 0 };
        return {
            accountId: account.id,
            accountName: account.name,
            accountType: account.type,
            debitTotal: totals.debit,
            creditTotal: totals.credit,
        };
    });

    const debitTotal = rows.reduce((sum, row) => sum + row.debitTotal, 0);
    const creditTotal = rows.reduce((sum, row) => sum + row.creditTotal, 0);

    return c.json({
        ok: true,
        rows,
        totals: {
            debit: debitTotal,
            credit: creditTotal,
            isBalanced: Math.abs(debitTotal - creditTotal) < 0.0001,
        },
    });
});

accountingRoute.get('/gst/summary', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'reports.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'GST_REPORTS');
    assertModuleEnabled(business, 'accounting');
    const invoiceRows = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.businessId, business.id));
    const invoiceIds = invoiceRows.map((entry) => entry.id);
    const lines = invoiceIds.length === 0
        ? []
        : await db.select().from(invoiceItems)
            .where(inArray(invoiceItems.invoiceId, invoiceIds))
            .orderBy(asc(invoiceItems.createdAt));

    const summary = new Map<number, {
        gstRate: number;
        taxableTurnover: number;
        cgstAmount: number;
        sgstAmount: number;
        igstAmount: number;
        totalTax: number;
    }>();

    for (const line of lines) {
        const rate = Number((line.cgstRate ?? 0) + (line.sgstRate ?? 0) + (line.igstRate ?? 0));
        const row = summary.get(rate) ?? {
            gstRate: rate,
            taxableTurnover: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalTax: 0,
        };

        row.taxableTurnover += Number(line.taxableValue ?? 0);
        row.cgstAmount += Number(line.cgstAmount ?? 0);
        row.sgstAmount += Number(line.sgstAmount ?? 0);
        row.igstAmount += Number(line.igstAmount ?? 0);
        row.totalTax += Number(line.cgstAmount ?? 0) + Number(line.sgstAmount ?? 0) + Number(line.igstAmount ?? 0) + Number(line.cessAmount ?? 0);
        summary.set(rate, row);
    }

    for (const slab of GST_RATE_SLABS) {
        if (!summary.has(slab)) {
            summary.set(slab, {
                gstRate: slab,
                taxableTurnover: 0,
                cgstAmount: 0,
                sgstAmount: 0,
                igstAmount: 0,
                totalTax: 0,
            });
        }
    }

    return c.json({ ok: true, rows: [...summary.values()].sort((a, b) => a.gstRate - b.gstRate) });
});

accountingRoute.get('/profit-loss', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'reports.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'ADVANCED_REPORTS');
    assertModuleEnabled(business, 'accounting');
    const accountRows = await db.select().from(accounts).where(eq(accounts.businessId, business.id));
    const voucherRows = await db.select().from(vouchers).where(eq(vouchers.businessId, business.id));
    const voucherIds = voucherRows.map((entry) => entry.id);
    const lineRows = voucherIds.length === 0
        ? []
        : await db.select().from(voucherLines).where(inArray(voucherLines.voucherId, voucherIds));

    const totalsByAccount = new Map<string, { debit: number; credit: number }>();
    for (const line of lineRows) {
        const current = totalsByAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
        current.debit += Number(line.debit ?? 0);
        current.credit += Number(line.credit ?? 0);
        totalsByAccount.set(line.accountId, current);
    }

    const incomeLines = accountRows
        .filter((entry) => entry.type === 'INCOME')
        .map((entry) => {
            const totals = totalsByAccount.get(entry.id) ?? { debit: 0, credit: 0 };
            return {
                accountId: entry.id,
                accountName: entry.name,
                amount: totals.credit - totals.debit,
            };
        });

    const expenseLines = accountRows
        .filter((entry) => entry.type === 'EXPENSE')
        .map((entry) => {
            const totals = totalsByAccount.get(entry.id) ?? { debit: 0, credit: 0 };
            return {
                accountId: entry.id,
                accountName: entry.name,
                amount: totals.debit - totals.credit,
            };
        });

    const totalIncome = incomeLines.reduce((sum, row) => sum + row.amount, 0);
    const totalExpense = expenseLines.reduce((sum, row) => sum + row.amount, 0);

    return c.json({
        ok: true,
        income: incomeLines,
        expenses: expenseLines,
        totals: {
            income: totalIncome,
            expenses: totalExpense,
            netProfit: totalIncome - totalExpense,
        },
    });
});

accountingRoute.get('/balance-sheet', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'reports.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'ADVANCED_REPORTS');
    assertModuleEnabled(business, 'accounting');
    const accountRows = await db.select().from(accounts).where(eq(accounts.businessId, business.id));
    const voucherRows = await db.select().from(vouchers).where(eq(vouchers.businessId, business.id));
    const voucherIds = voucherRows.map((entry) => entry.id);
    const lineRows = voucherIds.length === 0
        ? []
        : await db.select().from(voucherLines).where(inArray(voucherLines.voucherId, voucherIds));

    const totalsByAccount = new Map<string, { debit: number; credit: number }>();
    for (const line of lineRows) {
        const current = totalsByAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
        current.debit += Number(line.debit ?? 0);
        current.credit += Number(line.credit ?? 0);
        totalsByAccount.set(line.accountId, current);
    }

    const makeSection = (types: Array<typeof accounts.$inferSelect['type']>) => accountRows
        .filter((entry) => types.includes(entry.type))
        .map((entry) => {
            const totals = totalsByAccount.get(entry.id) ?? { debit: 0, credit: 0 };
            const amount = entry.type === 'ASSET'
                ? totals.debit - totals.credit
                : totals.credit - totals.debit;
            return {
                accountId: entry.id,
                accountName: entry.name,
                accountType: entry.type,
                amount,
            };
        });

    const assets = makeSection(['ASSET']);
    const liabilities = makeSection(['LIABILITY']);
    const equity = makeSection(['EQUITY']);

    return c.json({
        ok: true,
        assets,
        liabilities,
        equity,
        totals: {
            assets: assets.reduce((sum, row) => sum + row.amount, 0),
            liabilities: liabilities.reduce((sum, row) => sum + row.amount, 0),
            equity: equity.reduce((sum, row) => sum + row.amount, 0),
        },
    });
});

accountingRoute.get('/inventory/valuation', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'inventory.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'STOCK_MODULE');
    assertModuleEnabled(business, 'accounting');
    const rows = await db.select().from(items).where(eq(items.businessId, business.id));

    const entries = rows.map((entry) => ({
        itemId: entry.id,
        itemName: entry.name,
        quantity: Number(entry.stock ?? 0),
        unitCost: Number(entry.purchasePrice ?? 0),
        value: Number(entry.stock ?? 0) * Number(entry.purchasePrice ?? 0),
    }));

    return c.json({
        ok: true,
        rows: entries,
        totalValue: entries.reduce((sum, row) => sum + row.value, 0),
    });
});

accountingRoute.get('/inventory/reorder-suggestions', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'inventory.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'STOCK_MODULE');
    assertModuleEnabled(business, 'accounting');
    const rows = await db.select().from(items).where(eq(items.businessId, business.id));

    const suggestions = rows
        .filter((entry) => Number(entry.stock ?? 0) <= Number(entry.reorderLevel ?? 0))
        .map((entry) => ({
            itemId: entry.id,
            itemName: entry.name,
            stock: Number(entry.stock ?? 0),
            reorderLevel: Number(entry.reorderLevel ?? 0),
            suggestedOrderQty: Math.max(Number(entry.reorderLevel ?? 0) - Number(entry.stock ?? 0), 0),
        }));

    return c.json({ ok: true, suggestions });
});

accountingRoute.get('/inventory/stock-aging', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'inventory.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'STOCK_MODULE');
    assertModuleEnabled(business, 'accounting');
    const rows = await db.select().from(items).where(eq(items.businessId, business.id));
    const movementRows = await db
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.businessId, business.id))
        .orderBy(desc(inventoryMovements.createdAt));

    const latestMovementDate = new Map<string, Date>();
    for (const movement of movementRows) {
        if (!latestMovementDate.has(movement.itemId)) {
            latestMovementDate.set(movement.itemId, movement.createdAt ?? new Date());
        }
    }

    const now = Date.now();
    const aging = rows.map((entry) => {
        const referenceDate = latestMovementDate.get(entry.id) ?? entry.updatedAt ?? entry.createdAt ?? new Date();
        const ageDays = Math.max(0, Math.floor((now - referenceDate.getTime()) / (24 * 60 * 60 * 1000)));
        return {
            itemId: entry.id,
            itemName: entry.name,
            ageDays,
            stock: Number(entry.stock ?? 0),
        };
    });

    return c.json({ ok: true, rows: aging });
});

accountingRoute.get('/stock-ledger/:itemId', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'inventory.read');
    if (denied) return denied;

    const business = await resolveBusiness(c) ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'STOCK_MODULE');
    assertModuleEnabled(business, 'accounting');
    const itemId = c.req.param('itemId');
    const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);

    const rows = await db
        .select()
        .from(inventoryMovements)
        .where(and(eq(inventoryMovements.businessId, business.id), eq(inventoryMovements.itemId, itemId)))
        .orderBy(desc(inventoryMovements.createdAt))
        .limit(limit);

    return c.json({ ok: true, entries: rows });
});

export default accountingRoute;
