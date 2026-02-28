import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import {
    accounts,
    invoices,
    items,
    voucherLines,
    vouchers,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { ensurePrimaryBusiness, getAccessibleBusiness, getActiveSubscription, getRequestedBusinessId } from './helpers';
import { assertFeatureFlag, assertModuleEnabled } from '../services/subscriptionPolicy';

const reportingRoute = new Hono<AppEnv>();

const toCsv = (rows: Array<Record<string, unknown>>) => {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => {
        const text = String(value ?? '');
        if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
        return text;
    };

    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map((header) => escape(row[header])).join(','));
    }
    return lines.join('\n');
};

reportingRoute.use('/*', requireAuth);

reportingRoute.get('/stock-valuation', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'STOCK_MODULE');
    assertModuleEnabled(business, 'reports');

    const rows = await db.select().from(items).where(eq(items.businessId, business.id));

    const entries = rows.map((entry) => ({
        id: entry.id,
        name: entry.name,
        stock: Number(entry.stock ?? 0),
        unitCost: Number(entry.purchasePrice ?? 0),
        valuation: Number(entry.stock ?? 0) * Number(entry.purchasePrice ?? 0),
    }));

    return c.json({
        ok: true,
        rows: entries,
        totalValue: entries.reduce((sum, row) => sum + row.valuation, 0),
    });
});

reportingRoute.get('/pnl', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'ADVANCED_REPORTS');
    assertModuleEnabled(business, 'reports');

    const accountRows = await db.select().from(accounts).where(eq(accounts.businessId, business.id));
    const voucherRows = await db.select().from(vouchers).where(eq(vouchers.businessId, business.id));
    const voucherIds = voucherRows.map((entry) => entry.id);
    const lines = voucherIds.length > 0
        ? await db.select().from(voucherLines).where(inArray(voucherLines.voucherId, voucherIds))
        : [];

    const totals = new Map<string, { debit: number; credit: number }>();
    for (const line of lines) {
        const current = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
        current.debit += Number(line.debit ?? 0);
        current.credit += Number(line.credit ?? 0);
        totals.set(line.accountId, current);
    }

    const income = accountRows
        .filter((entry) => entry.type === 'INCOME')
        .map((entry) => ({
            account: entry.name,
            amount: (totals.get(entry.id)?.credit ?? 0) - (totals.get(entry.id)?.debit ?? 0),
        }));

    const expenses = accountRows
        .filter((entry) => entry.type === 'EXPENSE')
        .map((entry) => ({
            account: entry.name,
            amount: (totals.get(entry.id)?.debit ?? 0) - (totals.get(entry.id)?.credit ?? 0),
        }));

    const totalIncome = income.reduce((sum, row) => sum + row.amount, 0);
    const totalExpenses = expenses.reduce((sum, row) => sum + row.amount, 0);

    return c.json({
        ok: true,
        income,
        expenses,
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
    });
});

reportingRoute.get('/balance-sheet', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'ADVANCED_REPORTS');
    assertModuleEnabled(business, 'reports');

    const accountRows = await db.select().from(accounts).where(eq(accounts.businessId, business.id));
    const voucherRows = await db.select().from(vouchers).where(eq(vouchers.businessId, business.id));
    const voucherIds = voucherRows.map((entry) => entry.id);
    const lines = voucherIds.length > 0
        ? await db.select().from(voucherLines).where(inArray(voucherLines.voucherId, voucherIds))
        : [];

    const totals = new Map<string, { debit: number; credit: number }>();
    for (const line of lines) {
        const current = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
        current.debit += Number(line.debit ?? 0);
        current.credit += Number(line.credit ?? 0);
        totals.set(line.accountId, current);
    }

    const assets = accountRows
        .filter((entry) => entry.type === 'ASSET')
        .map((entry) => ({
            account: entry.name,
            amount: (totals.get(entry.id)?.debit ?? 0) - (totals.get(entry.id)?.credit ?? 0),
        }));

    const liabilities = accountRows
        .filter((entry) => entry.type === 'LIABILITY')
        .map((entry) => ({
            account: entry.name,
            amount: (totals.get(entry.id)?.credit ?? 0) - (totals.get(entry.id)?.debit ?? 0),
        }));

    const equity = accountRows
        .filter((entry) => entry.type === 'EQUITY')
        .map((entry) => ({
            account: entry.name,
            amount: (totals.get(entry.id)?.credit ?? 0) - (totals.get(entry.id)?.debit ?? 0),
        }));

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

reportingRoute.get('/export/transactions', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'GST_REPORTS');
    assertModuleEnabled(business, 'reports');

    const rows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.businessId, business.id));

    const payload = rows.map((entry) => ({
        id: entry.id,
        invoiceNumber: entry.invoiceNumber,
        invoiceDate: entry.invoiceDate,
        invoiceType: entry.invoiceType,
        totalInvoiceValue: entry.totalInvoiceValue,
        totalTaxAmount: entry.totalTaxAmount,
        paymentStatus: entry.paymentStatus,
        paidAmount: entry.paidAmount,
    }));

    if ((c.req.query('format') ?? 'json').toLowerCase() === 'csv') {
        c.header('Content-Type', 'text/csv; charset=utf-8');
        c.header('Content-Disposition', 'attachment; filename="transactions.csv"');
        return c.body(toCsv(payload));
    }

    return c.json({ ok: true, transactions: payload });
});

export default reportingRoute;
