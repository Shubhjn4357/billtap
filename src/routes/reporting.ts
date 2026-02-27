import { Hono } from 'hono';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { transactions, items } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { requireFeatureToggle, requirePermission } from '../middleware/permissions';

const reportingRoute = new Hono<AppEnv>();
const transactionTypeValues = ['SALE', 'PURCHASE', 'RETURN_INWARD', 'RETURN_OUTWARD'] as const;

const toCsvSafe = (value: string | number | null | undefined) => {
    const raw = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
    return raw;
};

// GET /reporting/pnl - Profit and Loss
reportingRoute.get('/pnl', requireAuth, requirePermission('canManageAccounting'), requireFeatureToggle('reports'), async (c) => {
    const effectiveUserId = c.get('effectiveUserId');

    const authUser = c.get('authUser');
    const db = c.get('db');
    const start = c.req.query('start');
    const end = c.req.query('end');

    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

    const conditions = [eq(transactions.userId, effectiveUserId)];
    if (start) conditions.push(gte(transactions.billDate, new Date(start)));
    if (end) conditions.push(lte(transactions.billDate, new Date(end)));

    const totalsByType = await db
        .select({
            type: transactions.type,
            total: sql<number>`sum(${transactions.totalAmount})`,
        })
        .from(transactions)
        .where(and(...conditions))
        .groupBy(transactions.type);

    const byType = new Map<string, number>(
        totalsByType.map((row) => [row.type, Number(row.total ?? 0)])
    );
    const totalSales = Number(byType.get('SALE') ?? 0) - Number(byType.get('RETURN_INWARD') ?? 0);
    const totalPurchases = Number(byType.get('PURCHASE') ?? 0) - Number(byType.get('RETURN_OUTWARD') ?? 0);
    const netProfit = totalSales - totalPurchases;

    return c.json({
        ok: true,
        period: { start, end },
        totalSales,
        totalPurchases,
        netProfit,
        currency: authUser?.currency ?? 'INR'
    });
});

// GET /reporting/stock-valuation - Value of current stock
reportingRoute.get('/stock-valuation', requireAuth, requirePermission('canManageAccounting'), requireFeatureToggle('reports'), async (c) => {
    const effectiveUserId = c.get('effectiveUserId');

    const db = c.get('db');

    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

    const stockResult = await db
        .select({
            totalValue: sql<number>`sum(${items.stock} * ${items.purchasePrice})`,
            retailValue: sql<number>`sum(${items.stock} * ${items.price})`,
            count: sql<number>`count(*)`
        })
        .from(items)
        .where(and(eq(items.userId, effectiveUserId), sql`${items.isActive} = true`));

    return c.json({
        ok: true,
        totalStockValue: Number(stockResult[0]?.totalValue || 0),
        potentialRetailValue: Number(stockResult[0]?.retailValue || 0),
        itemCount: Number(stockResult[0]?.count || 0),
    });
});

// GET /reporting/balance-sheet - Basic snapshot
reportingRoute.get('/balance-sheet', requireAuth, requirePermission('canManageAccounting'), requireFeatureToggle('reports'), async (c) => {
    const effectiveUserId = c.get('effectiveUserId');

    const db = c.get('db');

    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

    // 1. Stock Value (Asset)
    const stockResult = await db
        .select({ totalValue: sql<number>`sum(${items.stock} * ${items.purchasePrice})` })
        .from(items)
        .where(and(eq(items.userId, effectiveUserId), sql`${items.isActive} = true`));

    const stockValue = Number(stockResult[0]?.totalValue || 0);

    // 2. Revenue / expense totals and paid-flow approximation.
    const groupedTotals = await db
        .select({
            type: transactions.type,
            totalAmount: sql<number>`sum(${transactions.totalAmount})`,
            paidAmount: sql<number>`sum(${transactions.paidAmount})`,
        })
        .from(transactions)
        .where(eq(transactions.userId, effectiveUserId))
        .groupBy(transactions.type);
    const totalsByType = new Map<string, { totalAmount: number; paidAmount: number }>(
        groupedTotals.map((row) => [
            row.type,
            {
                totalAmount: Number(row.totalAmount ?? 0),
                paidAmount: Number(row.paidAmount ?? 0),
            },
        ])
    );

    const totalSales = (totalsByType.get('SALE')?.totalAmount ?? 0) - (totalsByType.get('RETURN_INWARD')?.totalAmount ?? 0);
    const totalPurchases = (totalsByType.get('PURCHASE')?.totalAmount ?? 0) - (totalsByType.get('RETURN_OUTWARD')?.totalAmount ?? 0);
    const salesPaid = (totalsByType.get('SALE')?.paidAmount ?? 0) - (totalsByType.get('RETURN_INWARD')?.paidAmount ?? 0);
    const purchasesPaid = (totalsByType.get('PURCHASE')?.paidAmount ?? 0) - (totalsByType.get('RETURN_OUTWARD')?.paidAmount ?? 0);
    const cashEquivalent = salesPaid - purchasesPaid;

    // 4. Receivable/Payable from open credit transactions.
    const openTransactions = await db
        .select({
            type: transactions.type,
            totalAmount: transactions.totalAmount,
            paidAmount: transactions.paidAmount,
            paymentStatus: transactions.paymentStatus,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.userId, effectiveUserId),
                sql`${transactions.paymentStatus} in ('PENDING', 'PARTIAL')`
            )
        );

    let accountsReceivable = 0;
    let accountsPayable = 0;
    for (const entry of openTransactions) {
        const dueAmount = Math.max(Number(entry.totalAmount || 0) - Number(entry.paidAmount || 0), 0);
        if (entry.type === 'SALE' || entry.type === 'RETURN_OUTWARD') accountsReceivable += dueAmount;
        if (entry.type === 'PURCHASE' || entry.type === 'RETURN_INWARD') accountsPayable += dueAmount;
    }

    const retainedEarnings = totalSales - totalPurchases;
    const positiveCash = Math.max(cashEquivalent, 0);
    const negativeCashAsLiability = Math.max(-cashEquivalent, 0);
    const totalAssets = stockValue + positiveCash + accountsReceivable;
    const totalLiabilities = accountsPayable + negativeCashAsLiability;
    const totalEquity = totalAssets - totalLiabilities;

    return c.json({
        ok: true,
        assets: {
            stockValue,
            cashEquivalent,
            accountsReceivable,
            totalAssets,
        },
        liabilities: {
            accountsPayable,
            overdraft: negativeCashAsLiability,
            totalLiabilities,
        },
        equity: {
            retainedEarnings,
            balancingFigure: totalEquity - retainedEarnings,
            totalEquity,
        }
    });
});

// GET /reporting/export/transactions - JSON/CSV export for analysis
reportingRoute.get('/export/transactions', requireAuth, requirePermission('canManageAccounting'), requireFeatureToggle('reports'), async (c) => {
    const effectiveUserId = c.get('effectiveUserId');

    const db = c.get('db');
    const typeQuery = c.req.query('type');
    const type = typeQuery && transactionTypeValues.includes(typeQuery as (typeof transactionTypeValues)[number])
        ? (typeQuery as (typeof transactionTypeValues)[number])
        : undefined;
    const start = c.req.query('start');
    const end = c.req.query('end');
    const format = (c.req.query('format') || 'json').toLowerCase();

    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

    const conditions = [eq(transactions.userId, effectiveUserId)];
    if (type) conditions.push(eq(transactions.type, type));
    if (start) conditions.push(gte(transactions.billDate, new Date(start)));
    if (end) conditions.push(lte(transactions.billDate, new Date(end)));

    const data = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(sql`${transactions.billDate} desc`);

    if (format === 'csv' || format === 'excel') {
        const headers = [
            'id',
            'type',
            'billNumber',
            'billDate',
            'partyName',
            'partyPhone',
            'totalAmount',
            'paidAmount',
            'paymentStatus',
            'paymentMode',
            'dueDate',
            'currency',
            'remark',
        ];

        const rows = data.map((entry) => ([
            entry.id,
            entry.type,
            entry.billNumber,
            entry.billDate?.toISOString(),
            entry.partyName,
            entry.partyPhone,
            Number(entry.totalAmount ?? 0).toFixed(2),
            Number(entry.paidAmount ?? 0).toFixed(2),
            entry.paymentStatus,
            entry.paymentMode,
            entry.dueDate?.toISOString(),
            entry.currency,
            entry.remark,
        ].map(toCsvSafe).join(',')));

        const csv = [headers.join(','), ...rows].join('\n');
        return new Response(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="transactions-export.csv"',
            },
        });
    }

    return c.json({
        ok: true,
        exportedAt: new Date().toISOString(),
        count: data.length,
        transactions: data,
    });
});

export default reportingRoute;
