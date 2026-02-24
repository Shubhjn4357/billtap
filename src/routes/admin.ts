import { Hono } from 'hono';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { offers, plans, users, templates, organizations, organizationMembers, organizationSettings, transactions, bankAccounts, vouchers, salaryRuns, salaryRunItems, auditLogs } from '../db/schema';
import { withTransaction } from '../db/transaction';
import { isDeveloperAdminPrincipal, requireAuth, requireDeveloperAdmin, type AppEnv } from '../middleware/auth';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { DEFAULT_PLANS } from '../constants/defaultPlans';

const adminRoute = new Hono<AppEnv>();

// GET /admin/organizations - List all organizations
adminRoute.get('/organizations', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 1000);
    const data = await db.select().from(organizations).orderBy(desc(organizations.createdAt)).limit(limit);
    return c.json({ ok: true, organizations: data });
});

// GET /admin/organizations/:id - Get detail
adminRoute.get('/organizations/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!rows[0]) return c.json({ ok: false, message: 'Organization not found.' }, 404);
    return c.json({ ok: true, organization: rows[0] });
});

// POST /admin/organizations - Create organization from admin panel
adminRoute.post('/organizations', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const body = await c.req.json();
    const payload = z.object({
        userId: z.string().optional(),
        name: z.string().min(1),
        code: z.string().min(1),
        gstNumber: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        phoneNumber: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        isActive: z.boolean().default(true),
        currency: z.string().default('INR'),
    }).parse(body);

    const ownerUserId = payload.userId ?? authUser.uid;
    const ownerRow = await db.select({ uid: users.uid, phoneNumber: users.phoneNumber }).from(users).where(eq(users.uid, ownerUserId)).limit(1);
    if (!ownerRow[0]) {
        return c.json({ ok: false, message: `Owner user ${ownerUserId} not found.` }, 400);
    }

    const now = new Date();
    const organizationId = nanoid();

    await withTransaction(db, async (tx) => {
        await tx.insert(organizations).values({
            id: organizationId,
            userId: ownerUserId,
            name: payload.name.trim(),
            code: payload.code.trim().toUpperCase(),
            gstNumber: payload.gstNumber?.trim() || null,
            address: payload.address?.trim() || null,
            phoneNumber: payload.phoneNumber?.trim() || null,
            email: payload.email?.trim().toLowerCase() || null,
            currency: payload.currency.trim().toUpperCase(),
            isActive: payload.isActive,
            createdAt: now,
            updatedAt: now,
        });

        await tx.insert(organizationMembers).values({
            id: nanoid(),
            userId: ownerUserId,
            organizationId,
            role: 'owner',
            permissions: {},
            isActive: true,
            invitedBy: authUser.uid,
            phoneNumberSnapshot: ownerRow[0]?.phoneNumber ?? null,
            joinedAt: now,
            createdAt: now,
            updatedAt: now,
        });

        await tx.insert(organizationSettings).values({
            organizationId,
            userId: ownerUserId,
            settings: {},
            createdAt: now,
            updatedAt: now,
        }).onConflictDoNothing();
    });

    const created = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    return c.json({ ok: true, organization: created[0] ?? null });
});

// GET /admin/transactions - Global view of all bills
adminRoute.get('/transactions', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 1000);

    // Joint query to get organization name
    const data = await db.select({
        id: transactions.id,
        organizationId: transactions.organizationId,
        userId: transactions.userId,
        type: transactions.type,
        totalAmount: transactions.totalAmount,
        paymentStatus: transactions.paymentStatus,
        paymentMode: transactions.paymentMode,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        organizationName: organizations.name,
    })
        .from(transactions)
        .leftJoin(organizations, eq(transactions.organizationId, organizations.id))
        .orderBy(desc(transactions.createdAt))
        .limit(limit);

    return c.json({ ok: true, transactions: data });
});

// PATCH /admin/organizations/:id - Update org
adminRoute.patch('/organizations/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const body = await c.req.json();

    const payload = z.object({
        name: z.string().min(1).optional(),
        code: z.string().min(1).optional(),
        gstNumber: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        phoneNumber: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        isActive: z.boolean().optional(),
        currency: z.string().optional(),
    }).parse(body);

    const updated = await db
        .update(organizations)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(organizations.id, id))
        .returning({ id: organizations.id });

    if (!updated[0]) return c.json({ ok: false, message: 'Organization not found.' }, 404);
    return c.json({ ok: true });
});

// PUT /admin/organizations/:id - Full update alias
adminRoute.put('/organizations/:id', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');
    const body = await c.req.json();

    const payload = z.object({
        name: z.string().min(1).optional(),
        code: z.string().min(1).optional(),
        gstNumber: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        phoneNumber: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        isActive: z.boolean().optional(),
        currency: z.string().optional(),
    }).parse(body);

    const updated = await db
        .update(organizations)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(organizations.id, id))
        .returning({ id: organizations.id });

    if (!updated[0]) return c.json({ ok: false, message: 'Organization not found.' }, 404);
    return c.json({ ok: true });
});

// POST /admin/organizations/:id/toggle-status
adminRoute.post('/organizations/:id/toggle-status', requireDeveloperAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.get('db');

    const org = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org[0]) return c.json({ ok: false, message: 'Organization not found.' }, 404);

    await db.update(organizations)
        .set({ isActive: !org[0].isActive, updatedAt: new Date() })
        .where(eq(organizations.id, id));

    return c.json({ ok: true });
});

const parseBoolean = (value: string | undefined, fallback = false) => {
    if (value === undefined) return fallback;
    return value.toLowerCase() === 'true';
};

// GET /admin/stats - Dashboard analytics
adminRoute.get('/stats', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');

    // Parallelize queries for performance
    const [
        totalUsersResult,
        activeSubsResult,
        revenueResult,
        recentUsers
    ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.subscriptionStatus, 'active')),
        db.select({ total: sql<number>`sum(${users.subscriptionAmountMonthly})` }).from(users).where(eq(users.subscriptionStatus, 'active')),
        db.select().from(users).orderBy(desc(users.createdAt)).limit(5)
    ]);

    const totalUsers = Number(totalUsersResult[0]?.count || 0);
    const activeSubscriptions = Number(activeSubsResult[0]?.count || 0);
    const monthlyRevenue = Number(revenueResult[0]?.total || 0);

    return c.json({
        ok: true,
        stats: {
            totalUsers,
            activeSubscriptions,
            monthlyRevenue,
            recentUsers
        }
    });
});

// GET /admin/treasury/stats - System-wide liquidity
adminRoute.get('/treasury/stats', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');

    const [balanceResult, pendingVouchers] = await Promise.all([
        db.select({ total: sql<number>`sum(${bankAccounts.currentBalance})` }).from(bankAccounts),
        db.select({ count: sql<number>`count(*)` }).from(vouchers).where(eq(vouchers.status, 'draft'))
    ]);

    const totalLiquidity = Number(balanceResult[0]?.total || 0);
    const settlementsPending = Number(pendingVouchers[0]?.count || 0);

    // Recent accounts for table
    const accounts = await db.select().from(bankAccounts).orderBy(desc(bankAccounts.currentBalance)).limit(10);

    return c.json({
        ok: true,
        stats: {
            totalLiquidity,
            settlementsPending,
            institutionalReserve: totalLiquidity * 0.15, // Mock reserve calculation
            netCashFlow: totalLiquidity * 0.08, // Mock flow trend
        },
        accounts
    });
});

// GET /admin/payroll/stats - System-wide payroll overview
adminRoute.get('/payroll/stats', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');

    const [runStats, itemStats] = await Promise.all([
        db.select({
            totalNet: sql<number>`sum(${salaryRuns.totalNet})`,
            runCount: sql<number>`count(*)`
        }).from(salaryRuns),
        db.select({ count: sql<number>`count(*)` }).from(salaryRunItems)
    ]);

    const totalDisbursed = Number(runStats[0]?.totalNet || 0);
    const totalStaff = Number(itemStats[0]?.count || 0);

    // Latest batches
    const latestBatches = await db.select().from(salaryRuns).orderBy(desc(salaryRuns.createdAt)).limit(10);

    return c.json({
        ok: true,
        stats: {
            totalDisbursed,
            totalStaff,
            avgSalary: totalStaff > 0 ? totalDisbursed / totalStaff : 0,
            activeBatches: Number(runStats[0]?.runCount || 0)
        },
        latestBatches
    });
});

// GET /admin/analytics/extended - High level metrics
adminRoute.get('/analytics/extended', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');

    const [userStats, subStats, revenueStats] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.subscriptionStatus, 'active')),
        db.select({ total: sql<number>`sum(${users.subscriptionAmountMonthly})` }).from(users).where(eq(users.subscriptionStatus, 'active'))
    ]);

    const totalUsers = Number(userStats[0]?.count || 0);
    const totalRevenue = Number(revenueStats[0]?.total || 0);

    return c.json({
        ok: true,
        metrics: {
            totalUsers,
            activeSubscriptions: Number(subStats[0]?.count || 0),
            monthlyRevenue: totalRevenue,
            systemHealth: 99.9,
            userGrowth: 12.5, // Mock trend
            revenueGrowth: 8.2 // Mock trend
        }
    });
});

// In-memory mock settings for now, should be moved to a 'settings' table or KV soon.
let globalSettings = {
    maintenanceMode: false,
    registrationAllowed: true,
    globalTaxRate: 18.0,
    supportEmail: 'admin@vahi.app'
};

// GET /admin/settings
adminRoute.get('/settings', requireDeveloperAdmin, async (c) => {
    return c.json({
        ok: true,
        settings: globalSettings
    });
});

// PATCH /admin/settings
adminRoute.patch('/settings', requireDeveloperAdmin, async (c) => {
    const body = await c.req.json();
    globalSettings = { ...globalSettings, ...body };
    return c.json({
        ok: true,
        settings: globalSettings
    });
});

// GET /admin/audit-logs
adminRoute.get('/audit-logs', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const logs = await db.select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(50);

    return c.json({
        ok: true,
        logs: logs.map(log => ({
            id: log.id,
            time: log.createdAt.toISOString(),
            actor: log.actorUid,
            action: log.action,
            entity: `${log.entityType}:${log.entityId}`,
            status: "SUCCESS" // Defaulting to success as failures usually aren't logged in this table or are separate
        }))
    });
});

// GET /admin/templates
adminRoute.get('/templates', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const allTemplates = await db.select().from(templates).orderBy(desc(templates.createdAt));
    return c.json({ ok: true, templates: allTemplates });
});

// POST /admin/templates
adminRoute.post('/templates', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const body = await c.req.json();
    const payload = z.object({
        name: z.string().min(1),
        type: z.enum(['invoice', 'card', 'email']),
        content: z.any(), // JSON content
        isDefault: z.boolean().optional(),
        thumbnailUrl: z.string().optional(),
    }).parse(body);

    const newTemplate = await db.insert(templates).values({
        id: `tpl_${Date.now()}`,
        ...payload,
    }).returning();

    return c.json({ ok: true, template: newTemplate[0] });
});

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

    await withTransaction(db, async (tx) => {
        for (const entry of DEFAULT_PLANS) {
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
