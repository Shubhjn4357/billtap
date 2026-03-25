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
import { ensureDefaultAccounts } from '../services/accountingDefaults';

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
    if (entry.invoiceType === 'CREDIT_NOTE_DOC') return 'RETURN_INWARD';
    if (entry.invoiceType === 'DEBIT_NOTE_DOC') return 'RETURN_OUTWARD';
    return 'SALE';
};

const deriveDocumentKind = (entry: typeof invoices.$inferSelect) => {
    const metadata = asMetadataRecord(entry.gstRateBreakupJson);
    const documentKind = typeof metadata.documentKind === 'string'
        ? metadata.documentKind.trim().toUpperCase()
        : '';
    return documentKind || entry.invoiceType;
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
    await ensureDefaultAccounts(db, business.id);

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
    await ensureDefaultAccounts(db, business.id);

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

    const invoiceRows = await db.select().from(invoices).where(eq(invoices.businessId, business.id));

    let receivables = 0;
    let payables = 0;
    for (const inv of invoiceRows) {
        if (inv.paymentStatus === 'PAID') continue;
        const outstanding = Number(inv.totalInvoiceValue ?? 0) - Number(inv.paidAmount ?? 0);
        const meta = inv.gstRateBreakupJson as Record<string, unknown> | null;
        const txType = meta?.transactionType;
        const isPosting = inv.invoiceType !== 'ESTIMATE' && inv.invoiceType !== 'PROFORMA' && inv.invoiceType !== 'DELIVERY_CHALLAN_DOC';

        if (!isPosting) continue;

        if (txType === 'SALE') {
            receivables += outstanding;
        } else if (txType === 'PURCHASE') {
            payables += outstanding;
        } else if (txType === 'RETURN_INWARD') {
            receivables -= outstanding;
        } else if (txType === 'RETURN_OUTWARD') {
            payables -= outstanding;
        }
    }

    const assets = accountRows
        .filter((entry) => entry.type === 'ASSET')
        .map((entry) => ({
            accountId: entry.id,
            accountName: entry.name,
            accountType: entry.type,
            amount: (totals.get(entry.id)?.debit ?? 0) - (totals.get(entry.id)?.credit ?? 0),
        }));
    
    // Inject calculated Receivables if greater than 0
    if (receivables !== 0) {
        assets.push({
            accountId: 'calculated_receivables',
            accountName: 'Accounts Receivable (Calculated)',
            accountType: 'ASSET',
            amount: receivables,
        });
    }

    const liabilities = accountRows
        .filter((entry) => entry.type === 'LIABILITY')
        .map((entry) => ({
            accountId: entry.id,
            accountName: entry.name,
            accountType: entry.type,
            amount: (totals.get(entry.id)?.credit ?? 0) - (totals.get(entry.id)?.debit ?? 0),
        }));
    
    // Inject calculated Payables if greater than 0
    if (payables !== 0) {
        liabilities.push({
            accountId: 'calculated_payables',
            accountName: 'Accounts Payable (Calculated)',
            accountType: 'LIABILITY',
            amount: payables,
        });
    }

    const equity = accountRows
        .filter((entry) => entry.type === 'EQUITY')
        .map((entry) => ({
            accountId: entry.id,
            accountName: entry.name,
            accountType: entry.type,
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
        transactionType: deriveTransactionType(entry),
        documentKind: deriveDocumentKind(entry),
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

