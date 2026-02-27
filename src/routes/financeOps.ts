import { Hono } from 'hono';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { expenses, parties, partyLedgerEntries, paymentEntries } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { ensurePeriodUnlockedForDate, getBusinessControls, writeAuditLog } from '../operations/controls';

const financeOpsRoute = new Hono<AppEnv>();

const roundAmount = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const parseDateInput = (value?: string | null): Date | undefined => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
};

const nextBalanceForParty = async (params: {
    db: any;
    effectiveUserId: string;
    partyId: string;
    delta: number;
}) => {
    const { db, effectiveUserId, partyId, delta } = params;
    const rows = await db
        .select({ runningBalance: partyLedgerEntries.runningBalance })
        .from(partyLedgerEntries)
        .where(and(
            eq(partyLedgerEntries.userId, effectiveUserId),
            eq(partyLedgerEntries.partyId, partyId),
        ))
        .orderBy(desc(partyLedgerEntries.entryDate), desc(partyLedgerEntries.createdAt))
        .limit(1);
    const previous = Number(rows[0]?.runningBalance ?? 0);
    return roundAmount(previous + delta);
};

financeOpsRoute.get('/party-ledger/:partyId', requireAuth, requirePermission('canManageBanking'), async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const partyId = c.req.param('partyId');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 2000);

    const db = c.get('db');
    const partyRows = await db
        .select()
        .from(parties)
        .where(and(
            eq(parties.userId, effectiveUserId),
            eq(parties.id, partyId),
        ))
        .limit(1);
    const party = partyRows[0];
    if (!party) return c.json({ ok: false, message: 'Party not found.' }, 404);

    const rows = await db
        .select()
        .from(partyLedgerEntries)
        .where(and(
            eq(partyLedgerEntries.userId, effectiveUserId),
            eq(partyLedgerEntries.partyId, partyId),
        ))
        .orderBy(desc(partyLedgerEntries.entryDate), desc(partyLedgerEntries.createdAt))
        .limit(limit);

    const currentBalance = Number(rows[0]?.runningBalance ?? 0);

    return c.json({
        ok: true,
        party: {
            id: party.id,
            name: party.name,
            type: party.type,
            phone: party.phone,
            balance: currentBalance,
            balanceColor: currentBalance > 0 ? 'red' : currentBalance < 0 ? 'green' : 'neutral',
            balanceMeaning: currentBalance > 0 ? 'They owe you' : currentBalance < 0 ? 'You owe them/advance' : 'Settled',
        },
        entries: rows,
    });
});

financeOpsRoute.get('/party-balances', requireAuth, requirePermission('canManageBanking'), async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const db = c.get('db');
    const partyRows = await db
        .select()
        .from(parties)
        .where(and(
            eq(parties.userId, effectiveUserId),
            eq(parties.isActive, true),
        ))
        .orderBy(asc(parties.nameLowercase));

    const ledgerRows = await db
        .select()
        .from(partyLedgerEntries)
        .where(eq(partyLedgerEntries.userId, effectiveUserId))
        .orderBy(asc(partyLedgerEntries.entryDate), asc(partyLedgerEntries.createdAt));

    const balanceByPartyId = new Map<string, number>();
    for (const row of ledgerRows) {
        balanceByPartyId.set(row.partyId, Number(row.runningBalance ?? 0));
    }

    const balances = partyRows.map((party) => {
        const balance = roundAmount(balanceByPartyId.get(party.id) ?? 0);
        return {
            partyId: party.id,
            partyName: party.name,
            type: party.type,
            phone: party.phone,
            balance,
            balanceColor: balance > 0 ? 'red' : balance < 0 ? 'green' : 'neutral',
            balanceMeaning: balance > 0 ? 'They owe you' : balance < 0 ? 'You owe them/advance' : 'Settled',
        };
    });

    return c.json({ ok: true, balances });
});

financeOpsRoute.get('/payments', requireAuth, requirePermission('canManageBanking'), async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const start = parseDateInput(c.req.query('start'));
    const end = parseDateInput(c.req.query('end'));
    const partyId = c.req.query('partyId');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 300), 1), 5000);

    const conditions = [
        eq(paymentEntries.userId, effectiveUserId),
    ];
    if (start) conditions.push(gte(paymentEntries.paymentDate, start));
    if (end) conditions.push(lte(paymentEntries.paymentDate, end));
    if (partyId) conditions.push(eq(paymentEntries.partyId, partyId));

    const db = c.get('db');
    const rows = await db
        .select()
        .from(paymentEntries)
        .where(and(...conditions))
        .orderBy(desc(paymentEntries.paymentDate), desc(paymentEntries.createdAt))
        .limit(limit);

    return c.json({ ok: true, payments: rows });
});

financeOpsRoute.post('/payments', requireAuth, requirePermission('canManageBanking'), async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const effectiveOrganizationId = c.get('effectiveOrganizationId') ?? effectiveUserId;
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const payload = z.object({
            partyId: z.string().min(1),
            direction: z.enum(['IN', 'OUT']),
            amount: z.number().positive(),
            paymentDate: z.coerce.date().optional(),
            paymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CARD']).default('CASH'),
            referenceNumber: z.string().optional(),
            narration: z.string().optional(),
        }).parse(await c.req.json());

        const db = c.get('db');
        const paymentDate = payload.paymentDate ?? new Date();
        const controls = await getBusinessControls(db, effectiveUserId);
        if (controls.periodLockEnabled) {
            await ensurePeriodUnlockedForDate(db, effectiveUserId, paymentDate);
        }

        const partyRows = await db
            .select()
            .from(parties)
            .where(and(
                eq(parties.id, payload.partyId),
                eq(parties.userId, effectiveUserId),
            ))
            .limit(1);
        const party = partyRows[0];
        if (!party) return c.json({ ok: false, message: 'Party not found.' }, 404);

        const paymentId = nanoid();
        const now = new Date();
        await db.insert(paymentEntries).values({
            id: paymentId,
            userId: effectiveUserId,
            organizationId: effectiveOrganizationId,
            partyId: payload.partyId,
            direction: payload.direction,
            amount: payload.amount,
            paymentDate,
            paymentMode: payload.paymentMode,
            referenceNumber: payload.referenceNumber ?? null,
            narration: payload.narration ?? null,
            createdByUid: authUser.uid,
            createdAt: now,
        });

        const delta = payload.direction === 'IN' ? -payload.amount : payload.amount;
        const runningBalance = await nextBalanceForParty({
            db,
            effectiveUserId,
            partyId: payload.partyId,
            delta,
        });

        await db.insert(partyLedgerEntries).values({
            id: nanoid(),
            userId: effectiveUserId,
            organizationId: effectiveOrganizationId,
            partyId: payload.partyId,
            sourceType: 'PAYMENT',
            sourceId: paymentId,
            direction: payload.direction === 'IN' ? 'CREDIT' : 'DEBIT',
            amount: payload.amount,
            runningBalance,
            entryDate: paymentDate,
            narration: payload.narration ?? `${payload.direction === 'IN' ? 'Payment received' : 'Payment paid'} via ${payload.paymentMode}`,
            createdByUid: authUser.uid,
            createdAt: now,
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'billing',
            action: 'party.payment_entry_created',
            entityType: 'payment_entry',
            entityId: paymentId,
            after: {
                partyId: payload.partyId,
                direction: payload.direction,
                amount: payload.amount,
                runningBalance,
            },
        });

        return c.json({
            ok: true,
            id: paymentId,
            runningBalance,
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create payment entry.' }, 400);
    }
});

financeOpsRoute.post('/party-ledger/adjust', requireAuth, requirePermission('canManageBanking'), async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const effectiveOrganizationId = c.get('effectiveOrganizationId') ?? effectiveUserId;
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const payload = z.object({
            partyId: z.string().min(1),
            adjustmentType: z.enum(['INCREASE', 'DECREASE']),
            amount: z.number().positive(),
            entryDate: z.coerce.date().optional(),
            narration: z.string().optional(),
        }).parse(await c.req.json());

        const db = c.get('db');
        const delta = payload.adjustmentType === 'INCREASE' ? payload.amount : -payload.amount;
        const runningBalance = await nextBalanceForParty({
            db,
            effectiveUserId,
            partyId: payload.partyId,
            delta,
        });

        const now = new Date();
        const id = nanoid();
        await db.insert(partyLedgerEntries).values({
            id,
            userId: effectiveUserId,
            organizationId: effectiveOrganizationId,
            partyId: payload.partyId,
            sourceType: 'ADJUSTMENT',
            sourceId: null,
            direction: payload.adjustmentType === 'INCREASE' ? 'DEBIT' : 'CREDIT',
            amount: payload.amount,
            runningBalance,
            entryDate: payload.entryDate ?? now,
            narration: payload.narration ?? `Manual adjustment (${payload.adjustmentType})`,
            createdByUid: authUser.uid,
            createdAt: now,
        });

        return c.json({ ok: true, id, runningBalance });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to adjust ledger.' }, 400);
    }
});

financeOpsRoute.get('/expenses', requireAuth, requirePermission('canManageAccounting'), async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const start = parseDateInput(c.req.query('start'));
    const end = parseDateInput(c.req.query('end'));
    const category = c.req.query('category');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 300), 1), 5000);

    const conditions = [
        eq(expenses.userId, effectiveUserId),
    ];
    if (start) conditions.push(gte(expenses.expenseDate, start));
    if (end) conditions.push(lte(expenses.expenseDate, end));
    if (category) conditions.push(eq(expenses.category, category));

    const db = c.get('db');
    const rows = await db
        .select()
        .from(expenses)
        .where(and(...conditions))
        .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
        .limit(limit);

    return c.json({ ok: true, expenses: rows });
});

financeOpsRoute.post('/expenses', requireAuth, requirePermission('canManageAccounting'), async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const effectiveOrganizationId = c.get('effectiveOrganizationId') ?? effectiveUserId;
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const payload = z.object({
            branchId: z.string().optional(),
            expenseDate: z.coerce.date().optional(),
            category: z.string().min(1).max(80),
            amount: z.number().positive(),
            paymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CARD']).default('CASH'),
            paidToPartyId: z.string().optional(),
            paidToName: z.string().optional(),
            costCenter: z.string().optional(),
            projectCode: z.string().optional(),
            notes: z.string().optional(),
            attachmentUrl: z.string().url().optional(),
        }).parse(await c.req.json());

        const db = c.get('db');
        const expenseDate = payload.expenseDate ?? new Date();
        const controls = await getBusinessControls(db, effectiveUserId);
        if (controls.periodLockEnabled) {
            await ensurePeriodUnlockedForDate(db, effectiveUserId, expenseDate);
        }

        const id = nanoid();
        const now = new Date();
        await db.insert(expenses).values({
            id,
            userId: effectiveUserId,
            organizationId: effectiveOrganizationId,

            expenseDate,
            category: payload.category.trim(),
            amount: payload.amount,
            paymentMode: payload.paymentMode,
            paidToPartyId: payload.paidToPartyId ?? null,
            paidToName: payload.paidToName ?? null,
            costCenter: payload.costCenter ?? null,
            projectCode: payload.projectCode ?? null,
            notes: payload.notes ?? null,
            attachmentUrl: payload.attachmentUrl ?? null,
            createdByUid: authUser.uid,
            createdAt: now,
            updatedAt: now,
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'accounting',
            action: 'expense.created',
            entityType: 'expense',
            entityId: id,
            after: {
                category: payload.category,
                amount: payload.amount,
                paymentMode: payload.paymentMode,
            },
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create expense.' }, 400);
    }
});

export default financeOpsRoute;
