import { Hono } from 'hono';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
    approvalRequests,
    auditLogs,
    bankAccounts,
    inventoryMovements,
    items,
    offers,
    organizationMembers,
    organizations,
    organizationSettings,
    plans,
    salaryRunItems,
    salaryRuns,
    staffInvites,
    templates,
    transactions,
    userSettings,
    users,
    vouchers,
} from '../db/schema';
import { withTransaction } from '../db/transaction';
import { isDeveloperAdminPrincipal, requireAuth, requireDeveloperAdmin, type AppEnv } from '../middleware/auth';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { DEFAULT_PLANS } from '../constants/defaultPlans';

const adminRoute = new Hono<AppEnv>();

// Admin transaction endpoint

const parseBoolean = (value: string | undefined, fallback = false) => {
    if (value === undefined) return fallback;
    return value.toLowerCase() === 'true';
};

const computeGrowth = (current: number, previous: number): number => {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
    if (previous <= 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
};

const ADMIN_SETTINGS_ROW_ID = '__system_admin_settings__';
const DEFAULT_ADMIN_SETTINGS = {
    maintenanceMode: false,
    registrationAllowed: true,
    globalTaxRate: 18,
    supportEmail: 'admin@vahi.app',
};

const adminSettingsPartialSchema = z.object({
    maintenanceMode: z.boolean().optional(),
    registrationAllowed: z.boolean().optional(),
    globalTaxRate: z.number().min(0).max(100).optional(),
    supportEmail: z.string().email().optional(),
});

type AdminSettings = typeof DEFAULT_ADMIN_SETTINGS;

const toAdminSettings = (value: unknown): AdminSettings => {
    const parsed = adminSettingsPartialSchema.safeParse(value);
    if (!parsed.success) return { ...DEFAULT_ADMIN_SETTINGS };
    return {
        ...DEFAULT_ADMIN_SETTINGS,
        ...parsed.data,
    };
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

    const [balanceResult, pendingVouchers, cashFlowResult] = await Promise.all([
        db.select({ total: sql<number>`sum(${bankAccounts.currentBalance})` }).from(bankAccounts),
        db.select({ count: sql<number>`count(*)` }).from(vouchers).where(eq(vouchers.status, 'draft')),
        db.select({
            net: sql<number>`
                coalesce(
                    sum(
                        case
                            when ${vouchers.type} = 'RECEIPT' then ${vouchers.amount}
                            when ${vouchers.type} = 'PAYMENT' then -${vouchers.amount}
                            else 0
                        end
                    ),
                    0
                )
            `,
        }).from(vouchers).where(eq(vouchers.status, 'posted')),
    ]);

    const totalLiquidity = Number(balanceResult[0]?.total || 0);
    const settlementsPending = Number(pendingVouchers[0]?.count || 0);
    const netCashFlow = Number(cashFlowResult[0]?.net || 0);

    // Recent accounts for table
    const accounts = await db
        .select({
            id: bankAccounts.id,
            name: bankAccounts.name,
            bankName: bankAccounts.bankName,
            currentBalance: bankAccounts.currentBalance,
            userId: bankAccounts.userId,
            updatedAt: bankAccounts.updatedAt,
            ownerBusinessName: users.businessName,
        })
        .from(bankAccounts)
        .leftJoin(users, eq(bankAccounts.userId, users.uid))
        .orderBy(desc(bankAccounts.currentBalance))
        .limit(50);

    return c.json({
        ok: true,
        stats: {
            totalLiquidity,
            settlementsPending,
            institutionalReserve: Math.max(0, totalLiquidity * 0.1),
            netCashFlow,
        },
        accounts: accounts.map((entry) => ({
            id: entry.id,
            name: entry.name,
            bankName: entry.bankName,
            currentBalance: Number(entry.currentBalance ?? 0),
            userId: entry.userId,
            ownerBusinessName: entry.ownerBusinessName ?? null,
            updatedAt: entry.updatedAt,
        })),
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
    const latestBatches = await db
        .select({
            id: salaryRuns.id,
            userId: salaryRuns.userId,
            totalNet: salaryRuns.totalNet,
            status: salaryRuns.status,
            periodStart: salaryRuns.periodStart,
            periodEnd: salaryRuns.periodEnd,
            createdAt: salaryRuns.createdAt,
            staffCount: sql<number>`
                coalesce((
                    select count(*)
                    from ${salaryRunItems}
                    where ${salaryRunItems.runId} = ${salaryRuns.id}
                ), 0)
            `,
            ownerBusinessName: users.businessName,
        })
        .from(salaryRuns)
        .leftJoin(users, eq(salaryRuns.userId, users.uid))
        .orderBy(desc(salaryRuns.createdAt))
        .limit(50);

    return c.json({
        ok: true,
        stats: {
            totalDisbursed,
            totalStaff,
            avgSalary: totalStaff > 0 ? totalDisbursed / totalStaff : 0,
            activeBatches: Number(runStats[0]?.runCount || 0)
        },
        latestBatches: latestBatches.map((entry) => ({
            id: entry.id,
            userId: entry.userId,
            totalNet: Number(entry.totalNet ?? 0),
            status: entry.status,
            periodStart: entry.periodStart,
            periodEnd: entry.periodEnd,
            createdAt: entry.createdAt,
            staffCount: Number(entry.staffCount ?? 0),
            ownerBusinessName: entry.ownerBusinessName ?? null,
        })),
    });
});

// GET /admin/analytics/extended - High level metrics
adminRoute.get('/analytics/extended', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');

    const [userStats, subStats, revenueStats, growthWindow, approvalStats] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.subscriptionStatus, 'active')),
        db.select({ total: sql<number>`sum(${users.subscriptionAmountMonthly})` }).from(users).where(eq(users.subscriptionStatus, 'active')),
        db.select({
            usersCurrentWindow: sql<number>`
                coalesce(
                    sum(case when ${users.createdAt} >= now() - interval '30 days' then 1 else 0 end),
                    0
                )
            `,
            usersPreviousWindow: sql<number>`
                coalesce(
                    sum(
                        case
                            when ${users.createdAt} >= now() - interval '60 days'
                                and ${users.createdAt} < now() - interval '30 days'
                            then 1
                            else 0
                        end
                    ),
                    0
                )
            `,
            revenueCurrentWindow: sql<number>`
                coalesce(
                    sum(
                        case
                            when ${users.subscriptionStatus} = 'active' then coalesce(${users.subscriptionAmountMonthly}, 0)
                            else 0
                        end
                    ),
                    0
                )
            `,
            revenuePreviousWindow: sql<number>`
                coalesce(
                    sum(
                        case
                            when ${users.subscriptionStatus} = 'active'
                                and ${users.subscriptionStartsAt} >= now() - interval '60 days'
                                and ${users.subscriptionStartsAt} < now() - interval '30 days'
                            then coalesce(${users.subscriptionAmountMonthly}, 0)
                            else 0
                        end
                    ),
                    0
                )
            `,
        }).from(users),
        db.select({
            total: sql<number>`count(*)`,
            pending: sql<number>`
                coalesce(sum(case when ${approvalRequests.status} = 'pending' then 1 else 0 end), 0)
            `,
        }).from(approvalRequests),
    ]);

    const totalUsers = Number(userStats[0]?.count || 0);
    const totalRevenue = Number(revenueStats[0]?.total || 0);
    const usersCurrentWindow = Number(growthWindow[0]?.usersCurrentWindow || 0);
    const usersPreviousWindow = Number(growthWindow[0]?.usersPreviousWindow || 0);
    const revenueCurrentWindow = Number(growthWindow[0]?.revenueCurrentWindow || 0);
    const revenuePreviousWindow = Number(growthWindow[0]?.revenuePreviousWindow || 0);
    const totalApprovals = Number(approvalStats[0]?.total || 0);
    const pendingApprovals = Number(approvalStats[0]?.pending || 0);
    const approvalBacklogRatio = totalApprovals > 0 ? pendingApprovals / totalApprovals : 0;
    const systemHealth = Math.max(70, 100 - (approvalBacklogRatio * 30));

    return c.json({
        ok: true,
        metrics: {
            totalUsers,
            activeSubscriptions: Number(subStats[0]?.count || 0),
            monthlyRevenue: totalRevenue,
            systemHealth,
            userGrowth: computeGrowth(usersCurrentWindow, usersPreviousWindow),
            revenueGrowth: computeGrowth(revenueCurrentWindow, revenuePreviousWindow),
        }
    });
});

// GET /admin/transactions - global transaction list for admin panel
adminRoute.get('/transactions', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 2000);

    const rows = await db
        .select({
            id: transactions.id,
            userId: transactions.userId,
            type: transactions.type,
            totalAmount: transactions.totalAmount,
            paymentStatus: transactions.paymentStatus,
            paymentMode: transactions.paymentMode,
            createdAt: transactions.createdAt,
            updatedAt: transactions.updatedAt,
            organizationName: organizations.name,
            ownerBusinessName: users.businessName,
        })
        .from(transactions)
        .leftJoin(organizations, eq(transactions.organizationId, organizations.id))
        .leftJoin(users, eq(transactions.userId, users.uid))
        .orderBy(desc(transactions.createdAt))
        .limit(limit);

    return c.json({
        ok: true,
        transactions: rows.map((entry) => ({
            id: entry.id,
            userId: entry.userId,
            type: entry.type,
            totalAmount: Number(entry.totalAmount ?? 0),
            paymentStatus: entry.paymentStatus,
            paymentMode: entry.paymentMode,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            organizationName: entry.organizationName ?? entry.ownerBusinessName ?? 'Unknown',
        })),
    });
});

// GET /admin/inventory/overview - global inventory stats + list
adminRoute.get('/inventory/overview', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 2000);

    const [
        skuResult,
        lowStockResult,
        stockValueResult,
        movementResult,
        inventoryRows,
    ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(items),
        db.select({
            count: sql<number>`
                coalesce(
                    sum(case when ${items.stock} <= coalesce(${items.minimumStock}, 0) then 1 else 0 end),
                    0
                )
            `,
        }).from(items),
        db.select({
            total: sql<number>`
                coalesce(
                    sum(greatest(${items.stock}, 0) * coalesce(nullif(${items.purchasePrice}, 0), ${items.price}, 0)),
                    0
                )
            `,
        }).from(items),
        db.select({
            count: sql<number>`count(*)`,
        })
            .from(inventoryMovements)
            .where(sql`${inventoryMovements.createdAt} >= now() - interval '1 day'`),
        db.select({
            id: items.id,
            name: items.name,
            category: items.category,
            stock: items.stock,
            price: items.price,
            organizationName: organizations.name,
            ownerBusinessName: users.businessName,
            updatedAt: items.updatedAt,
        })
            .from(items)
            .leftJoin(organizations, eq(items.organizationId, organizations.id))
            .leftJoin(users, eq(items.userId, users.uid))
            .orderBy(desc(items.updatedAt))
            .limit(limit),
    ]);

    return c.json({
        ok: true,
        stats: {
            totalSkus: Number(skuResult[0]?.count ?? 0),
            lowStockAlerts: Number(lowStockResult[0]?.count ?? 0),
            stockValue: Number(stockValueResult[0]?.total ?? 0),
            recentMovements: Number(movementResult[0]?.count ?? 0),
        },
        items: inventoryRows.map((entry) => ({
            id: entry.id,
            name: entry.name,
            category: entry.category ?? 'Uncategorized',
            stock: Number(entry.stock ?? 0),
            price: Number(entry.price ?? 0),
            organizationName: entry.organizationName ?? entry.ownerBusinessName ?? 'Unknown',
        })),
    });
});

// GET /admin/staff/overview - global user + invite visibility
adminRoute.get('/staff/overview', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 2000);

    const [
        totalPersonnelResult,
        adminCountResult,
        pendingInviteResult,
        revokedResult,
        organizationRows,
        userRows,
        revokedMembershipRows,
    ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'admin')),
        db.select({ count: sql<number>`count(*)` }).from(staffInvites).where(eq(staffInvites.status, 'pending')),
        db.select({ count: sql<number>`count(*)` }).from(organizationMembers).where(eq(organizationMembers.isActive, false)),
        db.select({
            userId: organizations.userId,
            name: organizations.name,
            createdAt: organizations.createdAt,
        })
            .from(organizations)
            .where(eq(organizations.isActive, true))
            .orderBy(asc(organizations.createdAt)),
        db.select({
            uid: users.uid,
            ownerId: users.ownerId,
            role: users.role,
            displayName: users.displayName,
            email: users.email,
            phoneNumber: users.phoneNumber,
            createdAt: users.createdAt,
        })
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(limit),
        db.select({
            userId: organizationMembers.userId,
        })
            .from(organizationMembers)
            .where(eq(organizationMembers.isActive, false)),
    ]);

    const orgNameByOwnerId = new Map<string, string>();
    for (const row of organizationRows) {
        if (!orgNameByOwnerId.has(row.userId)) {
            orgNameByOwnerId.set(row.userId, row.name);
        }
    }

    const revokedUserIds = new Set<string>(revokedMembershipRows.map((row) => row.userId));

    const staff = userRows.map((entry) => {
        const ownerScope = entry.role === 'staff' ? (entry.ownerId ?? entry.uid) : entry.uid;
        const organizationName = orgNameByOwnerId.get(ownerScope) ?? orgNameByOwnerId.get(entry.uid) ?? 'Unassigned';
        const contact = entry.email ?? entry.phoneNumber ?? '-';
        const status = revokedUserIds.has(entry.uid) ? 'REVOKED' : 'ACTIVE';
        return {
            id: entry.uid,
            name: entry.displayName ?? 'Unnamed user',
            contact,
            role: String(entry.role ?? 'staff').toUpperCase(),
            organizationName,
            status,
        };
    });

    return c.json({
        ok: true,
        stats: {
            totalPersonnel: Number(totalPersonnelResult[0]?.count ?? 0),
            verifiedAdmins: Number(adminCountResult[0]?.count ?? 0),
            pendingInvites: Number(pendingInviteResult[0]?.count ?? 0),
            revokedAccess: Number(revokedResult[0]?.count ?? 0),
        },
        staff,
    });
});

// GET /admin/settings
adminRoute.get('/settings', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const rows = await db
        .select({
            settings: userSettings.settings,
        })
        .from(userSettings)
        .where(eq(userSettings.userId, ADMIN_SETTINGS_ROW_ID))
        .limit(1);

    return c.json({
        ok: true,
        settings: toAdminSettings(rows[0]?.settings),
    });
});

// PATCH /admin/settings
adminRoute.patch('/settings', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const payload = adminSettingsPartialSchema.parse(await c.req.json());
    const rows = await db
        .select({
            settings: userSettings.settings,
        })
        .from(userSettings)
        .where(eq(userSettings.userId, ADMIN_SETTINGS_ROW_ID))
        .limit(1);
    const current = toAdminSettings(rows[0]?.settings);
    const nextSettings = {
        ...current,
        ...payload,
    };
    const now = new Date();
    await db
        .insert(userSettings)
        .values({
            userId: ADMIN_SETTINGS_ROW_ID,
            settings: nextSettings,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: userSettings.userId,
            set: {
                settings: nextSettings,
                updatedAt: now,
            },
        });

    return c.json({
        ok: true,
        settings: nextSettings,
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
        thumbnailUrl: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
    }).parse(body);

    const newTemplate = await db.insert(templates).values({
        id: `tpl_${Date.now()}`,
        name: payload.name,
        type: payload.type,
        content: payload.content,
        isDefault: payload.isDefault ?? false,
        thumbnailUrl: payload.thumbnailUrl ?? null,
        isActive: payload.isActive ?? true,
    }).returning();

    return c.json({ ok: true, template: newTemplate[0] });
});

// GET /admin/templates/:id
adminRoute.get('/templates/:id', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const rows = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
    if (!rows[0]) return c.json({ ok: false, message: 'Template not found.' }, 404);
    return c.json({ ok: true, template: rows[0] });
});

// PATCH /admin/templates/:id
adminRoute.patch('/templates/:id', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const payload = z.object({
        name: z.string().min(1).optional(),
        type: z.enum(['invoice', 'card', 'email']).optional(),
        content: z.any().optional(),
        isDefault: z.boolean().optional(),
        thumbnailUrl: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
    }).parse(await c.req.json());

    const updated = await db
        .update(templates)
        .set({
            ...payload,
            updatedAt: new Date(),
        })
        .where(eq(templates.id, id))
        .returning({ id: templates.id });

    if (!updated[0]) return c.json({ ok: false, message: 'Template not found.' }, 404);
    return c.json({ ok: true });
});

// PUT /admin/templates/:id
adminRoute.put('/templates/:id', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const payload = z.object({
        name: z.string().min(1),
        type: z.enum(['invoice', 'card', 'email']),
        content: z.any(),
        isDefault: z.boolean().optional(),
        thumbnailUrl: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
    }).parse(await c.req.json());

    const now = new Date();
    await db
        .insert(templates)
        .values({
            id,
            name: payload.name,
            type: payload.type,
            content: payload.content,
            isDefault: payload.isDefault ?? false,
            thumbnailUrl: payload.thumbnailUrl ?? null,
            isActive: payload.isActive ?? true,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: templates.id,
            set: {
                name: payload.name,
                type: payload.type,
                content: payload.content,
                isDefault: payload.isDefault ?? false,
                thumbnailUrl: payload.thumbnailUrl ?? null,
                isActive: payload.isActive ?? true,
                updatedAt: now,
            },
        });

    return c.json({ ok: true });
});

// DELETE /admin/templates/:id
adminRoute.delete('/templates/:id', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const deleted = await db.delete(templates).where(eq(templates.id, id)).returning({ id: templates.id });
    if (!deleted[0]) return c.json({ ok: false, message: 'Template not found.' }, 404);
    return c.json({ ok: true });
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
        subscriptionStatus: z.enum(['active', 'inactive', 'canceled', 'past_due']).optional(),
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
        subscriptionStatus: z.enum(['active', 'inactive', 'canceled', 'past_due']).optional(),
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
        status: z.enum(['active', 'inactive', 'canceled', 'past_due']),
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

// GET /admin/organizations - List all organizations
adminRoute.get('/organizations', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 500), 1), 2000);
    const data = await db.select().from(organizations).orderBy(desc(organizations.createdAt)).limit(limit);
    return c.json({ ok: true, organizations: data });
});

// GET /admin/organizations/:id - Organization detail
adminRoute.get('/organizations/:id', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!rows[0]) return c.json({ ok: false, message: 'Organization not found.' }, 404);
    return c.json({ ok: true, organization: rows[0] });
});

// POST /admin/organizations - Create organization
adminRoute.post('/organizations', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    const body = await c.req.json();
    const payload = z.object({
        userId: z.string().optional(),
        name: z.string().min(2).max(140),
        code: z.string().min(2).max(32),
        gstNumber: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        phoneNumber: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        currency: z.string().min(3).max(6).optional(),
        isActive: z.boolean().optional(),
    }).parse(body);

    const now = new Date();
    const id = nanoid();
    const ownerUserId = payload.userId ?? authUser?.uid ?? '';
    if (!ownerUserId) {
        return c.json({ ok: false, message: 'userId is required.' }, 400);
    }

    await db.insert(organizations).values({
        id,
        userId: ownerUserId,
        name: payload.name.trim(),
        code: payload.code.trim().toUpperCase(),
        gstNumber: payload.gstNumber ?? null,
        address: payload.address ?? null,
        phoneNumber: payload.phoneNumber ?? null,
        email: payload.email ?? null,
        currency: (payload.currency ?? 'INR').toUpperCase(),
        isActive: payload.isActive ?? true,
        createdAt: now,
        updatedAt: now,
    });

    const ownerMembershipId = nanoid();
    await db.insert(organizationMembers).values({
        id: ownerMembershipId,
        userId: ownerUserId,
        organizationId: id,
        role: 'owner',
        permissions: {},
        isActive: true,
        invitedBy: authUser?.uid ?? ownerUserId,
        phoneNumberSnapshot: null,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
    });

    await db
        .insert(organizationSettings)
        .values({
            organizationId: id,
            userId: ownerUserId,
            settings: {},
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: organizationSettings.organizationId,
            set: {
                userId: ownerUserId,
                updatedAt: now,
            },
        });

    return c.json({ ok: true, organization: { id, userId: ownerUserId } });
});

// PATCH /admin/organizations/:id - Patch organization
adminRoute.patch('/organizations/:id', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const body = await c.req.json();
    const payload = z.object({
        userId: z.string().optional(),
        name: z.string().min(2).max(140).optional(),
        code: z.string().min(2).max(32).optional(),
        gstNumber: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        phoneNumber: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        currency: z.string().min(3).max(6).optional(),
        isActive: z.boolean().optional(),
    }).parse(body);

    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.userId !== undefined) updatePayload.userId = payload.userId;
    if (payload.name !== undefined) updatePayload.name = payload.name.trim();
    if (payload.code !== undefined) updatePayload.code = payload.code.trim().toUpperCase();
    if (payload.gstNumber !== undefined) updatePayload.gstNumber = payload.gstNumber;
    if (payload.address !== undefined) updatePayload.address = payload.address;
    if (payload.phoneNumber !== undefined) updatePayload.phoneNumber = payload.phoneNumber;
    if (payload.email !== undefined) updatePayload.email = payload.email;
    if (payload.currency !== undefined) updatePayload.currency = payload.currency.toUpperCase();
    if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

    const updated = await db
        .update(organizations)
        .set(updatePayload)
        .where(eq(organizations.id, id))
        .returning({ id: organizations.id });

    if (!updated[0]) return c.json({ ok: false, message: 'Organization not found.' }, 404);
    return c.json({ ok: true });
});

// POST /admin/organizations/:id/toggle-status - Toggle active flag
adminRoute.post('/organizations/:id/toggle-status', requireDeveloperAdmin, async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const rows = await db
        .select({ isActive: organizations.isActive })
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);
    const current = rows[0];
    if (!current) return c.json({ ok: false, message: 'Organization not found.' }, 404);

    await db
        .update(organizations)
        .set({ isActive: !current.isActive, updatedAt: new Date() })
        .where(eq(organizations.id, id));

    return c.json({ ok: true, isActive: !current.isActive });
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
        audience: z.enum(['all', 'owners', 'staff']).default('all'),
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
        audience: z.enum(['all', 'owners', 'staff']).default('all'),
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
        audience: z.enum(['all', 'owners', 'staff']).optional(),
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
