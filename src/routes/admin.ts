import { Hono } from 'hono';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { offers, plans, users } from '../db/schema';
import { isDeveloperAdminPrincipal, requireAuth, requireDeveloperAdmin, type AppEnv } from '../middleware/auth';
import { z } from 'zod';
import { DEFAULT_SERVER_PLANS } from '../constants/defaultPlans';

const adminRoute = new Hono<AppEnv>();
const parseBoolean = (value: string | undefined, fallback = false) => {
    if (value === undefined) return fallback;
    return value.toLowerCase() === 'true';
};

adminRoute.get('/access', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, canAccess: false }, 401);

    return c.json({
        ok: true,
        canAccess: isDeveloperAdminPrincipal(authUser, c.env),
        role: authUser.role,
        uid: authUser.uid,
        email: authUser.email ?? null,
    });
});

// GET /admin/users - List all users with subscription status
adminRoute.get('/users', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 1000);
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
    return c.json({ ok: true, users: allUsers });
});

// GET /admin/users/:uid - User detail
adminRoute.get('/users/:uid', requireDeveloperAdmin, async (c) => {
    const uid = c.req.param('uid');
    const db = c.get('db');
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!rows[0]) return c.json({ ok: false, message: 'User not found.' }, 404);
    return c.json({ ok: true, user: rows[0] });
});

// PATCH /admin/users/:uid - Update user profile/subscription fields
adminRoute.patch('/users/:uid', requireDeveloperAdmin, async (c) => {
    const uid = c.req.param('uid');
    const db = c.get('db');
    const body = await c.req.json();

    const payload = z.object({
        displayName: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        businessName: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        gstEnabled: z.boolean().optional(),
        gstNumber: z.string().nullable().optional(),
        currency: z.string().nullable().optional(),
        role: z.enum(['owner', 'staff', 'admin']).optional(),
        ownerId: z.string().nullable().optional(),
        subscriptionStatus: z.enum(['active', 'inactive', 'canceled', 'expired']).optional(),
        subscriptionPlanId: z.string().nullable().optional(),
        subscriptionPlanName: z.string().nullable().optional(),
        subscriptionAmountMonthly: z.number().nonnegative().nullable().optional(),
        subscriptionCurrency: z.string().nullable().optional(),
        subscriptionStartsAt: z.coerce.date().nullable().optional(),
        subscriptionEndsAt: z.coerce.date().nullable().optional(),
    }).parse(body);

    const updated = await db
        .update(users)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(users.uid, uid))
        .returning({ uid: users.uid });

    if (!updated[0]) return c.json({ ok: false, message: 'User not found.' }, 404);
    return c.json({ ok: true });
});

// PUT /admin/users/:uid - Full update alias
adminRoute.put('/users/:uid', requireDeveloperAdmin, async (c) => {
    const uid = c.req.param('uid');
    const db = c.get('db');
    const body = await c.req.json();
    const payload = z.object({
        displayName: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        businessName: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        gstEnabled: z.boolean().optional(),
        gstNumber: z.string().nullable().optional(),
        currency: z.string().nullable().optional(),
        role: z.enum(['owner', 'staff', 'admin']).optional(),
        ownerId: z.string().nullable().optional(),
        subscriptionStatus: z.enum(['active', 'inactive', 'canceled', 'expired']).optional(),
        subscriptionPlanId: z.string().nullable().optional(),
        subscriptionPlanName: z.string().nullable().optional(),
        subscriptionAmountMonthly: z.number().nonnegative().nullable().optional(),
        subscriptionCurrency: z.string().nullable().optional(),
        subscriptionStartsAt: z.coerce.date().nullable().optional(),
        subscriptionEndsAt: z.coerce.date().nullable().optional(),
    }).parse(body);

    const updated = await db
        .update(users)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(users.uid, uid))
        .returning({ uid: users.uid });

    if (!updated[0]) return c.json({ ok: false, message: 'User not found.' }, 404);
    return c.json({ ok: true });
});

// PATCH /admin/users/:uid/role - Update only role
adminRoute.patch('/users/:uid/role', requireDeveloperAdmin, async (c) => {
    const uid = c.req.param('uid');
    const db = c.get('db');
    const body = await c.req.json();
    const payload = z.object({
        role: z.enum(['owner', 'staff', 'admin']),
    }).parse(body);

    const updated = await db
        .update(users)
        .set({ role: payload.role, updatedAt: new Date() })
        .where(eq(users.uid, uid))
        .returning({ uid: users.uid });

    if (!updated[0]) return c.json({ ok: false, message: 'User not found.' }, 404);
    return c.json({ ok: true });
});

// POST /admin/users/:uid/subscription - Manually assign subscription
adminRoute.post('/users/:uid/subscription', requireDeveloperAdmin, async (c) => {
    const uid = c.req.param('uid');
    const db = c.get('db');
    const body = await c.req.json();

    // Schema validation
    const schema = z.object({
        planId: z.string().min(1),
        status: z.enum(['active', 'inactive', 'canceled', 'expired']),
        durationDays: z.number().int().positive().default(30),
    });

    const payload = schema.parse(body);

    const plan = await db.select().from(plans).where(eq(plans.id, payload.planId)).limit(1);
    const planDetails = plan[0];

    // Calculate dates
    const now = new Date();
    const startsAt = now;
    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + payload.durationDays);

    await db.update(users).set({
        subscriptionStatus: payload.status,
        subscriptionPlanId: payload.planId,
        subscriptionPlanName: planDetails?.name || 'Manual Plan',
        subscriptionAmountMonthly: planDetails?.monthlyPrice || 0,
        subscriptionCurrency: planDetails?.currency || 'INR',
        subscriptionStartsAt: startsAt,
        subscriptionEndsAt: endsAt,
        updatedAt: now,
    }).where(eq(users.uid, uid));

    return c.json({ ok: true, message: 'Subscription updated' });
});

// DELETE /admin/users/:uid - Remove user
adminRoute.delete('/users/:uid', requireDeveloperAdmin, async (c) => {
    const uid = c.req.param('uid');
    const db = c.get('db');
    const deleted = await db.delete(users).where(eq(users.uid, uid)).returning({ uid: users.uid });
    if (!deleted[0]) return c.json({ ok: false, message: 'User not found.' }, 404);
    return c.json({ ok: true });
});

// GET /admin/plans
adminRoute.get('/plans', requireDeveloperAdmin, async (c) => {
    const includeInactive = parseBoolean(c.req.query('includeInactive'), true);
    const db = c.get('db');

    const data = await db
        .select()
        .from(plans)
        .where(includeInactive ? sql`true` : eq(plans.isActive, true))
        .orderBy(asc(plans.displayOrder), asc(plans.name));

    return c.json({ ok: true, plans: data });
});

// GET /admin/plans/:id
adminRoute.get('/plans/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const rows = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
    if (!rows[0]) return c.json({ ok: false, message: 'Plan not found.' }, 404);
    return c.json({ ok: true, plan: rows[0] });
});

// POST /admin/plans
adminRoute.post('/plans', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const body = await c.req.json();
    const payload = z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().min(1),
        monthlyPrice: z.number().nonnegative(),
        currency: z.string().min(3).max(6),
        isActive: z.boolean().default(true),
        displayOrder: z.number().int().default(0),
        features: z.array(z.string().min(1)).default([]),
    }).parse(body);

    const now = new Date();
    await db.insert(plans).values({
        id: payload.id,
        name: payload.name,
        description: payload.description,
        monthlyPrice: payload.monthlyPrice,
        currency: payload.currency.toUpperCase(),
        isActive: payload.isActive,
        displayOrder: payload.displayOrder,
        features: payload.features,
        createdAt: now,
        updatedAt: now,
    });

    return c.json({ ok: true, id: payload.id });
});

// PUT /admin/plans/:id - Upsert plan
adminRoute.put('/plans/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const body = await c.req.json();
    const payload = z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        monthlyPrice: z.number().nonnegative(),
        currency: z.string().min(3).max(6),
        isActive: z.boolean().default(true),
        displayOrder: z.number().int().default(0),
        features: z.array(z.string().min(1)).default([]),
    }).parse(body);

    const now = new Date();
    await db.insert(plans).values({
        id,
        name: payload.name,
        description: payload.description,
        monthlyPrice: payload.monthlyPrice,
        currency: payload.currency.toUpperCase(),
        isActive: payload.isActive,
        displayOrder: payload.displayOrder,
        features: payload.features,
        createdAt: now,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: plans.id,
        set: {
            name: payload.name,
            description: payload.description,
            monthlyPrice: payload.monthlyPrice,
            currency: payload.currency.toUpperCase(),
            isActive: payload.isActive,
            displayOrder: payload.displayOrder,
            features: payload.features,
            updatedAt: now,
        },
    });

    return c.json({ ok: true });
});

// PATCH /admin/plans/:id
adminRoute.patch('/plans/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const body = await c.req.json();
    const payload = z.object({
        name: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        monthlyPrice: z.number().nonnegative().optional(),
        currency: z.string().min(3).max(6).optional(),
        isActive: z.boolean().optional(),
        displayOrder: z.number().int().optional(),
        features: z.array(z.string().min(1)).optional(),
    }).parse(body);

    const updated = await db
        .update(plans)
        .set({
            ...payload,
            currency: payload.currency ? payload.currency.toUpperCase() : undefined,
            updatedAt: new Date(),
        })
        .where(eq(plans.id, id))
        .returning({ id: plans.id });

    if (!updated[0]) return c.json({ ok: false, message: 'Plan not found.' }, 404);
    return c.json({ ok: true });
});

// DELETE /admin/plans/:id
adminRoute.delete('/plans/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const deleted = await db.delete(plans).where(eq(plans.id, id)).returning({ id: plans.id });
    if (!deleted[0]) return c.json({ ok: false, message: 'Plan not found.' }, 404);
    return c.json({ ok: true });
});

// GET /admin/offers
adminRoute.get('/offers', requireDeveloperAdmin, async (c) => {
    const includeInactive = parseBoolean(c.req.query('includeInactive'), true);
    const db = c.get('db');

    const data = await db
        .select()
        .from(offers)
        .where(includeInactive ? sql`true` : eq(offers.isActive, true))
        .orderBy(desc(offers.priority), desc(offers.createdAt));

    return c.json({ ok: true, offers: data });
});

// GET /admin/offers/:id
adminRoute.get('/offers/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const rows = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
    if (!rows[0]) return c.json({ ok: false, message: 'Offer not found.' }, 404);
    return c.json({ ok: true, offer: rows[0] });
});

// POST /admin/offers
adminRoute.post('/offers', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const body = await c.req.json();
    const payload = z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        message: z.string().min(1),
        bannerUrl: z.string().nullable().optional(),
        bannerBackground: z.string().nullable().optional(),
        ctaText: z.string().nullable().optional(),
        ctaRoute: z.string().nullable().optional(),
        audience: z.enum(['all', 'active_subscribers', 'inactive_subscribers']).default('all'),
        isActive: z.boolean().default(true),
        priority: z.number().int().default(0),
        startsAt: z.coerce.date().nullable().optional(),
        endsAt: z.coerce.date().nullable().optional(),
    }).parse(body);

    const now = new Date();
    await db.insert(offers).values({
        id: payload.id,
        title: payload.title,
        message: payload.message,
        bannerUrl: payload.bannerUrl ?? null,
        bannerBackground: payload.bannerBackground ?? null,
        ctaText: payload.ctaText ?? null,
        ctaRoute: payload.ctaRoute ?? null,
        audience: payload.audience,
        isActive: payload.isActive,
        priority: payload.priority,
        startsAt: payload.startsAt ?? null,
        endsAt: payload.endsAt ?? null,
        createdAt: now,
        updatedAt: now,
    });

    return c.json({ ok: true, id: payload.id });
});

// PUT /admin/offers/:id - Upsert offer
adminRoute.put('/offers/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const body = await c.req.json();
    const payload = z.object({
        title: z.string().min(1),
        message: z.string().min(1),
        bannerUrl: z.string().nullable().optional(),
        bannerBackground: z.string().nullable().optional(),
        ctaText: z.string().nullable().optional(),
        ctaRoute: z.string().nullable().optional(),
        audience: z.enum(['all', 'active_subscribers', 'inactive_subscribers']).default('all'),
        isActive: z.boolean().default(true),
        priority: z.number().int().default(0),
        startsAt: z.coerce.date().nullable().optional(),
        endsAt: z.coerce.date().nullable().optional(),
    }).parse(body);

    const now = new Date();
    await db.insert(offers).values({
        id,
        title: payload.title,
        message: payload.message,
        bannerUrl: payload.bannerUrl ?? null,
        bannerBackground: payload.bannerBackground ?? null,
        ctaText: payload.ctaText ?? null,
        ctaRoute: payload.ctaRoute ?? null,
        audience: payload.audience,
        isActive: payload.isActive,
        priority: payload.priority,
        startsAt: payload.startsAt ?? null,
        endsAt: payload.endsAt ?? null,
        createdAt: now,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: offers.id,
        set: {
            title: payload.title,
            message: payload.message,
            bannerUrl: payload.bannerUrl ?? null,
            bannerBackground: payload.bannerBackground ?? null,
            ctaText: payload.ctaText ?? null,
            ctaRoute: payload.ctaRoute ?? null,
            audience: payload.audience,
            isActive: payload.isActive,
            priority: payload.priority,
            startsAt: payload.startsAt ?? null,
            endsAt: payload.endsAt ?? null,
            updatedAt: now,
        },
    });

    return c.json({ ok: true });
});

// PATCH /admin/offers/:id/active
adminRoute.patch('/offers/:id/active', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const body = await c.req.json();
    const payload = z.object({ isActive: z.boolean() }).parse(body);

    const updated = await db
        .update(offers)
        .set({ isActive: payload.isActive, updatedAt: new Date() })
        .where(eq(offers.id, id))
        .returning({ id: offers.id });

    if (!updated[0]) return c.json({ ok: false, message: 'Offer not found.' }, 404);
    return c.json({ ok: true });
});

// PATCH /admin/offers/:id
adminRoute.patch('/offers/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const body = await c.req.json();
    const payload = z.object({
        title: z.string().min(1).optional(),
        message: z.string().min(1).optional(),
        bannerUrl: z.string().nullable().optional(),
        bannerBackground: z.string().nullable().optional(),
        ctaText: z.string().nullable().optional(),
        ctaRoute: z.string().nullable().optional(),
        audience: z.enum(['all', 'active_subscribers', 'inactive_subscribers']).optional(),
        isActive: z.boolean().optional(),
        priority: z.number().int().optional(),
        startsAt: z.coerce.date().nullable().optional(),
        endsAt: z.coerce.date().nullable().optional(),
    }).parse(body);

    const updated = await db
        .update(offers)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(offers.id, id))
        .returning({ id: offers.id });

    if (!updated[0]) return c.json({ ok: false, message: 'Offer not found.' }, 404);
    return c.json({ ok: true });
});

// DELETE /admin/offers/:id
adminRoute.delete('/offers/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const deleted = await db.delete(offers).where(eq(offers.id, id)).returning({ id: offers.id });
    if (!deleted[0]) return c.json({ ok: false, message: 'Offer not found.' }, 404);
    return c.json({ ok: true });
});

// POST /admin/seed/default-plans
adminRoute.post('/seed/default-plans', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const now = new Date();

    await db.transaction(async (tx) => {
        for (const entry of DEFAULT_SERVER_PLANS) {
            await tx.insert(plans).values({
                ...entry,
                createdAt: now,
                updatedAt: now,
            }).onConflictDoUpdate({
                target: plans.id,
                set: {
                    name: entry.name,
                    description: entry.description,
                    monthlyPrice: entry.monthlyPrice,
                    currency: entry.currency,
                    isActive: entry.isActive,
                    displayOrder: entry.displayOrder,
                    features: entry.features,
                    updatedAt: now,
                },
            });
        }
    });

    return c.json({ ok: true });
});

export default adminRoute;
