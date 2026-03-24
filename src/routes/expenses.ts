import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { expenses } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    getAccessibleBusiness,
    getRequestedBusinessId,
    getActiveSubscription,
    requireOrganizationCapability,
} from './helpers';
import { nanoid } from 'nanoid';
import { assertModuleEnabled, assertSubscriptionWriteAllowed } from '../services/subscriptionPolicy';

const expensesRoute = new Hono<AppEnv>();

expensesRoute.use('/*', requireAuth);

const createExpenseSchema = z.object({
    id: z.string().trim().min(1).optional(),
    category: z.enum([
        'MANUFACTURING', 'PETROL', 'RENT', 'SALARY',
        'TEA_AND_REFRESHMENTS', 'TRANSPORT', 'MISCELLANEOUS',
    ]),
    amount: z.number().positive(),
    date: z.coerce.date().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    paymentMode: z.enum(['CASH', 'BANK', 'UPI', 'CHEQUE', 'CARD']).default('CASH'),
    partyId: z.string().optional().nullable(),
    receiptUrl: z.string().url().optional().nullable(),
    accountId: z.string().optional().nullable(),
});

// List expenses
expensesRoute.get('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'expenses.read');
    if (denied) return denied;
    assertModuleEnabled(business, 'accounts');

    const from = c.req.query('from');
    const to = c.req.query('to');
    const category = c.req.query('category');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const offset = Number(c.req.query('offset') ?? 0);

    const conditions = [
        eq(expenses.businessId, business.id),
        eq(expenses.isDeleted, false),
    ] as ReturnType<typeof eq>[];

    if (from) conditions.push(gte(expenses.date, new Date(from)));
    if (to) conditions.push(lte(expenses.date, new Date(to)));
    if (category) conditions.push(eq(expenses.category, category as typeof expenses.category._.enumValues[number]));

    const rows = await db.select().from(expenses)
        .where(and(...conditions))
        .orderBy(desc(expenses.date))
        .limit(limit)
        .offset(offset);

    return c.json({ ok: true, data: rows });
});

// Get single expense
expensesRoute.get('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'expenses.read');
    if (denied) return denied;
    assertModuleEnabled(business, 'accounts');

    const id = c.req.param('id');
    if (id === 'recycle-bin') {
        const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
        const deletedRows = await db.select().from(expenses)
            .where(and(eq(expenses.businessId, business.id), eq(expenses.isDeleted, true)))
            .orderBy(desc(expenses.updatedAt))
            .limit(limit);
        return c.json({ ok: true, data: deletedRows });
    }

    const [row] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.businessId, business.id)));
    if (!row) return c.json({ ok: false, message: 'Expense not found' }, 404);
    return c.json({ ok: true, data: row });
});

// Create expense
expensesRoute.post('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'expenses.write');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounts');

    try {
        const body = createExpenseSchema.parse(await c.req.json());
        const now = new Date();
        if (body.id) {
            const existing = await db.select().from(expenses).where(and(
                eq(expenses.id, body.id),
                eq(expenses.businessId, business.id),
            )).limit(1);
            if (existing[0]) {
                return c.json({ ok: true, data: existing[0] });
            }
        }
        const id = body.id?.trim() || `exp_${nanoid(18)}`;

        const [expense] = await db.insert(expenses).values({
            id,
            businessId: business.id,
            category: body.category,
            amount: body.amount,
            date: body.date ? new Date(body.date) : now,
            description: body.description,
            paymentMode: body.paymentMode,
            partyId: body.partyId,
            receiptUrl: body.receiptUrl,
            accountId: body.accountId,
            createdByUserId: authUser.id,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
        }).returning();

        return c.json({ ok: true, data: expense }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Failed to create expense.' }, 400);
    }
});

// Update expense
expensesRoute.put('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'expenses.write');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounts');

    const id = c.req.param('id');
    const [existing] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.businessId, business.id)));
    if (!existing) return c.json({ ok: false, message: 'Expense not found' }, 404);

    try {
        const body = createExpenseSchema.partial().parse(await c.req.json());
        const [updated] = await db.update(expenses).set({
            ...body,
            date: body.date ? new Date(body.date) : undefined,
            updatedAt: new Date(),
        }).where(and(eq(expenses.id, id), eq(expenses.businessId, business.id))).returning();

        return c.json({ ok: true, data: updated });
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Failed to update expense.' }, 400);
    }
});

// Soft-delete expense
expensesRoute.delete('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'expenses.write');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounts');

    const id = c.req.param('id');
    const [existing] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.businessId, business.id)));
    if (!existing) return c.json({ ok: false, message: 'Expense not found' }, 404);

    await db.update(expenses).set({ isDeleted: true, updatedAt: new Date() }).where(eq(expenses.id, id));
    return c.json({ ok: true, message: 'Expense deleted' });
});

// Restore soft-deleted expense
expensesRoute.post('/:id/restore', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'expenses.write');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounts');

    const id = c.req.param('id');
    const [existing] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.businessId, business.id)));
    if (!existing) return c.json({ ok: false, message: 'Expense not found' }, 404);

    await db.update(expenses).set({ isDeleted: false, updatedAt: new Date() }).where(eq(expenses.id, id));
    return c.json({ ok: true, message: 'Expense restored' });
});

// Permanent delete from recycle-bin
expensesRoute.delete('/:id/permanent', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'expenses.write');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'accounts');

    const id = c.req.param('id');
    await db.delete(expenses).where(and(
        eq(expenses.id, id),
        eq(expenses.businessId, business.id),
        eq(expenses.isDeleted, true),
    ));
    return c.json({ ok: true, message: 'Expense permanently deleted' });
});

// Category summary
expensesRoute.get('/reports/by-category', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'expenses.read');
    if (denied) return denied;
    assertModuleEnabled(business, 'accounts');

    const from = c.req.query('from');
    const to = c.req.query('to');

    const conditions = [eq(expenses.businessId, business.id), eq(expenses.isDeleted, false)] as ReturnType<typeof eq>[];
    if (from) conditions.push(gte(expenses.date, new Date(from)));
    if (to) conditions.push(lte(expenses.date, new Date(to)));

    const rows = await db
        .select({
            category: expenses.category,
            total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
            count: sql<number>`COUNT(*)`,
        })
        .from(expenses)
        .where(and(...conditions))
        .groupBy(expenses.category);

    return c.json({ ok: true, data: rows });
});

export default expensesRoute;
