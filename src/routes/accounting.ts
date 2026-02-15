import { Hono } from 'hono';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { SYSTEM_ACCOUNT_DEFINITIONS, ensureSystemAccounts } from '../accounting/systemAccounts';
import {
    accounts,
    inventoryMovements,
    items,
    journalEntries,
    journalLines,
    transactions,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';

const accountingRoute = new Hono<AppEnv>();

const dateParam = z
    .string()
    .optional()
    .transform((value) => {
        if (!value) return undefined;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return undefined;
        return parsed;
    });

const roundAmount = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const getAgeBucket = (ageDays: number): '0-30' | '31-60' | '61-90' | '90+' => {
    if (ageDays <= 30) return '0-30';
    if (ageDays <= 60) return '31-60';
    if (ageDays <= 90) return '61-90';
    return '90+';
};

accountingRoute.get('/accounts', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const type = c.req.query('type');
    const db = c.get('db');

    const conditions = [eq(accounts.userId, effectiveUserId)];
    if (type) conditions.push(eq(accounts.type, type));

    const data = await db
        .select()
        .from(accounts)
        .where(and(...conditions))
        .orderBy(asc(accounts.code), asc(accounts.name));

    return c.json({ ok: true, accounts: data });
});

accountingRoute.post('/accounts', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const body = await c.req.json();
    const payload = z.object({
        code: z.string().min(2).max(20),
        name: z.string().min(2).max(120),
        type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
        parentId: z.string().optional(),
        isActive: z.boolean().optional(),
    }).parse(body);

    const id = nanoid();
    const now = new Date();
    const db = c.get('db');
    await db.insert(accounts).values({
        id,
        userId: effectiveUserId,
        code: payload.code.trim().toUpperCase(),
        name: payload.name.trim(),
        type: payload.type,
        parentId: payload.parentId ?? null,
        isSystem: false,
        isActive: payload.isActive ?? true,
        createdAt: now,
        updatedAt: now,
    });

    return c.json({ ok: true, id });
});

accountingRoute.post('/accounts/seed-default', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const db = c.get('db');
    const map = await db.transaction(async (tx) => ensureSystemAccounts(tx, effectiveUserId, new Date()));

    return c.json({
        ok: true,
        seededCount: SYSTEM_ACCOUNT_DEFINITIONS.length,
        availableSystemAccounts: map.size,
    });
});

accountingRoute.post('/journals', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const body = await c.req.json();
    const payload = z.object({
        entryDate: z.coerce.date().optional(),
        batchNumber: z.string().optional(),
        referenceType: z.string().optional(),
        referenceId: z.string().optional(),
        narration: z.string().optional(),
        currency: z.string().optional(),
        lines: z.array(z.object({
            accountId: z.string().min(1),
            partyId: z.string().optional(),
            debit: z.number().nonnegative().default(0),
            credit: z.number().nonnegative().default(0),
            hsn: z.string().optional(),
            gstRate: z.number().nonnegative().optional(),
            taxType: z.enum(['CGST', 'SGST', 'IGST', 'CESS']).optional(),
        })).min(2),
    }).parse(body);

    const totalDebit = payload.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = payload.lines.reduce((sum, line) => sum + line.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
        return c.json({ ok: false, message: 'Journal entry is not balanced.' }, 400);
    }

    const db = c.get('db');
    const uniqueAccountIds = [...new Set(payload.lines.map((line) => line.accountId))];
    const accountRows = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, effectiveUserId), inArray(accounts.id, uniqueAccountIds)));

    if (accountRows.length !== uniqueAccountIds.length) {
        return c.json({ ok: false, message: 'One or more accounts are invalid for this business.' }, 400);
    }

    const entryId = nanoid();
    const now = new Date();

    await db.transaction(async (tx) => {
        await tx.insert(journalEntries).values({
            id: entryId,
            userId: effectiveUserId,
            entryDate: payload.entryDate ?? now,
            batchNumber: payload.batchNumber ?? null,
            referenceType: payload.referenceType ?? null,
            referenceId: payload.referenceId ?? null,
            narration: payload.narration ?? null,
            currency: (payload.currency ?? 'INR').toUpperCase(),
            createdAt: now,
        });

        for (const line of payload.lines) {
            await tx.insert(journalLines).values({
                id: nanoid(),
                entryId,
                userId: effectiveUserId,
                accountId: line.accountId,
                partyId: line.partyId ?? null,
                debit: line.debit,
                credit: line.credit,
                hsn: line.hsn ?? null,
                gstRate: line.gstRate ?? 0,
                taxType: line.taxType ?? null,
                createdAt: now,
            });
        }
    });

    return c.json({ ok: true, entryId });
});

accountingRoute.get('/trial-balance', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const start = dateParam.parse(c.req.query('start'));
    const end = dateParam.parse(c.req.query('end'));
    const db = c.get('db');

    const accountRows = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, effectiveUserId))
        .orderBy(asc(accounts.code));

    const entryConditions = [eq(journalEntries.userId, effectiveUserId)];
    if (start) entryConditions.push(gte(journalEntries.entryDate, start));
    if (end) entryConditions.push(lte(journalEntries.entryDate, end));

    const entries = await db
        .select({ id: journalEntries.id })
        .from(journalEntries)
        .where(and(...entryConditions));
    const entryIds = entries.map((entry) => entry.id);

    const lineRows = entryIds.length === 0
        ? []
        : await db
            .select({
                accountId: journalLines.accountId,
                debit: journalLines.debit,
                credit: journalLines.credit,
            })
            .from(journalLines)
            .where(and(eq(journalLines.userId, effectiveUserId), inArray(journalLines.entryId, entryIds)));

    const totalsByAccount = new Map<string, { debit: number; credit: number }>();
    for (const line of lineRows) {
        const current = totalsByAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
        current.debit += Number(line.debit ?? 0);
        current.credit += Number(line.credit ?? 0);
        totalsByAccount.set(line.accountId, current);
    }

    const rows = accountRows.map((account) => {
        const totals = totalsByAccount.get(account.id) ?? { debit: 0, credit: 0 };
        const balance = totals.debit - totals.credit;
        return {
            accountId: account.id,
            code: account.code,
            name: account.name,
            type: account.type,
            debit: totals.debit,
            credit: totals.credit,
            balance,
        };
    });

    const summary = rows.reduce((acc, row) => {
        acc.totalDebit += row.debit;
        acc.totalCredit += row.credit;
        return acc;
    }, { totalDebit: 0, totalCredit: 0 });

    return c.json({
        ok: true,
        period: { start, end },
        rows,
        summary: {
            ...summary,
            isBalanced: Math.abs(summary.totalDebit - summary.totalCredit) < 0.001,
        },
    });
});

accountingRoute.get('/gst/summary', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const start = dateParam.parse(c.req.query('start'));
    const end = dateParam.parse(c.req.query('end'));
    const db = c.get('db');

    const conditions = [eq(transactions.userId, effectiveUserId)];
    if (start) conditions.push(gte(transactions.billDate, start));
    if (end) conditions.push(lte(transactions.billDate, end));

    const txnRows = await db
        .select()
        .from(transactions)
        .where(and(...conditions));

    const itemRows = await db
        .select({ id: items.id, hsn: items.hsn })
        .from(items)
        .where(eq(items.userId, effectiveUserId));
    const hsnByItem = new Map(itemRows.map((item) => [item.id, item.hsn ?? 'UNSPECIFIED']));

    const byHsn = new Map<string, { taxableValue: number; gstAmount: number; qty: number }>();
    let outputTax = 0;
    let inputTax = 0;
    let taxableTurnover = 0;

    for (const tx of txnRows) {
        for (const line of tx.items) {
            const taxable = Number(line.quantity) * Number(line.price);
            const gstAmount = taxable * (Number(line.tax ?? 0) / 100);
            const hsn = hsnByItem.get(line.id) ?? 'UNSPECIFIED';

            const bucket = byHsn.get(hsn) ?? { taxableValue: 0, gstAmount: 0, qty: 0 };
            bucket.taxableValue += taxable;
            bucket.gstAmount += gstAmount;
            bucket.qty += Number(line.quantity);
            byHsn.set(hsn, bucket);

            taxableTurnover += taxable;
            if (tx.type === 'SALE') outputTax += gstAmount;
            if (tx.type === 'PURCHASE') inputTax += gstAmount;
        }
    }

    return c.json({
        ok: true,
        period: { start, end },
        taxableTurnover,
        outputTax,
        inputTax,
        netGstPayable: outputTax - inputTax,
        byHsn: [...byHsn.entries()].map(([hsn, value]) => ({
            hsn,
            taxableValue: value.taxableValue,
            gstAmount: value.gstAmount,
            quantity: value.qty,
        })).sort((a, b) => b.taxableValue - a.taxableValue),
    });
});

accountingRoute.get('/profit-loss', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const start = dateParam.parse(c.req.query('start'));
    const end = dateParam.parse(c.req.query('end'));
    const db = c.get('db');

    const accountRows = await db
        .select({
            id: accounts.id,
            code: accounts.code,
            name: accounts.name,
            type: accounts.type,
        })
        .from(accounts)
        .where(
            and(
                eq(accounts.userId, effectiveUserId),
                inArray(accounts.type, ['INCOME', 'EXPENSE'])
            )
        )
        .orderBy(asc(accounts.code));

    const entryConditions = [eq(journalEntries.userId, effectiveUserId)];
    if (start) entryConditions.push(gte(journalEntries.entryDate, start));
    if (end) entryConditions.push(lte(journalEntries.entryDate, end));

    const entryRows = await db
        .select({ id: journalEntries.id })
        .from(journalEntries)
        .where(and(...entryConditions));
    const entryIds = entryRows.map((entry) => entry.id);
    const accountIds = accountRows.map((account) => account.id);

    const lineRows = entryIds.length === 0 || accountIds.length === 0
        ? []
        : await db
            .select({
                accountId: journalLines.accountId,
                debit: journalLines.debit,
                credit: journalLines.credit,
            })
            .from(journalLines)
            .where(
                and(
                    eq(journalLines.userId, effectiveUserId),
                    inArray(journalLines.entryId, entryIds),
                    inArray(journalLines.accountId, accountIds)
                )
            );

    const totalsByAccount = new Map<string, { debit: number; credit: number }>();
    for (const line of lineRows) {
        const totals = totalsByAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
        totals.debit += Number(line.debit ?? 0);
        totals.credit += Number(line.credit ?? 0);
        totalsByAccount.set(line.accountId, totals);
    }

    const incomeRows: Array<{ accountId: string; code: string; name: string; debit: number; credit: number; net: number }> = [];
    const expenseRows: Array<{ accountId: string; code: string; name: string; debit: number; credit: number; net: number }> = [];

    for (const account of accountRows) {
        const totals = totalsByAccount.get(account.id) ?? { debit: 0, credit: 0 };
        if (account.type === 'INCOME') {
            incomeRows.push({
                accountId: account.id,
                code: account.code,
                name: account.name,
                debit: roundAmount(totals.debit),
                credit: roundAmount(totals.credit),
                net: roundAmount(totals.credit - totals.debit),
            });
            continue;
        }

        expenseRows.push({
            accountId: account.id,
            code: account.code,
            name: account.name,
            debit: roundAmount(totals.debit),
            credit: roundAmount(totals.credit),
            net: roundAmount(totals.debit - totals.credit),
        });
    }

    const totalIncome = roundAmount(incomeRows.reduce((sum, row) => sum + row.net, 0));
    const totalExpenses = roundAmount(expenseRows.reduce((sum, row) => sum + row.net, 0));
    const netProfit = roundAmount(totalIncome - totalExpenses);

    return c.json({
        ok: true,
        period: { start, end },
        income: incomeRows,
        expenses: expenseRows,
        totalIncome,
        totalExpenses,
        netProfit,
    });
});

accountingRoute.get('/balance-sheet', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const asOf = dateParam.parse(c.req.query('asOf')) ?? new Date();
    const db = c.get('db');

    const accountRows = await db
        .select({
            id: accounts.id,
            code: accounts.code,
            name: accounts.name,
            type: accounts.type,
        })
        .from(accounts)
        .where(
            and(
                eq(accounts.userId, effectiveUserId),
                inArray(accounts.type, ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'])
            )
        )
        .orderBy(asc(accounts.code));

    const entryRows = await db
        .select({ id: journalEntries.id })
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, effectiveUserId), lte(journalEntries.entryDate, asOf)));
    const entryIds = entryRows.map((entry) => entry.id);
    const accountIds = accountRows.map((account) => account.id);

    const lineRows = entryIds.length === 0 || accountIds.length === 0
        ? []
        : await db
            .select({
                accountId: journalLines.accountId,
                debit: journalLines.debit,
                credit: journalLines.credit,
            })
            .from(journalLines)
            .where(
                and(
                    eq(journalLines.userId, effectiveUserId),
                    inArray(journalLines.entryId, entryIds),
                    inArray(journalLines.accountId, accountIds)
                )
            );

    const totalsByAccount = new Map<string, { debit: number; credit: number }>();
    for (const line of lineRows) {
        const totals = totalsByAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
        totals.debit += Number(line.debit ?? 0);
        totals.credit += Number(line.credit ?? 0);
        totalsByAccount.set(line.accountId, totals);
    }

    const assets: Array<{ accountId: string; code: string; name: string; balance: number }> = [];
    const liabilities: Array<{ accountId: string; code: string; name: string; balance: number }> = [];
    const equity: Array<{ accountId: string; code: string; name: string; balance: number }> = [];

    let totalIncome = 0;
    let totalExpense = 0;

    for (const account of accountRows) {
        const totals = totalsByAccount.get(account.id) ?? { debit: 0, credit: 0 };

        if (account.type === 'INCOME') {
            totalIncome += totals.credit - totals.debit;
            continue;
        }
        if (account.type === 'EXPENSE') {
            totalExpense += totals.debit - totals.credit;
            continue;
        }

        const balance = account.type === 'ASSET'
            ? totals.debit - totals.credit
            : totals.credit - totals.debit;
        const roundedBalance = roundAmount(balance);

        if (Math.abs(roundedBalance) < 0.001) continue;

        const row = {
            accountId: account.id,
            code: account.code,
            name: account.name,
            balance: roundedBalance,
        };

        if (account.type === 'ASSET') assets.push(row);
        if (account.type === 'LIABILITY') liabilities.push(row);
        if (account.type === 'EQUITY') equity.push(row);
    }

    const retainedEarnings = roundAmount(totalIncome - totalExpense);
    const totalAssets = roundAmount(assets.reduce((sum, row) => sum + row.balance, 0));
    const totalLiabilities = roundAmount(liabilities.reduce((sum, row) => sum + row.balance, 0));
    const totalEquityWithoutRetained = roundAmount(equity.reduce((sum, row) => sum + row.balance, 0));
    const totalEquity = roundAmount(totalEquityWithoutRetained + retainedEarnings);
    const equationDelta = roundAmount(totalAssets - (totalLiabilities + totalEquity));

    return c.json({
        ok: true,
        asOf,
        assets: { rows: assets, totalAssets },
        liabilities: { rows: liabilities, totalLiabilities },
        equity: {
            rows: equity,
            retainedEarnings,
            totalEquity,
        },
        equationDelta,
        isBalanced: Math.abs(equationDelta) < 0.01,
    });
});

accountingRoute.get('/inventory/valuation', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const db = c.get('db');
    const itemRows = await db
        .select({
            id: items.id,
            name: items.name,
            stock: items.stock,
            purchasePrice: items.purchasePrice,
            sellingPrice: items.price,
            minimumStock: items.minimumStock,
            unit: items.unit,
            category: items.category,
            isActive: items.isActive,
        })
        .from(items)
        .where(eq(items.userId, effectiveUserId));

    const rows = itemRows
        .filter((item) => item.isActive !== false && Number(item.stock) > 0)
        .map((item) => {
            const stock = Number(item.stock ?? 0);
            const purchasePrice = Number(item.purchasePrice ?? 0);
            const sellingPrice = Number(item.sellingPrice ?? 0);
            return {
                itemId: item.id,
                name: item.name,
                category: item.category ?? null,
                stock,
                unit: item.unit ?? 'pcs',
                minimumStock: Number(item.minimumStock ?? 0),
                costValue: roundAmount(stock * purchasePrice),
                retailValue: roundAmount(stock * sellingPrice),
            };
        });

    const totalCostValue = roundAmount(rows.reduce((sum, row) => sum + row.costValue, 0));
    const totalRetailValue = roundAmount(rows.reduce((sum, row) => sum + row.retailValue, 0));
    const lowStockCount = rows.filter((row) => row.minimumStock > 0 && row.stock <= row.minimumStock).length;

    return c.json({
        ok: true,
        totalCostValue,
        totalRetailValue,
        potentialGrossMargin: roundAmount(totalRetailValue - totalCostValue),
        lowStockCount,
        rows: rows.sort((a, b) => b.costValue - a.costValue),
    });
});

accountingRoute.get('/inventory/reorder-suggestions', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const db = c.get('db');
    const itemRows = await db
        .select({
            id: items.id,
            name: items.name,
            stock: items.stock,
            minimumStock: items.minimumStock,
            purchasePrice: items.purchasePrice,
            unit: items.unit,
            category: items.category,
            isActive: items.isActive,
        })
        .from(items)
        .where(eq(items.userId, effectiveUserId));

    const suggestions = itemRows
        .filter((item) => item.isActive !== false)
        .map((item) => {
            const stock = Number(item.stock ?? 0);
            const minimumStock = Number(item.minimumStock ?? 0);
            const shortage = Math.max(minimumStock - stock, 0);
            const targetStock = minimumStock > 0 ? minimumStock * 2 : 0;
            const suggestedOrderQty = minimumStock > 0 ? Math.max(targetStock - stock, shortage) : 0;
            const purchasePrice = Number(item.purchasePrice ?? 0);

            return {
                itemId: item.id,
                name: item.name,
                category: item.category ?? null,
                unit: item.unit ?? 'pcs',
                stock,
                minimumStock,
                shortage,
                suggestedOrderQty,
                estimatedCost: roundAmount(suggestedOrderQty * purchasePrice),
            };
        })
        .filter((row) => row.shortage > 0)
        .sort((a, b) => b.shortage - a.shortage);

    return c.json({
        ok: true,
        count: suggestions.length,
        suggestions,
    });
});

accountingRoute.get('/inventory/stock-aging', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const db = c.get('db');
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;

    const itemRows = await db
        .select({
            id: items.id,
            name: items.name,
            stock: items.stock,
            purchasePrice: items.purchasePrice,
            unit: items.unit,
            category: items.category,
            isActive: items.isActive,
            createdAt: items.createdAt,
        })
        .from(items)
        .where(eq(items.userId, effectiveUserId));

    const movementRows = await db
        .select({
            itemId: inventoryMovements.itemId,
            createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements)
        .where(eq(inventoryMovements.userId, effectiveUserId))
        .orderBy(asc(inventoryMovements.createdAt));

    const lastMovementByItemId = new Map<string, Date>();
    for (const movement of movementRows) {
        const current = lastMovementByItemId.get(movement.itemId);
        if (!current || movement.createdAt > current) {
            lastMovementByItemId.set(movement.itemId, movement.createdAt);
        }
    }

    const summary = new Map<'0-30' | '31-60' | '61-90' | '90+', { count: number; quantity: number; costValue: number }>([
        ['0-30', { count: 0, quantity: 0, costValue: 0 }],
        ['31-60', { count: 0, quantity: 0, costValue: 0 }],
        ['61-90', { count: 0, quantity: 0, costValue: 0 }],
        ['90+', { count: 0, quantity: 0, costValue: 0 }],
    ]);

    const rows = itemRows
        .filter((item) => item.isActive !== false && Number(item.stock) > 0)
        .map((item) => {
            const stock = Number(item.stock ?? 0);
            const lastMovementAt = lastMovementByItemId.get(item.id) ?? item.createdAt;
            const ageDays = Math.max(0, Math.floor((now.getTime() - lastMovementAt.getTime()) / msPerDay));
            const bucket = getAgeBucket(ageDays);
            const costValue = roundAmount(stock * Number(item.purchasePrice ?? 0));

            const bucketSummary = summary.get(bucket);
            if (bucketSummary) {
                bucketSummary.count += 1;
                bucketSummary.quantity += stock;
                bucketSummary.costValue += costValue;
            }

            return {
                itemId: item.id,
                name: item.name,
                category: item.category ?? null,
                stock,
                unit: item.unit ?? 'pcs',
                ageDays,
                bucket,
                lastMovementAt,
                costValue,
            };
        })
        .sort((a, b) => b.ageDays - a.ageDays);

    return c.json({
        ok: true,
        asOf: now,
        summary: [...summary.entries()].map(([bucket, value]) => ({
            bucket,
            itemCount: value.count,
            quantity: roundAmount(value.quantity),
            costValue: roundAmount(value.costValue),
        })),
        rows,
    });
});

accountingRoute.get('/stock-ledger/:itemId', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const itemId = c.req.param('itemId');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 2000);
    const db = c.get('db');

    const rows = await db
        .select()
        .from(inventoryMovements)
        .where(and(eq(inventoryMovements.userId, effectiveUserId), eq(inventoryMovements.itemId, itemId)))
        .orderBy(asc(inventoryMovements.createdAt))
        .limit(limit);

    return c.json({ ok: true, movements: rows });
});

export default accountingRoute;
