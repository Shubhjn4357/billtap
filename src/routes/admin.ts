import { Hono } from 'hono';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { DEFAULT_PLAN_SEEDS } from '../constants/defaultPlans';
import {
    adminAuditLogs,
    adminSettings,
    businesses,
    businessMembers,
    discounts,
    expenses,
    inventoryMovements,
    invoices,
    items,
    notificationCampaigns,
    notificationDeliveries,
    notificationTemplates,
    offers,
    paymentIntents,
    plans,
    staffInvites,
    subscriptions,
    templates,
    users,
} from '../db/schema';
import { withTransaction } from '../db/transaction';
import { requireAdmin, type AppEnv } from '../middleware/auth';

const adminRoute = new Hono<AppEnv>();

const ADMIN_SETTINGS_ROW_ID = '__system_admin_settings__';

const SUBSCRIPTION_TIERS = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'] as const;
const BILLING_CYCLES = ['MONTHLY', 'YEARLY', 'THREE_YEAR'] as const;
const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;
const DISCOUNT_SCOPES = ['PLAN', 'TIER', 'GLOBAL'] as const;
const NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH', 'EMAIL', 'SMS', 'WHATSAPP'] as const;
const FEATURE_FLAGS = [
    'OFFLINE_BILLING',
    'GST_INVOICES',
    'PURCHASE_MODULE',
    'STOCK_MODULE',
    'PARTY_MANAGEMENT',
    'GST_REPORTS',
    'ADVANCED_REPORTS',
    'E_INVOICE',
    'E_WAY_BILL',
    'MULTI_BUSINESS',
    'STAFF_USERS',
    'CLOUD_SYNC',
    'MULTI_DEVICE',
    'BACKUP_CLOUD',
    'EXPORT_PDF',
    'EXPORT_EXCEL',
    'ACCESS_WEB_DASHBOARD',
    'API_ACCESS',
    'BATCH_EXPIRY',
    'MULTI_GODOWN',
    'POS_MODE',
    'LOYALTY_POINTS',
    'SMS_NOTIFICATIONS',
    'WHATSAPP_NOTIFICATIONS',
] as const;

const adminSettingsSchema = z.object({
    maintenanceMode: z.boolean().optional(),
    registrationAllowed: z.boolean().optional(),
    globalTaxRate: z.number().min(0).max(100).optional(),
    supportEmail: z.string().email().optional(),
});

const userRoleSchema = z.object({
    role: z.enum(['owner', 'staff', 'admin']),
});

const manualSubscriptionSchema = z.object({
    planId: z.string().trim().min(1),
    status: z.enum(['active', 'inactive', 'canceled', 'past_due']),
    durationDays: z.number().int().positive().default(30),
    businessId: z.string().trim().min(1).optional(),
});

const organizationCreateSchema = z.object({
    userId: z.string().trim().optional(),
    name: z.string().trim().min(2).max(140),
    code: z.string().trim().min(2).max(64).optional(),
    gstNumber: z.string().trim().nullable().optional(),
    address: z.string().trim().nullable().optional(),
    phoneNumber: z.string().trim().nullable().optional(),
    email: z.string().email().nullable().optional(),
    currency: z.string().trim().min(3).max(6).optional(),
    state: z.string().trim().nullable().optional(),
    legalName: z.string().trim().nullable().optional(),
    pan: z.string().trim().nullable().optional(),
    category: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
});

const organizationPatchSchema = organizationCreateSchema.partial();

const planPayloadSchema = z.object({
    id: z.string().trim().optional(),
    tier: z.enum(SUBSCRIPTION_TIERS).optional(),
    billingCycle: z.enum(BILLING_CYCLES).nullable().optional(),
    name: z.string().trim().optional(),
    displayName: z.string().trim().optional(),
    description: z.string().trim().optional(),
    monthlyPrice: z.number().nonnegative().optional(),
    pricePerCycle: z.number().nonnegative().optional(),
    currency: z.string().trim().min(3).max(6).optional(),
    isActive: z.boolean().optional(),
    isVisible: z.boolean().optional(),
    displayOrder: z.number().int().optional(),
    features: z.array(z.string()).optional(),
    enabledFeatures: z.array(z.string()).optional(),
    disabledFeatures: z.array(z.string()).optional(),
    effectiveDiscountVsMonthlyPercent: z.number().int().nullable().optional(),
    maxBillsTotal: z.number().int().nullable().optional(),
    maxBillsPerMonth: z.number().int().nullable().optional(),
    maxStaffUsers: z.number().int().nullable().optional(),
    maxBusinesses: z.number().int().nullable().optional(),
    maxDevices: z.number().int().nullable().optional(),
    maxStorageMb: z.number().int().nullable().optional(),
    offlineOnly: z.boolean().optional(),
    cloudSyncAllowed: z.boolean().optional(),
    webDashboardAllowed: z.boolean().optional(),
}).passthrough();

const offerPayloadSchema = z.object({
    id: z.string().trim().optional(),
    title: z.string().trim().min(1),
    message: z.string().trim().min(1),
    bannerUrl: z.string().trim().nullable().optional(),
    bannerBackground: z.string().trim().nullable().optional(),
    ctaText: z.string().trim().nullable().optional(),
    ctaRoute: z.string().trim().nullable().optional(),
    audience: z.enum(['all', 'owners', 'staff']).default('all'),
    isActive: z.boolean().default(true),
    priority: z.number().int().default(0),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
});

const offerPatchSchema = offerPayloadSchema.partial().extend({
    title: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1).optional(),
});

const templatePayloadSchema = z.object({
    id: z.string().trim().optional(),
    businessId: z.string().trim().nullable().optional(),
    name: z.string().trim().min(1),
    type: z.string().trim().min(1),
    content: z.record(z.string(), z.unknown()).optional(),
    isDefault: z.boolean().optional(),
    thumbnailUrl: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
});

const templatePatchSchema = templatePayloadSchema.partial().extend({
    name: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
});

const discountPayloadSchema = z.object({
    code: z.string().trim().min(2),
    type: z.enum(DISCOUNT_TYPES),
    scope: z.enum(DISCOUNT_SCOPES),
    value: z.number().positive(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    perUserLimit: z.number().int().positive().nullable().optional(),
    validFrom: z.coerce.date().nullable().optional(),
    validTo: z.coerce.date().nullable().optional(),
    applicableTiers: z.array(z.enum(SUBSCRIPTION_TIERS)).optional(),
    applicableBillingCycles: z.array(z.enum(BILLING_CYCLES)).optional(),
    isActive: z.boolean().optional(),
});

const discountPatchSchema = discountPayloadSchema.partial();

const notificationTemplateSchema = z.object({
    name: z.string().trim().min(1),
    eventKey: z.string().trim().min(1),
    channel: z.enum(NOTIFICATION_CHANNELS),
    subject: z.string().trim().nullable().optional(),
    body: z.string().trim().min(1),
    variables: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
});

const notificationTemplatePatchSchema = notificationTemplateSchema.partial();

const campaignSchema = z.object({
    title: z.string().trim().min(1),
    templateId: z.string().trim().nullable().optional(),
    channel: z.enum(NOTIFICATION_CHANNELS),
    audience: z.string().trim().optional(),
    targetFilter: z.record(z.string(), z.unknown()).optional(),
    status: z.string().trim().optional(),
    scheduledAt: z.coerce.date().nullable().optional(),
});

const campaignPatchSchema = campaignSchema.partial();

const businessFeatureFlagPatchSchema = z.object({
    appModuleAccess: z.record(z.string(), z.boolean()).optional(),
    moduleVisibility: z.record(z.string(), z.boolean()).optional(),
    featureFlagsEnabled: z.array(z.enum(FEATURE_FLAGS)).optional(),
});

type PlanRow = typeof plans.$inferSelect;
type SubscriptionRow = typeof subscriptions.$inferSelect;

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const parseBoolean = (value: string | undefined, fallback = false) => {
    if (value === undefined) return fallback;
    return value.toLowerCase() === 'true';
};

const parseAdmins = (value?: string): string[] => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed
                .map((entry) => String(entry).trim().toLowerCase())
                .filter(Boolean);
        }
    } catch {
        // Fallback to CSV below.
    }
    return value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
};

const toMonthlyAmount = (pricePerCycle: number, cycle: PlanRow['billingCycle']) => {
    if (cycle === 'YEARLY') return pricePerCycle / 12;
    if (cycle === 'THREE_YEAR') return pricePerCycle / 36;
    return pricePerCycle;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const growth = (current: number, previous: number) => {
    if (previous <= 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

const inferTier = (id: string, displayName?: string): PlanRow['tier'] => {
    const source = `${id} ${displayName ?? ''}`.toUpperCase();
    if (source.includes('ENTERPRISE')) return 'ENTERPRISE';
    if (source.includes('GROWTH')) return 'GROWTH';
    if (source.includes('FREE')) return 'FREE';
    return 'STARTER';
};

const inferBillingCycle = (id: string): PlanRow['billingCycle'] => {
    const source = id.toUpperCase();
    if (source.includes('THREE') || source.includes('3YEAR') || source.includes('3_YEAR')) return 'THREE_YEAR';
    if (source.includes('YEAR')) return 'YEARLY';
    return 'MONTHLY';
};

const tierCycleKey = (tier: SubscriptionRow['tier'], billingCycle: SubscriptionRow['billingCycle']) =>
    `${tier}:${billingCycle ?? 'NONE'}`;

const mapSubscriptionStatusLegacy = (status: SubscriptionRow['status'] | null | undefined) => {
    if (status === 'ACTIVE' || status === 'TRIAL') return 'active';
    if (status === 'CANCELLED') return 'canceled';
    if (status === 'GRACE' || status === 'EXPIRED') return 'past_due';
    return 'inactive';
};

const mapLegacyStatusToSubscription = (status: 'active' | 'inactive' | 'canceled' | 'past_due'): SubscriptionRow['status'] => {
    if (status === 'active') return 'ACTIVE';
    if (status === 'canceled') return 'CANCELLED';
    if (status === 'past_due') return 'GRACE';
    return 'EXPIRED';
};

const mapInvoiceTypeToLegacyTransactionType = (invoiceType: typeof invoices.$inferSelect['invoiceType']) => {
    if (invoiceType === 'CREDIT_NOTE_DOC') return 'RETURN_OUTWARD';
    if (invoiceType === 'DEBIT_NOTE_DOC') return 'RETURN_INWARD';
    return 'SALE';
};

const mapInvoicePaymentStatus = (status: typeof invoices.$inferSelect['paymentStatus']) => {
    if (status === 'PAID') return 'PAID';
    if (status === 'PARTIALLY_PAID') return 'PARTIAL';
    return 'PENDING';
};

const assertWriteAccess = (c: Parameters<typeof requireAdmin>[0]) => {
    const role = c.get('authRole');
    if (role === 'READ_ONLY_ADMIN') {
        throw new Error('Read-only admin cannot perform write operations.');
    }
};

const assertSuperAdmin = (c: Parameters<typeof requireAdmin>[0]) => {
    const role = c.get('authRole');
    if (role !== 'SUPER_ADMIN') {
        throw new Error('Super-admin access required for this action.');
    }
};

const adminAllowlistSet = (c: Parameters<typeof requireAdmin>[0]) => new Set([
    ...parseAdmins(c.env.ADMINS),
    ...parseAdmins(c.env.SUPPORT_ADMINS),
    ...parseAdmins(c.env.READ_ONLY_ADMINS),
    ...parseAdmins(c.env.DEVELOPER_ADMIN_EMAILS),
]);

const appendAuditLog = async (
    c: Parameters<typeof requireAdmin>[0],
    action: string,
    entityType: string | null,
    entityId: string | null,
    metadata?: Record<string, unknown>
) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    const authRole = c.get('authRole');
    if (!authUser?.email || !authRole) return;

    try {
        await db.insert(adminAuditLogs).values({
            id: `audit_${nanoid(18)}`,
            adminEmail: authUser.email.toLowerCase(),
            adminRole: authRole,
            action,
            entityType,
            entityId,
            metadataJson: metadata ?? {},
            createdAt: new Date(),
        });
    } catch {
        // Keep primary request successful even if audit logging fails.
    }
};

const toClientPlan = (plan: PlanRow) => ({
    id: plan.id,
    name: plan.displayName,
    displayName: plan.displayName,
    description: plan.description,
    monthlyPrice: Number(toMonthlyAmount(Number(plan.pricePerCycle), plan.billingCycle)),
    pricePerCycle: Number(plan.pricePerCycle),
    currency: plan.currency,
    isActive: plan.isVisible,
    isVisible: plan.isVisible,
    displayOrder: plan.displayOrder,
    features: plan.enabledFeatures,
    enabledFeatures: plan.enabledFeatures,
    disabledFeatures: plan.disabledFeatures,
    tier: plan.tier,
    billingCycle: plan.billingCycle,
    effectiveDiscountVsMonthlyPercent: plan.effectiveDiscountVsMonthlyPercent,
    restrictions: {
        maxBillsTotal: plan.maxBillsTotal,
        maxBillsPerMonth: plan.maxBillsPerMonth,
        maxStaffUsers: plan.maxStaffUsers,
        maxBusinesses: plan.maxBusinesses,
        maxDevices: plan.maxDevices,
        maxStorageMb: plan.maxStorageMb,
        offlineOnly: plan.offlineOnly,
        cloudSyncAllowed: plan.cloudSyncAllowed,
        webDashboardAllowed: plan.webDashboardAllowed,
    },
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
});

const buildPlanInsert = (
    payload: z.infer<typeof planPayloadSchema>,
    id: string,
    fallback?: PlanRow
): typeof plans.$inferInsert => {
    const displayName = payload.displayName ?? payload.name ?? fallback?.displayName ?? id;
    const tier = payload.tier ?? fallback?.tier ?? inferTier(id, displayName);
    const billingCycle = payload.billingCycle !== undefined
        ? payload.billingCycle
        : (fallback?.billingCycle ?? (tier === 'FREE' ? null : inferBillingCycle(id)));
    const enabledFeatures = payload.enabledFeatures ?? payload.features ?? fallback?.enabledFeatures ?? [];
    const disabledFeatures = payload.disabledFeatures
        ?? (payload.enabledFeatures || payload.features
            ? FEATURE_FLAGS.filter((flag) => !enabledFeatures.includes(flag))
            : (fallback?.disabledFeatures ?? []));

    return {
        id,
        tier,
        billingCycle,
        displayName,
        description: payload.description ?? fallback?.description ?? `${displayName} plan`,
        pricePerCycle: payload.pricePerCycle ?? payload.monthlyPrice ?? fallback?.pricePerCycle ?? 0,
        currency: (payload.currency ?? fallback?.currency ?? 'INR').toUpperCase(),
        effectiveDiscountVsMonthlyPercent: payload.effectiveDiscountVsMonthlyPercent ?? fallback?.effectiveDiscountVsMonthlyPercent ?? null,
        isVisible: payload.isVisible ?? payload.isActive ?? fallback?.isVisible ?? true,
        displayOrder: payload.displayOrder ?? fallback?.displayOrder ?? 0,
        maxBillsTotal: payload.maxBillsTotal ?? fallback?.maxBillsTotal ?? null,
        maxBillsPerMonth: payload.maxBillsPerMonth ?? fallback?.maxBillsPerMonth ?? null,
        maxStaffUsers: payload.maxStaffUsers ?? fallback?.maxStaffUsers ?? null,
        maxBusinesses: payload.maxBusinesses ?? fallback?.maxBusinesses ?? null,
        maxDevices: payload.maxDevices ?? fallback?.maxDevices ?? null,
        maxStorageMb: payload.maxStorageMb ?? fallback?.maxStorageMb ?? null,
        offlineOnly: payload.offlineOnly ?? fallback?.offlineOnly ?? false,
        cloudSyncAllowed: payload.cloudSyncAllowed ?? fallback?.cloudSyncAllowed ?? false,
        webDashboardAllowed: payload.webDashboardAllowed ?? fallback?.webDashboardAllowed ?? false,
        enabledFeatures,
        disabledFeatures,
        createdAt: fallback?.createdAt ?? new Date(),
        updatedAt: new Date(),
    };
};

const buildPlanPatch = (payload: z.infer<typeof planPayloadSchema>): Partial<typeof plans.$inferInsert> => {
    const enabledFeatures = payload.enabledFeatures ?? payload.features;
    const disabledFeatures = payload.disabledFeatures
        ?? (enabledFeatures ? FEATURE_FLAGS.filter((flag) => !enabledFeatures.includes(flag)) : undefined);

    return {
        ...(payload.tier !== undefined ? { tier: payload.tier } : {}),
        ...(payload.billingCycle !== undefined ? { billingCycle: payload.billingCycle } : {}),
        ...(payload.displayName !== undefined ? { displayName: payload.displayName } : {}),
        ...(payload.name !== undefined ? { displayName: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.pricePerCycle !== undefined ? { pricePerCycle: payload.pricePerCycle } : {}),
        ...(payload.monthlyPrice !== undefined ? { pricePerCycle: payload.monthlyPrice } : {}),
        ...(payload.currency !== undefined ? { currency: payload.currency.toUpperCase() } : {}),
        ...(payload.isVisible !== undefined ? { isVisible: payload.isVisible } : {}),
        ...(payload.isActive !== undefined ? { isVisible: payload.isActive } : {}),
        ...(payload.displayOrder !== undefined ? { displayOrder: payload.displayOrder } : {}),
        ...(enabledFeatures !== undefined ? { enabledFeatures } : {}),
        ...(disabledFeatures !== undefined ? { disabledFeatures } : {}),
        ...(payload.effectiveDiscountVsMonthlyPercent !== undefined
            ? { effectiveDiscountVsMonthlyPercent: payload.effectiveDiscountVsMonthlyPercent }
            : {}),
        ...(payload.maxBillsTotal !== undefined ? { maxBillsTotal: payload.maxBillsTotal } : {}),
        ...(payload.maxBillsPerMonth !== undefined ? { maxBillsPerMonth: payload.maxBillsPerMonth } : {}),
        ...(payload.maxStaffUsers !== undefined ? { maxStaffUsers: payload.maxStaffUsers } : {}),
        ...(payload.maxBusinesses !== undefined ? { maxBusinesses: payload.maxBusinesses } : {}),
        ...(payload.maxDevices !== undefined ? { maxDevices: payload.maxDevices } : {}),
        ...(payload.maxStorageMb !== undefined ? { maxStorageMb: payload.maxStorageMb } : {}),
        ...(payload.offlineOnly !== undefined ? { offlineOnly: payload.offlineOnly } : {}),
        ...(payload.cloudSyncAllowed !== undefined ? { cloudSyncAllowed: payload.cloudSyncAllowed } : {}),
        ...(payload.webDashboardAllowed !== undefined ? { webDashboardAllowed: payload.webDashboardAllowed } : {}),
        updatedAt: new Date(),
    };
};

const ensurePlansSeeded = async (db: AppEnv['Variables']['db']) => {
    const existing = await db.select({ id: plans.id }).from(plans).limit(1);
    if (existing[0]) return;

    const now = new Date();
    await db.insert(plans).values(DEFAULT_PLAN_SEEDS.map((entry) => ({
        ...entry,
        createdAt: now,
        updatedAt: now,
    })));
};

const getPrimaryBusinessByOwner = (rows: typeof businesses.$inferSelect[]) => {
    const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const byOwner = new Map<string, typeof businesses.$inferSelect>();
    for (const row of sorted) {
        if (!byOwner.has(row.ownerUserId)) byOwner.set(row.ownerUserId, row);
    }
    return byOwner;
};

const getLatestSubscriptionByBusiness = (rows: SubscriptionRow[]) => {
    const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const byBusiness = new Map<string, SubscriptionRow>();
    for (const row of sorted) {
        if (!byBusiness.has(row.businessId)) byBusiness.set(row.businessId, row);
    }
    return byBusiness;
};

adminRoute.use('/*', requireAdmin);
adminRoute.get('/stats', async (c) => {
    const db = c.get('db');
    await ensurePlansSeeded(db);

    const [userCountRows, activeSubscriptionRows, planRows, recentUserRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select().from(subscriptions).where(inArray(subscriptions.status, ['ACTIVE', 'TRIAL'])),
        db.select().from(plans),
        db.select().from(users).orderBy(desc(users.createdAt)).limit(5),
    ]);

    const planByTierCycle = new Map<string, PlanRow>();
    for (const plan of planRows) {
        planByTierCycle.set(tierCycleKey(plan.tier, plan.billingCycle), plan);
    }

    let monthlyRevenue = 0;
    for (const subscription of activeSubscriptionRows) {
        const plan = planByTierCycle.get(tierCycleKey(subscription.tier, subscription.billingCycle));
        if (!plan) continue;
        monthlyRevenue += Number(toMonthlyAmount(Number(plan.pricePerCycle), plan.billingCycle));
    }

    const recentUserIds = recentUserRows.map((row) => row.id);
    const ownedBusinesses = recentUserIds.length > 0
        ? await db.select().from(businesses).where(inArray(businesses.ownerUserId, recentUserIds))
        : [];
    const primaryBusinessByOwner = getPrimaryBusinessByOwner(ownedBusinesses);

    const recentBusinessIds = Array.from(new Set(ownedBusinesses.map((entry) => entry.id)));
    const recentSubscriptions = recentBusinessIds.length > 0
        ? await db.select().from(subscriptions).where(inArray(subscriptions.businessId, recentBusinessIds))
        : [];
    const latestSubByBusiness = getLatestSubscriptionByBusiness(recentSubscriptions);

    return c.json({
        ok: true,
        stats: {
            totalUsers: Number(userCountRows[0]?.count ?? 0),
            activeSubscriptions: activeSubscriptionRows.length,
            monthlyRevenue: Math.round(monthlyRevenue),
            recentUsers: recentUserRows.map((entry) => {
                const business = primaryBusinessByOwner.get(entry.id);
                const subscription = business ? latestSubByBusiness.get(business.id) : null;
                return {
                    uid: entry.id,
                    displayName: entry.name,
                    email: entry.email,
                    createdAt: entry.createdAt,
                    subscriptionStatus: mapSubscriptionStatusLegacy(subscription?.status),
                };
            }),
        },
    });
});

adminRoute.get('/analytics/extended', async (c) => {
    const db = c.get('db');
    await ensurePlansSeeded(db);

    const now = new Date();
    const days30 = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const days60 = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

    const [userCountRows, recentUsersCurrentRows, recentUsersPreviousRows, activeSubs, planRows, pendingInviteRows, failedPaymentRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.createdAt, days30)),
        db.select({ count: sql<number>`count(*)` }).from(users).where(and(gte(users.createdAt, days60), lte(users.createdAt, days30))),
        db.select().from(subscriptions).where(inArray(subscriptions.status, ['ACTIVE', 'TRIAL'])),
        db.select().from(plans),
        db.select({ count: sql<number>`count(*)` }).from(staffInvites).where(eq(staffInvites.status, 'pending')),
        db.select({ count: sql<number>`count(*)` }).from(paymentIntents).where(eq(paymentIntents.status, 'failed')),
    ]);

    const planByTierCycle = new Map<string, PlanRow>();
    for (const plan of planRows) {
        planByTierCycle.set(tierCycleKey(plan.tier, plan.billingCycle), plan);
    }

    let monthlyRevenue = 0;
    let previousRevenue = 0;
    for (const sub of activeSubs) {
        const plan = planByTierCycle.get(tierCycleKey(sub.tier, sub.billingCycle));
        if (!plan) continue;
        const mrr = Number(toMonthlyAmount(Number(plan.pricePerCycle), plan.billingCycle));
        monthlyRevenue += mrr;
        if (sub.createdAt <= days30) previousRevenue += mrr;
    }

    const totalUsers = Number(userCountRows[0]?.count ?? 0);
    const usersCurrent = Number(recentUsersCurrentRows[0]?.count ?? 0);
    const usersPrevious = Number(recentUsersPreviousRows[0]?.count ?? 0);
    const pendingInvites = Number(pendingInviteRows[0]?.count ?? 0);
    const failedPayments = Number(failedPaymentRows[0]?.count ?? 0);

    const systemHealth = clamp(100 - (pendingInvites * 2) - (failedPayments * 3), 60, 100);

    return c.json({
        ok: true,
        metrics: {
            totalUsers,
            activeSubscriptions: activeSubs.length,
            monthlyRevenue: Math.round(monthlyRevenue),
            systemHealth,
            userGrowth: growth(usersCurrent, usersPrevious),
            revenueGrowth: growth(monthlyRevenue, previousRevenue),
        },
    });
});

adminRoute.get('/settings', async (c) => {
    const db = c.get('db');
    const rows = await db.select().from(adminSettings).where(eq(adminSettings.id, ADMIN_SETTINGS_ROW_ID)).limit(1);
    const settings = asRecord(rows[0]?.settings);

    return c.json({
        ok: true,
        settings: {
            maintenanceMode: Boolean(settings.maintenanceMode ?? false),
            registrationAllowed: Boolean(settings.registrationAllowed ?? true),
            globalTaxRate: Number(settings.globalTaxRate ?? 18),
            supportEmail: typeof settings.supportEmail === 'string' ? settings.supportEmail : 'admin@vahi.app',
        },
    });
});

adminRoute.patch('/settings', async (c) => {
    try {
        assertSuperAdmin(c);

        const db = c.get('db');
        const payload = adminSettingsSchema.parse(await c.req.json());
        const existingRows = await db.select().from(adminSettings).where(eq(adminSettings.id, ADMIN_SETTINGS_ROW_ID)).limit(1);
        const current = asRecord(existingRows[0]?.settings);
        const next = {
            maintenanceMode: payload.maintenanceMode ?? Boolean(current.maintenanceMode ?? false),
            registrationAllowed: payload.registrationAllowed ?? Boolean(current.registrationAllowed ?? true),
            globalTaxRate: payload.globalTaxRate ?? Number(current.globalTaxRate ?? 18),
            supportEmail: payload.supportEmail ?? (typeof current.supportEmail === 'string' ? current.supportEmail : 'admin@vahi.app'),
        };
        const now = new Date();

        await db.insert(adminSettings).values({
            id: ADMIN_SETTINGS_ROW_ID,
            settings: next,
            updatedAt: now,
        }).onConflictDoUpdate({
            target: adminSettings.id,
            set: {
                settings: next,
                updatedAt: now,
            },
        });

        await appendAuditLog(c, 'ADMIN_SETTINGS_UPDATED', 'admin_settings', ADMIN_SETTINGS_ROW_ID, next);
        return c.json({ ok: true, settings: next });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update settings.' }, 400);
    }
});

adminRoute.get('/audit-logs', async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 200), 1), 5000);
    const actor = c.req.query('actor')?.trim();
    const action = c.req.query('action')?.trim();
    const entityType = c.req.query('entityType')?.trim();
    const role = c.req.query('role')?.trim();
    const status = c.req.query('status')?.trim().toUpperCase();
    const fromRaw = c.req.query('from');
    const toRaw = c.req.query('to');
    const q = c.req.query('q')?.trim().toLowerCase();

    const whereFilters: SQL[] = [];
    if (actor) whereFilters.push(ilike(adminAuditLogs.adminEmail, `%${actor}%`));
    if (action) whereFilters.push(ilike(adminAuditLogs.action, `%${action}%`));
    if (entityType) whereFilters.push(ilike(adminAuditLogs.entityType, `%${entityType}%`));
    const normalizedRole = (role ?? '').toUpperCase();
    if (normalizedRole === 'SUPER_ADMIN' || normalizedRole === 'SUPPORT_ADMIN' || normalizedRole === 'READ_ONLY_ADMIN') {
        whereFilters.push(eq(adminAuditLogs.adminRole, normalizedRole));
    }

    if (fromRaw) {
        const fromDate = new Date(fromRaw);
        if (!Number.isNaN(fromDate.getTime())) whereFilters.push(gte(adminAuditLogs.createdAt, fromDate));
    }
    if (toRaw) {
        const toDate = new Date(toRaw);
        if (!Number.isNaN(toDate.getTime())) whereFilters.push(lte(adminAuditLogs.createdAt, toDate));
    }

    const rows = whereFilters.length > 0
        ? await db.select().from(adminAuditLogs).where(and(...whereFilters)).orderBy(desc(adminAuditLogs.createdAt)).limit(limit)
        : await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit);

    let logs = rows.map((entry) => {
        const metadata = asRecord(entry.metadataJson);
        const derivedStatus = String(metadata.status ?? 'SUCCESS').toUpperCase();
        return {
            id: entry.id,
            time: entry.createdAt.toISOString(),
            actor: entry.adminEmail,
            actorRole: entry.adminRole,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            entity: entry.entityType ? `${entry.entityType}${entry.entityId ? `:${entry.entityId}` : ''}` : 'system',
            status: derivedStatus,
            metadata,
        };
    });

    if (status) {
        logs = logs.filter((entry) => entry.status === status);
    }
    if (q) {
        logs = logs.filter((entry) => {
            const haystack = [
                entry.actor,
                entry.actorRole,
                entry.action,
                entry.entityType ?? '',
                entry.entityId ?? '',
                entry.entity,
                entry.status,
                JSON.stringify(entry.metadata),
            ].join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }

    return c.json({
        ok: true,
        logs,
    });
});

adminRoute.get('/users', async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 100), 1), 1000);
    const q = c.req.query('q')?.trim();

    const userRows = q
        ? await db.select().from(users).where(or(
            ilike(users.name, `%${q}%`),
            ilike(users.email, `%${q}%`),
            ilike(users.phone, `%${q}%`),
        )).orderBy(desc(users.createdAt)).limit(limit)
        : await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);

    if (userRows.length === 0) {
        return c.json({ ok: true, users: [] });
    }

    await ensurePlansSeeded(db);
    const userIds = userRows.map((entry) => entry.id);
    const [ownedBusinesses, memberRows, planRows] = await Promise.all([
        db.select().from(businesses).where(inArray(businesses.ownerUserId, userIds)),
        db.select().from(businessMembers).where(inArray(businessMembers.userId, userIds)),
        db.select().from(plans),
    ]);

    const businessIds = Array.from(new Set([
        ...ownedBusinesses.map((entry) => entry.id),
        ...memberRows.map((entry) => entry.businessId),
    ]));
    const businessRows = businessIds.length > 0
        ? await db.select().from(businesses).where(inArray(businesses.id, businessIds))
        : [];
    const subscriptionRows = businessIds.length > 0
        ? await db.select().from(subscriptions).where(inArray(subscriptions.businessId, businessIds))
        : [];

    const allowlistedAdmins = adminAllowlistSet(c);
    const planByTierCycle = new Map<string, PlanRow>();
    for (const plan of planRows) {
        planByTierCycle.set(tierCycleKey(plan.tier, plan.billingCycle), plan);
    }

    const latestSubByBusiness = getLatestSubscriptionByBusiness(subscriptionRows);
    const primaryBusinessByOwner = getPrimaryBusinessByOwner(ownedBusinesses);
    const businessById = new Map(businessRows.map((entry) => [entry.id, entry]));

    const usersPayload = userRows.map((entry) => {
        const ownedBusiness = primaryBusinessByOwner.get(entry.id);
        const memberBusiness = memberRows.find((member) => member.userId === entry.id)?.businessId;
        const primaryBusiness = ownedBusiness ?? (memberBusiness ? businessById.get(memberBusiness) : undefined);
        const subscription = primaryBusiness ? latestSubByBusiness.get(primaryBusiness.id) : null;
        const linkedPlan = subscription ? planByTierCycle.get(tierCycleKey(subscription.tier, subscription.billingCycle)) : null;
        const metadata = asRecord(entry.metadata);
        const roleHint = typeof metadata.roleHint === 'string' ? metadata.roleHint.toLowerCase() : null;

        const role = allowlistedAdmins.has((entry.email ?? '').toLowerCase())
            ? 'admin'
            : ownedBusiness
                ? 'owner'
                : roleHint === 'owner' || roleHint === 'staff' || roleHint === 'admin'
                    ? roleHint
                    : 'staff';

        return {
            uid: entry.id,
            email: entry.email,
            displayName: entry.name,
            businessName: primaryBusiness?.name ?? null,
            primaryBusinessId: primaryBusiness?.id ?? null,
            phoneNumber: entry.phone,
            role,
            subscriptionStatus: mapSubscriptionStatusLegacy(subscription?.status),
            subscriptionPlanId: linkedPlan?.id ?? null,
            subscriptionPlanName: linkedPlan?.displayName ?? (subscription?.tier ?? null),
            subscriptionEndsAt: subscription?.endDate ?? null,
            createdAt: entry.createdAt,
        };
    });

    return c.json({ ok: true, users: usersPayload });
});

adminRoute.get('/users/:uid', async (c) => {
    const db = c.get('db');
    const uid = c.req.param('uid');
    const userRows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    const user = userRows[0];
    if (!user) return c.json({ ok: false, message: 'User not found.' }, 404);

    await ensurePlansSeeded(db);
    const [ownedBusinesses, memberRows, planRows] = await Promise.all([
        db.select().from(businesses).where(eq(businesses.ownerUserId, uid)),
        db.select().from(businessMembers).where(eq(businessMembers.userId, uid)),
        db.select().from(plans),
    ]);

    const businessIds = Array.from(new Set([
        ...ownedBusinesses.map((entry) => entry.id),
        ...memberRows.map((entry) => entry.businessId),
    ]));
    const businessRows = businessIds.length > 0
        ? await db.select().from(businesses).where(inArray(businesses.id, businessIds))
        : [];
    const subscriptionRows = businessIds.length > 0
        ? await db.select().from(subscriptions).where(inArray(subscriptions.businessId, businessIds))
        : [];
    const allowlistedAdmins = adminAllowlistSet(c);
    const planByTierCycle = new Map<string, PlanRow>();
    for (const plan of planRows) {
        planByTierCycle.set(tierCycleKey(plan.tier, plan.billingCycle), plan);
    }

    const primaryBusiness = getPrimaryBusinessByOwner(ownedBusinesses).get(uid)
        ?? businessRows.find((entry) => entry.id === memberRows[0]?.businessId);
    const subscription = primaryBusiness
        ? getLatestSubscriptionByBusiness(subscriptionRows).get(primaryBusiness.id)
        : null;
    const linkedPlan = subscription ? planByTierCycle.get(tierCycleKey(subscription.tier, subscription.billingCycle)) : null;
    const metadata = asRecord(user.metadata);
    const roleHint = typeof metadata.roleHint === 'string' ? metadata.roleHint.toLowerCase() : null;

    const role = allowlistedAdmins.has((user.email ?? '').toLowerCase())
        ? 'admin'
        : primaryBusiness && primaryBusiness.ownerUserId === user.id
            ? 'owner'
            : roleHint === 'owner' || roleHint === 'staff' || roleHint === 'admin'
                ? roleHint
                : 'staff';

    return c.json({
        ok: true,
        user: {
            uid: user.id,
            email: user.email,
            displayName: user.name,
            businessName: primaryBusiness?.name ?? null,
            primaryBusinessId: primaryBusiness?.id ?? null,
            phoneNumber: user.phone,
            role,
            subscriptionStatus: mapSubscriptionStatusLegacy(subscription?.status),
            subscriptionPlanId: linkedPlan?.id ?? null,
            subscriptionPlanName: linkedPlan?.displayName ?? (subscription?.tier ?? null),
            subscriptionEndsAt: subscription?.endDate ?? null,
            createdAt: user.createdAt,
            businesses: businessRows.map((entry) => ({
                id: entry.id,
                name: entry.name,
                ownerUserId: entry.ownerUserId,
            })),
        },
    });
});

adminRoute.patch('/users/:uid/role', async (c) => {
    try {
        assertWriteAccess(c);
        const payload = userRoleSchema.parse(await c.req.json());
        const db = c.get('db');
        const uid = c.req.param('uid');

        const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
        const user = rows[0];
        if (!user) return c.json({ ok: false, message: 'User not found.' }, 404);

        if (payload.role === 'admin') {
            assertSuperAdmin(c);
        }

        const currentMeta = asRecord(user.metadata);
        const nextMeta = {
            ...currentMeta,
            roleHint: payload.role,
            roleHintUpdatedAt: new Date().toISOString(),
        };
        await db.update(users).set({
            metadata: nextMeta,
            updatedAt: new Date(),
        }).where(eq(users.id, uid));

        await appendAuditLog(c, 'USER_ROLE_UPDATED', 'user', uid, { role: payload.role });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update role.' }, 400);
    }
});

adminRoute.post('/users/:uid/subscription', async (c) => {
    try {
        assertSuperAdmin(c);
        const payload = manualSubscriptionSchema.parse(await c.req.json());
        const db = c.get('db');
        const uid = c.req.param('uid');

        const [userRows, planRows] = await Promise.all([
            db.select().from(users).where(eq(users.id, uid)).limit(1),
            db.select().from(plans).where(eq(plans.id, payload.planId)).limit(1),
        ]);
        const user = userRows[0];
        const plan = planRows[0];
        if (!user) return c.json({ ok: false, message: 'User not found.' }, 404);
        if (!plan) return c.json({ ok: false, message: 'Plan not found.' }, 404);

        let primaryBusiness = payload.businessId
            ? (await db.select().from(businesses).where(eq(businesses.id, payload.businessId)).limit(1))[0]
            : undefined;

        if (primaryBusiness && primaryBusiness.ownerUserId !== uid) {
            return c.json({ ok: false, message: 'Selected business does not belong to this user.' }, 400);
        }

        if (!primaryBusiness) {
            primaryBusiness = (await db.select().from(businesses)
                .where(eq(businesses.ownerUserId, uid))
                .orderBy(asc(businesses.createdAt))
                .limit(1))[0];
        }

        if (!primaryBusiness) {
            const now = new Date();
            const businessId = `biz_${nanoid(18)}`;
            await db.insert(businesses).values({
                id: businessId,
                ownerUserId: uid,
                name: `${user.name}'s Business`,
                legalName: null,
                address: null,
                state: null,
                gstin: null,
                pan: null,
                booksStartDate: now,
                logoUrl: null,
                phone: user.phone,
                email: user.email,
                currency: 'INR',
                category: null,
                code: null,
                isActive: true,
                settings: {},
                createdAt: now,
                updatedAt: now,
            });
            primaryBusiness = (await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1))[0];
        }

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + payload.durationDays);
        const mappedStatus = mapLegacyStatusToSubscription(payload.status);

        await db.insert(subscriptions).values({
            id: `sub_${nanoid(18)}`,
            businessId: primaryBusiness.id,
            tier: plan.tier,
            billingCycle: plan.billingCycle,
            status: mappedStatus,
            startDate,
            endDate,
            nextRenewalDate: mappedStatus === 'ACTIVE' ? endDate : null,
            graceEndDate: mappedStatus === 'GRACE' ? new Date(endDate.getTime() + (7 * 24 * 60 * 60 * 1000)) : null,
            maxBillsTotal: plan.maxBillsTotal,
            maxBillsPerMonth: plan.maxBillsPerMonth,
            maxStaffUsers: plan.maxStaffUsers,
            maxBusinesses: plan.maxBusinesses,
            maxDevices: plan.maxDevices,
            maxStorageMb: plan.maxStorageMb,
            offlineOnly: plan.offlineOnly,
            cloudSyncAllowed: plan.cloudSyncAllowed,
            webDashboardAllowed: plan.webDashboardAllowed,
            featureFlagsEnabled: plan.enabledFeatures,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await appendAuditLog(c, 'USER_SUBSCRIPTION_UPDATED', 'user', uid, {
            planId: plan.id,
            status: mappedStatus,
            durationDays: payload.durationDays,
            businessId: primaryBusiness.id,
        });

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update subscription.' }, 400);
    }
});

adminRoute.delete('/users/:uid', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const uid = c.req.param('uid');
        const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
        const user = rows[0];
        if (!user) return c.json({ ok: false, message: 'User not found.' }, 404);

        const currentMeta = asRecord(user.metadata);
        await db.update(users).set({
            isDisabled: true,
            metadata: {
                ...currentMeta,
                softDeletedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
        }).where(eq(users.id, uid));

        await appendAuditLog(c, 'USER_SOFT_DELETED', 'user', uid);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to remove user.' }, 400);
    }
});
adminRoute.get('/organizations', async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 500), 1), 5000);
    const rows = await db.select().from(businesses).orderBy(desc(businesses.createdAt)).limit(limit);

    return c.json({
        ok: true,
        organizations: rows.map((entry) => ({
            id: entry.id,
            userId: entry.ownerUserId,
            name: entry.name,
            code: entry.code ?? entry.id,
            gstNumber: entry.gstin,
            address: entry.address,
            phoneNumber: entry.phone,
            email: entry.email,
            currency: entry.currency,
            isActive: entry.isActive,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        })),
    });
});

adminRoute.get('/organizations/:id', async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const rows = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    const entry = rows[0];
    if (!entry) return c.json({ ok: false, message: 'Organization not found.' }, 404);

    return c.json({
        ok: true,
        organization: {
            id: entry.id,
            userId: entry.ownerUserId,
            name: entry.name,
            code: entry.code ?? entry.id,
            gstNumber: entry.gstin,
            address: entry.address,
            phoneNumber: entry.phone,
            email: entry.email,
            currency: entry.currency,
            state: entry.state,
            legalName: entry.legalName,
            pan: entry.pan,
            category: entry.category,
            isActive: entry.isActive,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        },
    });
});

adminRoute.post('/organizations', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const authUser = c.get('authUser');
        const payload = organizationCreateSchema.parse(await c.req.json());
        const ownerUserId = payload.userId ?? authUser?.id;
        if (!ownerUserId) return c.json({ ok: false, message: 'Owner user id required.' }, 400);

        const ownerRows = await db.select().from(users).where(eq(users.id, ownerUserId)).limit(1);
        if (!ownerRows[0]) return c.json({ ok: false, message: 'Owner user not found.' }, 404);

        const now = new Date();
        const id = `biz_${nanoid(18)}`;
        const code = payload.code?.trim() || payload.name.replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, 20) || id;

        await db.insert(businesses).values({
            id,
            ownerUserId,
            name: payload.name.trim(),
            legalName: payload.legalName ?? null,
            address: payload.address ?? null,
            state: payload.state ?? null,
            gstin: payload.gstNumber ?? null,
            pan: payload.pan ?? null,
            booksStartDate: now,
            logoUrl: null,
            phone: payload.phoneNumber ?? null,
            email: payload.email ?? null,
            currency: (payload.currency ?? 'INR').toUpperCase(),
            category: payload.category ?? null,
            code,
            isActive: payload.isActive ?? true,
            settings: {},
            createdAt: now,
            updatedAt: now,
        });

        await db.insert(businessMembers).values({
            id: `mbr_${nanoid(16)}`,
            businessId: id,
            userId: ownerUserId,
            role: 'OWNER',
            permissions: {},
            isActive: true,
            invitedByUserId: authUser?.id ?? ownerUserId,
            phoneSnapshot: ownerRows[0].phone,
            joinedAt: now,
            createdAt: now,
            updatedAt: now,
        });

        await appendAuditLog(c, 'ORGANIZATION_CREATED', 'business', id, { ownerUserId, code });
        return c.json({ ok: true, organization: { id, userId: ownerUserId } });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create organization.' }, 400);
    }
});

adminRoute.patch('/organizations/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = organizationPatchSchema.parse(await c.req.json());

        const updated = await db.update(businesses).set({
            ...(payload.userId !== undefined ? { ownerUserId: payload.userId } : {}),
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.code !== undefined ? { code: payload.code } : {}),
            ...(payload.gstNumber !== undefined ? { gstin: payload.gstNumber } : {}),
            ...(payload.address !== undefined ? { address: payload.address } : {}),
            ...(payload.phoneNumber !== undefined ? { phone: payload.phoneNumber } : {}),
            ...(payload.email !== undefined ? { email: payload.email } : {}),
            ...(payload.currency !== undefined ? { currency: payload.currency.toUpperCase() } : {}),
            ...(payload.state !== undefined ? { state: payload.state } : {}),
            ...(payload.legalName !== undefined ? { legalName: payload.legalName } : {}),
            ...(payload.pan !== undefined ? { pan: payload.pan } : {}),
            ...(payload.category !== undefined ? { category: payload.category } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
        }).where(eq(businesses.id, id)).returning({ id: businesses.id });

        if (!updated[0]) return c.json({ ok: false, message: 'Organization not found.' }, 404);
        await appendAuditLog(c, 'ORGANIZATION_UPDATED', 'business', id, payload as Record<string, unknown>);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update organization.' }, 400);
    }
});

adminRoute.post('/organizations/:id/toggle-status', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select({ isActive: businesses.isActive }).from(businesses).where(eq(businesses.id, id)).limit(1);
        const current = rows[0];
        if (!current) return c.json({ ok: false, message: 'Organization not found.' }, 404);

        const next = !current.isActive;
        await db.update(businesses).set({ isActive: next, updatedAt: new Date() }).where(eq(businesses.id, id));
        await appendAuditLog(c, 'ORGANIZATION_TOGGLED', 'business', id, { isActive: next });
        return c.json({ ok: true, isActive: next });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to toggle organization.' }, 400);
    }
});

adminRoute.get('/plans', async (c) => {
    const db = c.get('db');
    await ensurePlansSeeded(db);
    const includeInactive = parseBoolean(c.req.query('includeInactive'), true);

    const rows = includeInactive
        ? await db.select().from(plans).orderBy(asc(plans.displayOrder), asc(plans.displayName))
        : await db.select().from(plans).where(eq(plans.isVisible, true)).orderBy(asc(plans.displayOrder), asc(plans.displayName));

    return c.json({ ok: true, plans: rows.map(toClientPlan) });
});

adminRoute.get('/plans/:id', async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const rows = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
    if (!rows[0]) return c.json({ ok: false, message: 'Plan not found.' }, 404);
    return c.json({ ok: true, plan: toClientPlan(rows[0]) });
});

adminRoute.post('/plans', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const payload = planPayloadSchema.parse(await c.req.json());
        const id = payload.id?.trim() || `plan_${nanoid(14)}`;
        const values = buildPlanInsert(payload, id);
        await db.insert(plans).values(values);

        await appendAuditLog(c, 'PLAN_CREATED', 'plan', id, {
            tier: values.tier,
            billingCycle: values.billingCycle,
            pricePerCycle: values.pricePerCycle,
        });
        return c.json({ ok: true, id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create plan.' }, 400);
    }
});

adminRoute.put('/plans/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = planPayloadSchema.parse(await c.req.json());
        const existingRows = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
        const existing = existingRows[0];
        const values = buildPlanInsert(payload, id, existing);

        await db.insert(plans).values(values).onConflictDoUpdate({
            target: plans.id,
            set: {
                ...values,
                createdAt: existing?.createdAt ?? values.createdAt,
                updatedAt: new Date(),
            },
        });

        await appendAuditLog(c, 'PLAN_UPSERTED', 'plan', id, {
            tier: values.tier,
            billingCycle: values.billingCycle,
            pricePerCycle: values.pricePerCycle,
        });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to upsert plan.' }, 400);
    }
});

adminRoute.patch('/plans/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = planPayloadSchema.parse(await c.req.json());
        const patch = buildPlanPatch(payload);

        const updated = await db.update(plans).set(patch).where(eq(plans.id, id)).returning({ id: plans.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Plan not found.' }, 404);
        await appendAuditLog(c, 'PLAN_UPDATED', 'plan', id, patch as Record<string, unknown>);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update plan.' }, 400);
    }
});

adminRoute.delete('/plans/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const deleted = await db.delete(plans).where(eq(plans.id, id)).returning({ id: plans.id });
        if (!deleted[0]) return c.json({ ok: false, message: 'Plan not found.' }, 404);
        await appendAuditLog(c, 'PLAN_DELETED', 'plan', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete plan.' }, 400);
    }
});

adminRoute.post('/seed/default-plans', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const now = new Date();

        await withTransaction(db, async (tx) => {
            for (const entry of DEFAULT_PLAN_SEEDS) {
                await tx.insert(plans).values({
                    ...entry,
                    createdAt: now,
                    updatedAt: now,
                }).onConflictDoUpdate({
                    target: plans.id,
                    set: {
                        tier: entry.tier,
                        billingCycle: entry.billingCycle,
                        displayName: entry.displayName,
                        description: entry.description,
                        pricePerCycle: entry.pricePerCycle,
                        currency: entry.currency,
                        effectiveDiscountVsMonthlyPercent: entry.effectiveDiscountVsMonthlyPercent,
                        isVisible: entry.isVisible,
                        displayOrder: entry.displayOrder,
                        maxBillsTotal: entry.maxBillsTotal,
                        maxBillsPerMonth: entry.maxBillsPerMonth,
                        maxStaffUsers: entry.maxStaffUsers,
                        maxBusinesses: entry.maxBusinesses,
                        maxDevices: entry.maxDevices,
                        maxStorageMb: entry.maxStorageMb,
                        offlineOnly: entry.offlineOnly,
                        cloudSyncAllowed: entry.cloudSyncAllowed,
                        webDashboardAllowed: entry.webDashboardAllowed,
                        enabledFeatures: entry.enabledFeatures,
                        disabledFeatures: entry.disabledFeatures,
                        updatedAt: now,
                    },
                });
            }
        });

        await appendAuditLog(c, 'PLAN_DEFAULTS_SEEDED', 'plan', null);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to seed plans.' }, 400);
    }
});
adminRoute.get('/offers', async (c) => {
    const db = c.get('db');
    const includeInactive = parseBoolean(c.req.query('includeInactive'), true);
    const rows = includeInactive
        ? await db.select().from(offers).orderBy(desc(offers.priority), desc(offers.createdAt))
        : await db.select().from(offers).where(eq(offers.isActive, true)).orderBy(desc(offers.priority), desc(offers.createdAt));
    return c.json({ ok: true, offers: rows });
});

adminRoute.get('/offers/:id', async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const rows = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
    if (!rows[0]) return c.json({ ok: false, message: 'Offer not found.' }, 404);
    return c.json({ ok: true, offer: rows[0] });
});

adminRoute.post('/offers', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const payload = offerPayloadSchema.parse(await c.req.json());
        const id = payload.id?.trim() || `off_${nanoid(14)}`;
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
        });
        await appendAuditLog(c, 'OFFER_CREATED', 'offer', id);
        return c.json({ ok: true, id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create offer.' }, 400);
    }
});

adminRoute.put('/offers/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = offerPayloadSchema.parse(await c.req.json());
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
        await appendAuditLog(c, 'OFFER_UPSERTED', 'offer', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save offer.' }, 400);
    }
});

adminRoute.patch('/offers/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = offerPatchSchema.parse(await c.req.json());
        const updated = await db.update(offers).set({
            ...(payload.title !== undefined ? { title: payload.title } : {}),
            ...(payload.message !== undefined ? { message: payload.message } : {}),
            ...(payload.bannerUrl !== undefined ? { bannerUrl: payload.bannerUrl } : {}),
            ...(payload.bannerBackground !== undefined ? { bannerBackground: payload.bannerBackground } : {}),
            ...(payload.ctaText !== undefined ? { ctaText: payload.ctaText } : {}),
            ...(payload.ctaRoute !== undefined ? { ctaRoute: payload.ctaRoute } : {}),
            ...(payload.audience !== undefined ? { audience: payload.audience } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
            ...(payload.startsAt !== undefined ? { startsAt: payload.startsAt } : {}),
            ...(payload.endsAt !== undefined ? { endsAt: payload.endsAt } : {}),
            updatedAt: new Date(),
        }).where(eq(offers.id, id)).returning({ id: offers.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Offer not found.' }, 404);
        await appendAuditLog(c, 'OFFER_UPDATED', 'offer', id, payload as Record<string, unknown>);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update offer.' }, 400);
    }
});

adminRoute.patch('/offers/:id/active', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const body = z.object({ isActive: z.boolean() }).parse(await c.req.json());
        const updated = await db.update(offers).set({ isActive: body.isActive, updatedAt: new Date() }).where(eq(offers.id, id)).returning({ id: offers.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Offer not found.' }, 404);
        await appendAuditLog(c, 'OFFER_STATUS_UPDATED', 'offer', id, { isActive: body.isActive });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to toggle offer.' }, 400);
    }
});

adminRoute.delete('/offers/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const deleted = await db.delete(offers).where(eq(offers.id, id)).returning({ id: offers.id });
        if (!deleted[0]) return c.json({ ok: false, message: 'Offer not found.' }, 404);
        await appendAuditLog(c, 'OFFER_DELETED', 'offer', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete offer.' }, 400);
    }
});

adminRoute.get('/templates', async (c) => {
    const db = c.get('db');
    const rows = await db.select().from(templates).orderBy(desc(templates.createdAt));
    return c.json({
        ok: true,
        templates: rows.map((entry) => ({
            id: entry.id,
            name: entry.name,
            type: entry.type,
            content: entry.content,
            isDefault: entry.isDefault,
            thumbnailUrl: entry.thumbnailUrl,
            isActive: entry.isActive,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        })),
    });
});

adminRoute.post('/templates', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const payload = templatePayloadSchema.parse(await c.req.json());
        const id = payload.id?.trim() || `tpl_${nanoid(14)}`;
        const now = new Date();

        await db.insert(templates).values({
            id,
            businessId: payload.businessId ?? null,
            name: payload.name,
            type: payload.type,
            content: payload.content ?? {},
            isDefault: payload.isDefault ?? false,
            thumbnailUrl: payload.thumbnailUrl ?? null,
            isActive: payload.isActive ?? true,
            createdAt: now,
            updatedAt: now,
        });

        await appendAuditLog(c, 'TEMPLATE_CREATED', 'template', id, { type: payload.type });
        return c.json({
            ok: true,
            template: {
                id,
                businessId: payload.businessId ?? null,
                name: payload.name,
                type: payload.type,
                content: payload.content ?? {},
                isDefault: payload.isDefault ?? false,
                thumbnailUrl: payload.thumbnailUrl ?? null,
                isActive: payload.isActive ?? true,
                createdAt: now,
                updatedAt: now,
            },
        });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create template.' }, 400);
    }
});

adminRoute.put('/templates/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = templatePayloadSchema.parse(await c.req.json());
        const now = new Date();

        await db.insert(templates).values({
            id,
            businessId: payload.businessId ?? null,
            name: payload.name,
            type: payload.type,
            content: payload.content ?? {},
            isDefault: payload.isDefault ?? false,
            thumbnailUrl: payload.thumbnailUrl ?? null,
            isActive: payload.isActive ?? true,
            createdAt: now,
            updatedAt: now,
        }).onConflictDoUpdate({
            target: templates.id,
            set: {
                ...(payload.businessId !== undefined ? { businessId: payload.businessId } : {}),
                name: payload.name,
                type: payload.type,
                content: payload.content ?? {},
                isDefault: payload.isDefault ?? false,
                thumbnailUrl: payload.thumbnailUrl ?? null,
                isActive: payload.isActive ?? true,
                updatedAt: now,
            },
        });

        await appendAuditLog(c, 'TEMPLATE_UPSERTED', 'template', id, { type: payload.type });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save template.' }, 400);
    }
});

adminRoute.patch('/templates/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = templatePatchSchema.parse(await c.req.json());
        const updated = await db.update(templates).set({
            ...(payload.businessId !== undefined ? { businessId: payload.businessId } : {}),
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.type !== undefined ? { type: payload.type } : {}),
            ...(payload.content !== undefined ? { content: payload.content } : {}),
            ...(payload.isDefault !== undefined ? { isDefault: payload.isDefault } : {}),
            ...(payload.thumbnailUrl !== undefined ? { thumbnailUrl: payload.thumbnailUrl } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
        }).where(eq(templates.id, id)).returning({ id: templates.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Template not found.' }, 404);
        await appendAuditLog(c, 'TEMPLATE_UPDATED', 'template', id, payload as Record<string, unknown>);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update template.' }, 400);
    }
});

adminRoute.delete('/templates/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const deleted = await db.delete(templates).where(eq(templates.id, id)).returning({ id: templates.id });
        if (!deleted[0]) return c.json({ ok: false, message: 'Template not found.' }, 404);
        await appendAuditLog(c, 'TEMPLATE_DELETED', 'template', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete template.' }, 400);
    }
});

adminRoute.get('/transactions', async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 200), 1), 2000);

    const invoiceRows = await db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(limit);
    const businessIds = Array.from(new Set(invoiceRows.map((entry) => entry.businessId)));
    const businessRows = businessIds.length > 0
        ? await db.select().from(businesses).where(inArray(businesses.id, businessIds))
        : [];
    const businessById = new Map(businessRows.map((entry) => [entry.id, entry]));

    return c.json({
        ok: true,
        transactions: invoiceRows.map((entry) => ({
            id: entry.id,
            userId: entry.createdByUserId ?? businessById.get(entry.businessId)?.ownerUserId ?? '',
            type: mapInvoiceTypeToLegacyTransactionType(entry.invoiceType),
            totalAmount: Number(entry.totalInvoiceValue ?? 0),
            paymentStatus: mapInvoicePaymentStatus(entry.paymentStatus),
            paymentMode: 'CASH',
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            organizationName: businessById.get(entry.businessId)?.name ?? 'Unknown',
        })),
    });
});

adminRoute.get('/expenses/analytics', async (c) => {
    const db = c.get('db');
    const fromQuery = c.req.query('from');
    const toQuery = c.req.query('to');

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = fromQuery ? new Date(fromQuery) : defaultFrom;
    const toInclusive = toQuery ? new Date(toQuery) : now;
    const to = new Date(toInclusive);
    to.setHours(23, 59, 59, 999);

    const thisMonthFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthTo = new Date(now);
    thisMonthTo.setHours(23, 59, 59, 999);

    const baseFilters = [
        eq(expenses.isDeleted, false),
        gte(expenses.date, from),
        lte(expenses.date, to),
    ] as const;

    const monthFilters = [
        eq(expenses.isDeleted, false),
        gte(expenses.date, thisMonthFrom),
        lte(expenses.date, thisMonthTo),
    ] as const;

    const [byCategoryArr, totalsRows, thisMonthRows] = await Promise.all([
        db.select({
            category: expenses.category,
            total: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
            count: sql<number>`count(*)`,
        })
            .from(expenses)
            .where(and(...baseFilters))
            .groupBy(expenses.category)
            .orderBy(desc(sql`coalesce(sum(${expenses.amount}), 0)`)),
        db.select({
            totalExpenses: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
            totalCount: sql<number>`count(*)`,
        })
            .from(expenses)
            .where(and(...baseFilters)),
        db.select({
            thisMonth: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
        })
            .from(expenses)
            .where(and(...monthFilters)),
    ]);

    const totalExpenses = Number(totalsRows[0]?.totalExpenses ?? 0);
    const totalCount = Number(totalsRows[0]?.totalCount ?? 0);
    const thisMonth = Number(thisMonthRows[0]?.thisMonth ?? 0);
    const dayDiffMs = Math.max(to.getTime() - from.getTime(), 0);
    const dayDiff = Math.max(Math.floor(dayDiffMs / (1000 * 60 * 60 * 24)) + 1, 1);
    const avgPerDay = totalExpenses / dayDiff;

    return c.json({
        ok: true,
        byCategoryArr: byCategoryArr.map((entry) => ({
            category: entry.category,
            total: Number(entry.total ?? 0),
            count: Number(entry.count ?? 0),
        })),
        overview: {
            totalExpenses,
            thisMonth,
            avgPerDay: Number(avgPerDay.toFixed(2)),
            largestCategory: byCategoryArr[0]?.category ?? 'N/A',
            totalCount,
        },
    });
});

adminRoute.get('/inventory/overview', async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 200), 1), 2000);
    const since = new Date(Date.now() - (24 * 60 * 60 * 1000));

    const [totalSkuRows, lowStockRows, stockValueRows, movementRows, itemRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(items).where(eq(items.isActive, true)),
        db.select({
            count: sql<number>`
                coalesce(
                    sum(case when ${items.isActive} = true and ${items.stock} <= coalesce(${items.reorderLevel}, 0) then 1 else 0 end),
                    0
                )
            `,
        }).from(items),
        db.select({
            total: sql<number>`
                coalesce(
                    sum(greatest(${items.stock}, 0) * coalesce(nullif(${items.purchasePrice}, 0), ${items.salePrice}, 0)),
                    0
                )
            `,
        }).from(items).where(eq(items.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(inventoryMovements).where(gte(inventoryMovements.createdAt, since)),
        db.select().from(items).orderBy(desc(items.updatedAt)).limit(limit),
    ]);

    const businessIds = Array.from(new Set(itemRows.map((entry) => entry.businessId)));
    const businessRows = businessIds.length > 0
        ? await db.select().from(businesses).where(inArray(businesses.id, businessIds))
        : [];
    const businessById = new Map(businessRows.map((entry) => [entry.id, entry]));

    return c.json({
        ok: true,
        stats: {
            totalSkus: Number(totalSkuRows[0]?.count ?? 0),
            lowStockAlerts: Number(lowStockRows[0]?.count ?? 0),
            stockValue: Number(stockValueRows[0]?.total ?? 0),
            recentMovements: Number(movementRows[0]?.count ?? 0),
        },
        items: itemRows.map((entry) => ({
            id: entry.id,
            name: entry.name,
            category: entry.category ?? 'Uncategorized',
            stock: Number(entry.stock ?? 0),
            price: Number(entry.salePrice ?? 0),
            organizationName: businessById.get(entry.businessId)?.name ?? 'Unknown',
        })),
    });
});

adminRoute.get('/staff/overview', async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 200), 1), 2000);
    const allowlistedAdmins = adminAllowlistSet(c);

    const [totalUserRows, inviteRows, revokedRows, userRows, ownedBusinesses, memberRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(staffInvites).where(eq(staffInvites.status, 'pending')),
        db.select({ count: sql<number>`count(*)` }).from(businessMembers).where(eq(businessMembers.isActive, false)),
        db.select().from(users).orderBy(desc(users.createdAt)).limit(limit),
        db.select().from(businesses),
        db.select().from(businessMembers),
    ]);

    const verifiedAdmins = userRows.filter((entry) => allowlistedAdmins.has((entry.email ?? '').toLowerCase())).length;
    const primaryBusinessByOwner = getPrimaryBusinessByOwner(ownedBusinesses);
    const businessById = new Map(ownedBusinesses.map((entry) => [entry.id, entry]));

    return c.json({
        ok: true,
        stats: {
            totalPersonnel: Number(totalUserRows[0]?.count ?? 0),
            verifiedAdmins,
            pendingInvites: Number(inviteRows[0]?.count ?? 0),
            revokedAccess: Number(revokedRows[0]?.count ?? 0),
        },
        staff: userRows.map((entry) => {
            const ownerBusiness = primaryBusinessByOwner.get(entry.id);
            const memberBusinessId = memberRows.find((member) => member.userId === entry.id)?.businessId;
            const memberBusiness = memberBusinessId ? businessById.get(memberBusinessId) : null;
            const metadata = asRecord(entry.metadata);
            const roleHint = typeof metadata.roleHint === 'string' ? metadata.roleHint : 'staff';

            const role = allowlistedAdmins.has((entry.email ?? '').toLowerCase())
                ? 'ADMIN'
                : ownerBusiness
                    ? 'OWNER'
                    : String(roleHint).toUpperCase();

            const status = entry.isDisabled ? 'REVOKED' : 'ACTIVE';

            return {
                id: entry.id,
                name: entry.name ?? 'Unnamed',
                contact: entry.email ?? entry.phone ?? '-',
                role,
                organizationName: ownerBusiness?.name ?? memberBusiness?.name ?? 'Unassigned',
                status,
            };
        }),
    });
});
adminRoute.get('/discounts', async (c) => {
    const db = c.get('db');
    const includeInactive = parseBoolean(c.req.query('includeInactive'), true);
    const rows = includeInactive
        ? await db.select().from(discounts).orderBy(asc(discounts.code))
        : await db.select().from(discounts).where(eq(discounts.isActive, true)).orderBy(asc(discounts.code));
    return c.json({ ok: true, discounts: rows });
});

adminRoute.get('/discounts/:id', async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const rows = await db.select().from(discounts).where(eq(discounts.id, id)).limit(1);
    if (!rows[0]) return c.json({ ok: false, message: 'Discount not found.' }, 404);
    return c.json({ ok: true, discount: rows[0] });
});

adminRoute.post('/discounts', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const authUser = c.get('authUser');
        const payload = discountPayloadSchema.parse(await c.req.json());
        const id = `dsc_${nanoid(16)}`;
        const now = new Date();

        await db.insert(discounts).values({
            id,
            code: payload.code.toUpperCase(),
            type: payload.type,
            scope: payload.scope,
            value: payload.value,
            maxRedemptions: payload.maxRedemptions ?? null,
            perUserLimit: payload.perUserLimit ?? null,
            validFrom: payload.validFrom ?? null,
            validTo: payload.validTo ?? null,
            applicableTiers: payload.applicableTiers ?? [],
            applicableBillingCycles: payload.applicableBillingCycles ?? [],
            isActive: payload.isActive ?? true,
            createdByAdminId: authUser?.id ?? null,
            redemptionCount: 0,
            createdAt: now,
            updatedAt: now,
        });

        await appendAuditLog(c, 'DISCOUNT_CREATED', 'discount', id, {
            code: payload.code.toUpperCase(),
            type: payload.type,
            scope: payload.scope,
        });
        return c.json({ ok: true, id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create discount.' }, 400);
    }
});

adminRoute.patch('/discounts/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = discountPatchSchema.parse(await c.req.json());
        const updated = await db.update(discounts).set({
            ...(payload.code !== undefined ? { code: payload.code.toUpperCase() } : {}),
            ...(payload.type !== undefined ? { type: payload.type } : {}),
            ...(payload.scope !== undefined ? { scope: payload.scope } : {}),
            ...(payload.value !== undefined ? { value: payload.value } : {}),
            ...(payload.maxRedemptions !== undefined ? { maxRedemptions: payload.maxRedemptions } : {}),
            ...(payload.perUserLimit !== undefined ? { perUserLimit: payload.perUserLimit } : {}),
            ...(payload.validFrom !== undefined ? { validFrom: payload.validFrom } : {}),
            ...(payload.validTo !== undefined ? { validTo: payload.validTo } : {}),
            ...(payload.applicableTiers !== undefined ? { applicableTiers: payload.applicableTiers } : {}),
            ...(payload.applicableBillingCycles !== undefined ? { applicableBillingCycles: payload.applicableBillingCycles } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
        }).where(eq(discounts.id, id)).returning({ id: discounts.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Discount not found.' }, 404);
        await appendAuditLog(c, 'DISCOUNT_UPDATED', 'discount', id, payload as Record<string, unknown>);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update discount.' }, 400);
    }
});

adminRoute.delete('/discounts/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const updated = await db.update(discounts).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(discounts.id, id)).returning({ id: discounts.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Discount not found.' }, 404);
        await appendAuditLog(c, 'DISCOUNT_DEACTIVATED', 'discount', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete discount.' }, 400);
    }
});

adminRoute.get('/notifications/templates', async (c) => {
    const db = c.get('db');
    const includeInactive = parseBoolean(c.req.query('includeInactive'), true);
    const rows = includeInactive
        ? await db.select().from(notificationTemplates).orderBy(desc(notificationTemplates.createdAt))
        : await db.select().from(notificationTemplates).where(eq(notificationTemplates.isActive, true)).orderBy(desc(notificationTemplates.createdAt));
    return c.json({ ok: true, templates: rows });
});

adminRoute.post('/notifications/templates', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const authUser = c.get('authUser');
        const payload = notificationTemplateSchema.parse(await c.req.json());
        const id = `ntf_tpl_${nanoid(14)}`;
        const now = new Date();
        await db.insert(notificationTemplates).values({
            id,
            name: payload.name,
            eventKey: payload.eventKey,
            channel: payload.channel,
            subject: payload.subject ?? null,
            body: payload.body,
            variables: payload.variables ?? [],
            isActive: payload.isActive ?? true,
            createdByAdminId: authUser?.id ?? null,
            createdAt: now,
            updatedAt: now,
        });
        await appendAuditLog(c, 'NOTIFICATION_TEMPLATE_CREATED', 'notification_template', id, {
            eventKey: payload.eventKey,
            channel: payload.channel,
        });
        return c.json({ ok: true, id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create notification template.' }, 400);
    }
});

adminRoute.patch('/notifications/templates/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = notificationTemplatePatchSchema.parse(await c.req.json());
        const updated = await db.update(notificationTemplates).set({
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.eventKey !== undefined ? { eventKey: payload.eventKey } : {}),
            ...(payload.channel !== undefined ? { channel: payload.channel } : {}),
            ...(payload.subject !== undefined ? { subject: payload.subject } : {}),
            ...(payload.body !== undefined ? { body: payload.body } : {}),
            ...(payload.variables !== undefined ? { variables: payload.variables } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
        }).where(eq(notificationTemplates.id, id)).returning({ id: notificationTemplates.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Notification template not found.' }, 404);
        await appendAuditLog(c, 'NOTIFICATION_TEMPLATE_UPDATED', 'notification_template', id, payload as Record<string, unknown>);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update notification template.' }, 400);
    }
});

adminRoute.get('/notifications/campaigns', async (c) => {
    const db = c.get('db');
    const status = c.req.query('status')?.trim();
    const rows = status
        ? await db.select().from(notificationCampaigns).where(eq(notificationCampaigns.status, status)).orderBy(desc(notificationCampaigns.createdAt))
        : await db.select().from(notificationCampaigns).orderBy(desc(notificationCampaigns.createdAt));
    return c.json({ ok: true, campaigns: rows });
});

adminRoute.post('/notifications/campaigns', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const authUser = c.get('authUser');
        const payload = campaignSchema.parse(await c.req.json());
        const id = `ntf_cmp_${nanoid(14)}`;
        const now = new Date();
        await db.insert(notificationCampaigns).values({
            id,
            title: payload.title,
            templateId: payload.templateId ?? null,
            channel: payload.channel,
            audience: payload.audience ?? 'all',
            targetFilter: payload.targetFilter ?? {},
            status: payload.status ?? 'DRAFT',
            scheduledAt: payload.scheduledAt ?? null,
            startedAt: null,
            completedAt: null,
            createdByAdminId: authUser?.id ?? null,
            createdAt: now,
            updatedAt: now,
        });
        await appendAuditLog(c, 'NOTIFICATION_CAMPAIGN_CREATED', 'notification_campaign', id, { channel: payload.channel });
        return c.json({ ok: true, id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create campaign.' }, 400);
    }
});

adminRoute.patch('/notifications/campaigns/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = campaignPatchSchema.parse(await c.req.json());
        const updated = await db.update(notificationCampaigns).set({
            ...(payload.title !== undefined ? { title: payload.title } : {}),
            ...(payload.templateId !== undefined ? { templateId: payload.templateId } : {}),
            ...(payload.channel !== undefined ? { channel: payload.channel } : {}),
            ...(payload.audience !== undefined ? { audience: payload.audience } : {}),
            ...(payload.targetFilter !== undefined ? { targetFilter: payload.targetFilter } : {}),
            ...(payload.status !== undefined ? { status: payload.status } : {}),
            ...(payload.scheduledAt !== undefined ? { scheduledAt: payload.scheduledAt } : {}),
            updatedAt: new Date(),
        }).where(eq(notificationCampaigns.id, id)).returning({ id: notificationCampaigns.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Campaign not found.' }, 404);
        await appendAuditLog(c, 'NOTIFICATION_CAMPAIGN_UPDATED', 'notification_campaign', id, payload as Record<string, unknown>);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update campaign.' }, 400);
    }
});

adminRoute.post('/notifications/campaigns/:id/trigger', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const campaignRows = await db.select().from(notificationCampaigns).where(eq(notificationCampaigns.id, id)).limit(1);
        const campaign = campaignRows[0];
        if (!campaign) return c.json({ ok: false, message: 'Campaign not found.' }, 404);

        const now = new Date();
        await db.update(notificationCampaigns).set({
            status: 'RUNNING',
            startedAt: now,
            updatedAt: now,
        }).where(eq(notificationCampaigns.id, id));

        const targetBusinesses = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.isActive, true)).limit(100);
        if (targetBusinesses.length > 0) {
            await db.insert(notificationDeliveries).values(targetBusinesses.map((business) => ({
                id: `ntf_del_${nanoid(16)}`,
                campaignId: id,
                templateId: campaign.templateId ?? null,
                businessId: business.id,
                userId: null,
                channel: campaign.channel,
                status: 'SENT',
                errorMessage: null,
                metadata: {},
                sentAt: now,
                createdAt: now,
            })));
        }

        await db.update(notificationCampaigns).set({
            status: 'COMPLETED',
            completedAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(notificationCampaigns.id, id));

        await appendAuditLog(c, 'NOTIFICATION_CAMPAIGN_TRIGGERED', 'notification_campaign', id, {
            deliveryCount: targetBusinesses.length,
        });
        return c.json({ ok: true, deliveriesQueued: targetBusinesses.length });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to trigger campaign.' }, 400);
    }
});

adminRoute.post('/notifications/campaigns/:id/cancel', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const updated = await db.update(notificationCampaigns).set({
            status: 'CANCELLED',
            updatedAt: new Date(),
        }).where(eq(notificationCampaigns.id, id)).returning({ id: notificationCampaigns.id });
        if (!updated[0]) return c.json({ ok: false, message: 'Campaign not found.' }, 404);
        await appendAuditLog(c, 'NOTIFICATION_CAMPAIGN_CANCELLED', 'notification_campaign', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to cancel campaign.' }, 400);
    }
});

adminRoute.post('/notifications/campaigns/run-scheduled', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const now = new Date();
        const dueCampaigns = await db.select().from(notificationCampaigns).where(and(
            inArray(notificationCampaigns.status, ['SCHEDULED', 'DRAFT']),
            lte(notificationCampaigns.scheduledAt, now),
        )).orderBy(asc(notificationCampaigns.scheduledAt)).limit(50);

        if (dueCampaigns.length === 0) {
            return c.json({ ok: true, processed: 0, deliveriesQueued: 0 });
        }

        const activeBusinesses = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.isActive, true));
        let deliveriesQueued = 0;

        for (const campaign of dueCampaigns) {
            await db.update(notificationCampaigns).set({
                status: 'RUNNING',
                startedAt: now,
                updatedAt: now,
            }).where(eq(notificationCampaigns.id, campaign.id));

            if (activeBusinesses.length > 0) {
                const rows = activeBusinesses.map((business) => ({
                    id: `ntf_del_${nanoid(16)}`,
                    campaignId: campaign.id,
                    templateId: campaign.templateId ?? null,
                    businessId: business.id,
                    userId: null,
                    channel: campaign.channel,
                    status: 'QUEUED',
                    errorMessage: null,
                    metadata: {
                        source: 'SCHEDULED_EXECUTOR',
                        campaignTitle: campaign.title,
                    },
                    sentAt: null,
                    createdAt: now,
                }));
                await db.insert(notificationDeliveries).values(rows);
                deliveriesQueued += rows.length;
            }

            await db.update(notificationCampaigns).set({
                status: 'COMPLETED',
                completedAt: new Date(),
                updatedAt: new Date(),
            }).where(eq(notificationCampaigns.id, campaign.id));
        }

        await appendAuditLog(c, 'NOTIFICATION_CAMPAIGN_SCHEDULE_EXECUTOR_RUN', 'notification_campaign', null, {
            processed: dueCampaigns.length,
            deliveriesQueued,
        });
        return c.json({ ok: true, processed: dueCampaigns.length, deliveriesQueued });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to run scheduled campaigns.' }, 400);
    }
});

adminRoute.get('/notifications/deliveries', async (c) => {
    const db = c.get('db');
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 200), 1), 2000);
    const rows = await db.select().from(notificationDeliveries).orderBy(desc(notificationDeliveries.createdAt)).limit(limit);
    return c.json({ ok: true, deliveries: rows });
});

adminRoute.get('/businesses/:id/feature-flags', async (c) => {
    const db = c.get('db');
    const businessId = c.req.param('id');
    const businessRows = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    const business = businessRows[0];
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

    const subRows = await db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId)).orderBy(desc(subscriptions.createdAt)).limit(1);
    const subscription = subRows[0] ?? null;
    const settings = asRecord(business.settings);

    return c.json({
        ok: true,
        businessId,
        moduleControl: {
            appModuleAccess: asRecord(settings.appModuleAccess),
            moduleVisibility: asRecord(settings.moduleVisibility),
        },
        subscription: subscription
            ? {
                id: subscription.id,
                tier: subscription.tier,
                billingCycle: subscription.billingCycle,
                status: subscription.status,
                featureFlagsEnabled: subscription.featureFlagsEnabled,
            }
            : null,
    });
});

adminRoute.patch('/businesses/:id/feature-flags', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const businessId = c.req.param('id');
        const payload = businessFeatureFlagPatchSchema.parse(await c.req.json());

        const businessRows = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
        const business = businessRows[0];
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

        const currentSettings = asRecord(business.settings);
        const nextSettings = {
            ...currentSettings,
            ...(payload.appModuleAccess !== undefined ? { appModuleAccess: payload.appModuleAccess } : {}),
            ...(payload.moduleVisibility !== undefined ? { moduleVisibility: payload.moduleVisibility } : {}),
        };

        await db.update(businesses).set({
            settings: nextSettings,
            updatedAt: new Date(),
        }).where(eq(businesses.id, businessId));

        if (payload.featureFlagsEnabled !== undefined) {
            const subRows = await db.select().from(subscriptions)
                .where(eq(subscriptions.businessId, businessId))
                .orderBy(desc(subscriptions.createdAt))
                .limit(1);
            const currentSub = subRows[0];
            if (currentSub) {
                await db.update(subscriptions).set({
                    featureFlagsEnabled: payload.featureFlagsEnabled,
                    updatedAt: new Date(),
                }).where(eq(subscriptions.id, currentSub.id));
            }
        }

        await appendAuditLog(c, 'BUSINESS_FEATURE_FLAGS_UPDATED', 'business', businessId, payload as Record<string, unknown>);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update feature flags.' }, 400);
    }
});

const getLiveSnapshot = async (db: AppEnv['Variables']['db']) => {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    const [signupsRows, billingRows, failedRows, upgradeRows, downgradeRows, queuedDeliveryRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.createdAt, dayAgo)),
        db.select({ count: sql<number>`count(*)` }).from(paymentIntents).where(and(
            eq(paymentIntents.status, 'succeeded'),
            gte(paymentIntents.createdAt, dayAgo),
        )),
        db.select({ count: sql<number>`count(*)` }).from(paymentIntents).where(and(
            eq(paymentIntents.status, 'failed'),
            gte(paymentIntents.createdAt, dayAgo),
        )),
        db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(and(
            gte(subscriptions.createdAt, dayAgo),
            inArray(subscriptions.tier, ['STARTER', 'GROWTH', 'ENTERPRISE']),
        )),
        db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(and(
            gte(subscriptions.createdAt, dayAgo),
            or(eq(subscriptions.tier, 'FREE'), eq(subscriptions.status, 'CANCELLED')),
        )),
        db.select({ count: sql<number>`count(*)` }).from(notificationDeliveries).where(inArray(notificationDeliveries.status, ['QUEUED', 'FAILED'])),
    ]);

    return {
        ts: now.toISOString(),
        signupsLast24h: Number(signupsRows[0]?.count ?? 0),
        billingEventsLast24h: Number(billingRows[0]?.count ?? 0),
        errorSpikesLast24h: Number(failedRows[0]?.count ?? 0),
        upgradesLast24h: Number(upgradeRows[0]?.count ?? 0),
        downgradesLast24h: Number(downgradeRows[0]?.count ?? 0),
        queueSpikes: Number(queuedDeliveryRows[0]?.count ?? 0),
    };
};

adminRoute.get('/live/snapshot', async (c) => {
    const db = c.get('db');
    const snapshot = await getLiveSnapshot(db);
    return c.json({ ok: true, snapshot });
});

adminRoute.get('/live/events', async (c) => {
    const db = c.get('db');
    const payload = await getLiveSnapshot(db);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(payload)}\n\n`));
            controller.close();
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    });
});

export default adminRoute;
