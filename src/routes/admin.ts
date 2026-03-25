import { Hono } from 'hono';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { DEFAULT_PLAN_SEEDS } from '../constants/defaultPlans';
import {
    adminAuditLogs,
    adminSettings,
    businesses,
    businessMembers,
    businessSettings,
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
    parties,
    plans,
    staffInvites,
    subscriptions,
    templates,
    users,
} from '../db/schema';
import { withTransaction } from '../db/transaction';
import { requireAdmin, type AppEnv } from '../middleware/auth';
import {
    isValidSettingsSection,
    normalizeSettingsData,
    SETTINGS_SCHEMA,
    SETTINGS_SECTIONS,
} from '../constants/settingsSchema';

const adminRoute = new Hono<AppEnv>();

const ADMIN_SETTINGS_ROW_ID = '__system_admin_settings__';

const SUBSCRIPTION_TIERS = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'] as const;
const BILLING_CYCLES = ['MONTHLY', 'YEARLY', 'THREE_YEAR'] as const;
const SUBSCRIPTION_STATUSES = ['ACTIVE', 'EXPIRED', 'TRIAL', 'CANCELLED', 'GRACE'] as const;
const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;
const DISCOUNT_SCOPES = ['PLAN', 'TIER', 'GLOBAL'] as const;
const NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH', 'EMAIL'] as const;
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
] as const;

const DEFAULT_ITEM_CATEGORY_PRESETS = [
    'Electronics',
    'Grocery',
    'Fashion',
    'Pharmacy',
    'Stationery',
    'Home & Kitchen',
    'Automotive',
    'Industrial',
    'Services',
] as const;

const DEFAULT_UNIT_PRESETS = [
    'pcs',
    'box',
    'kg',
    'g',
    'ltr',
    'ml',
    'm',
    'cm',
    'dozen',
    'set',
    'pair',
    'hour',
    'day',
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
    booksStartDate: z.coerce.date().nullable().optional(),
    logoUrl: z.string().trim().nullable().optional(),
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

const notificationTemplateBulkSchema = z.object({
    ids: z.array(z.string().trim().min(1)).min(1).max(500),
    action: z.enum(['ACTIVATE', 'DEACTIVATE', 'DELETE']),
});

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

const campaignBulkSchema = z.object({
    ids: z.array(z.string().trim().min(1)).min(1).max(500),
    action: z.enum(['TRIGGER', 'CANCEL', 'DELETE']),
});

const businessFeatureFlagPatchSchema = z.object({
    appModuleAccess: z.record(z.string(), z.boolean()).optional(),
    moduleVisibility: z.record(z.string(), z.boolean()).optional(),
    featureFlagsEnabled: z.array(z.enum(FEATURE_FLAGS)).optional(),
});

const businessQuotaPatchSchema = z.object({
    maxInvoicesTotal: z.number().int().positive().nullable().optional(),
    maxStaffUsers: z.number().int().positive().nullable().optional(),
    storageLimitMb: z.number().int().positive().nullable().optional(),
});

const businessSettingsPatchSchema = z.object({
    data: z.record(z.string(), z.unknown()),
});

const inventoryAdminListQuerySchema = z.object({
    businessId: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).optional(),
    includeInactive: z.coerce.boolean().default(false),
    limit: z.coerce.number().int().min(1).max(2000).default(500),
});

const inventoryAdminPatchSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().nullable().optional(),
    unit: z.string().trim().nullable().optional(),
    salePrice: z.number().nonnegative().optional(),
    purchasePrice: z.number().nonnegative().optional(),
    mrp: z.number().nonnegative().optional(),
    reorderLevel: z.number().nonnegative().optional(),
    stock: z.number().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
});

const inventoryAdminAdjustSchema = z.object({
    delta: z.number().refine((value) => value !== 0, { message: 'Delta cannot be zero.' }),
    reason: z.string().trim().max(255).optional(),
});

const partyAdminListQuerySchema = z.object({
    businessId: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).optional(),
    type: z.enum(['CUSTOMER', 'SUPPLIER']).optional(),
    includeInactive: z.coerce.boolean().default(false),
    limit: z.coerce.number().int().min(1).max(2000).default(500),
});

const partyAdminPatchSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    type: z.enum(['CUSTOMER', 'SUPPLIER']).optional(),
    phone: z.string().trim().nullable().optional(),
    email: z.string().trim().nullable().optional(),
    billingAddress: z.string().trim().nullable().optional(),
    gstin: z.string().trim().nullable().optional(),
    openingBalance: z.number().optional(),
    creditLimit: z.number().nonnegative().optional(),
    loyaltyPoints: z.number().int().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
});

const staffInviteListQuerySchema = z.object({
    businessId: z.string().trim().min(1).optional(),
    status: z.enum(['pending', 'accepted', 'cancelled', 'expired']).optional(),
    limit: z.coerce.number().int().min(1).max(2000).default(500),
});

const staffInviteCreateSchema = z.object({
    businessId: z.string().trim().min(1),
    phoneNumber: z.string().trim().min(6).max(24),
    role: z.enum(['OWNER', 'STAFF']).default('STAFF'),
    expiresInDays: z.number().int().min(1).max(60).default(7),
});

const staffMemberListQuerySchema = z.object({
    businessId: z.string().trim().min(1).optional(),
    role: z.enum(['OWNER', 'STAFF']).optional(),
    isActive: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(2000).default(500),
});

const staffMemberPatchSchema = z.object({
    role: z.enum(['OWNER', 'STAFF']).optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
});

const transactionListQuerySchema = z.object({
    businessId: z.string().trim().min(1).optional(),
    paymentStatus: z.enum(['PAID', 'PARTIAL', 'PENDING']).optional(),
    q: z.string().trim().min(1).optional(),
    includeDeleted: z.coerce.boolean().default(false),
    limit: z.coerce.number().int().min(1).max(2000).default(500),
});

const transactionPatchSchema = z.object({
    paymentStatus: z.enum(['PAID', 'PARTIAL', 'PENDING']).optional(),
    paidAmount: z.number().nonnegative().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    notes: z.string().trim().nullable().optional(),
    isDeleted: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
});

const subscriptionListQuerySchema = z.object({
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
    tier: z.enum(SUBSCRIPTION_TIERS).optional(),
    billingCycle: z.enum(BILLING_CYCLES).optional(),
    businessId: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(300),
});

const subscriptionAssignSchema = z.object({
    planId: z.string().trim().min(1),
    status: z.enum(SUBSCRIPTION_STATUSES).default('ACTIVE'),
    durationDays: z.number().int().positive().max(3650).default(30),
});

const subscriptionChangePlanSchema = z.object({
    planId: z.string().trim().min(1),
    status: z.enum(SUBSCRIPTION_STATUSES).default('ACTIVE'),
    durationDays: z.number().int().positive().max(3650).default(30),
});

const subscriptionPatchSchema = z.object({
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
    endDate: z.coerce.date().nullable().optional(),
    nextRenewalDate: z.coerce.date().nullable().optional(),
    graceEndDate: z.coerce.date().nullable().optional(),
    maxBillsTotal: z.number().int().nullable().optional(),
    maxBillsPerMonth: z.number().int().nullable().optional(),
    maxStaffUsers: z.number().int().nullable().optional(),
    maxBusinesses: z.number().int().nullable().optional(),
    maxDevices: z.number().int().nullable().optional(),
    maxStorageMb: z.number().int().nullable().optional(),
    offlineOnly: z.boolean().optional(),
    cloudSyncAllowed: z.boolean().optional(),
    webDashboardAllowed: z.boolean().optional(),
    featureFlagsEnabled: z.array(z.string()).optional(),
}).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
});

const masterDataConfigSchema = z.object({
    categories: z.array(z.string().trim().min(1).max(80)).max(1000).optional(),
    units: z.array(z.string().trim().min(1).max(40)).max(1000).optional(),
});

type PlanRow = typeof plans.$inferSelect;
type SubscriptionRow = typeof subscriptions.$inferSelect;

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const buildNormalizedBusinessSettingsMap = (
    rows: Array<{ section: string; dataJson: Record<string, unknown> }>
) => {
    const bySection = new Map(rows.map((row) => [row.section, asRecord(row.dataJson)]));
    return Object.fromEntries(
        SETTINGS_SECTIONS.map((section) => [section, normalizeSettingsData(section, bySection.get(section) ?? {})])
    );
};

const mapAuditLogEntry = (entry: typeof adminAuditLogs.$inferSelect) => {
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
    if (invoiceType === 'CREDIT_NOTE_DOC') return 'RETURN_INWARD';
    if (invoiceType === 'DEBIT_NOTE_DOC') return 'RETURN_OUTWARD';
    return 'SALE';
};

const mapInvoicePaymentStatus = (status: typeof invoices.$inferSelect['paymentStatus']) => {
    if (status === 'PAID') return 'PAID';
    if (status === 'PARTIALLY_PAID') return 'PARTIAL';
    return 'PENDING';
};

const mapLegacyToInvoicePaymentStatus = (status: 'PAID' | 'PARTIAL' | 'PENDING'): typeof invoices.$inferSelect['paymentStatus'] => {
    if (status === 'PAID') return 'PAID';
    if (status === 'PARTIAL') return 'PARTIALLY_PAID';
    return 'UNPAID';
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
    const requestedWindow = Number(c.req.query('windowDays') ?? 30);
    const windowDays = Number.isFinite(requestedWindow) ? clamp(Math.round(requestedWindow), 7, 120) : 30;
    const currentWindowStart = new Date(now.getTime() - (windowDays * 24 * 60 * 60 * 1000));
    const previousWindowStart = new Date(now.getTime() - ((windowDays * 2) * 24 * 60 * 60 * 1000));

    const [userCountRows, recentUsersCurrentRows, recentUsersPreviousRows, activeSubs, planRows, pendingInviteRows, failedPaymentRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.createdAt, currentWindowStart)),
        db.select({ count: sql<number>`count(*)` }).from(users).where(and(gte(users.createdAt, previousWindowStart), lte(users.createdAt, currentWindowStart))),
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
        if (sub.createdAt <= currentWindowStart) previousRevenue += mrr;
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
            windowDays,
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

    let logs = rows.map(mapAuditLogEntry);

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

adminRoute.get('/audit-logs/:id', async (c) => {
    const db = c.get('db');
    const id = c.req.param('id');
    const relatedLimit = Math.min(Math.max(Number(c.req.query('relatedLimit') ?? 20), 1), 100);

    const targetRows = await db.select().from(adminAuditLogs).where(eq(adminAuditLogs.id, id)).limit(1);
    const target = targetRows[0];
    if (!target) return c.json({ ok: false, message: 'Audit log not found.' }, 404);

    const relatedByEntity = (target.entityType && target.entityId)
        ? await db.select().from(adminAuditLogs).where(and(
            eq(adminAuditLogs.entityType, target.entityType),
            eq(adminAuditLogs.entityId, target.entityId),
        )).orderBy(desc(adminAuditLogs.createdAt)).limit(relatedLimit)
        : [];

    const relatedByActor = await db.select().from(adminAuditLogs).where(eq(adminAuditLogs.adminEmail, target.adminEmail))
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(relatedLimit);

    return c.json({
        ok: true,
        entry: mapAuditLogEntry(target),
        relatedByEntity: relatedByEntity.filter((entry) => entry.id !== target.id).map(mapAuditLogEntry),
        relatedByActor: relatedByActor.filter((entry) => entry.id !== target.id).map(mapAuditLogEntry),
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
            state: entry.state,
            legalName: entry.legalName,
            pan: entry.pan,
            category: entry.category,
            booksStartDate: entry.booksStartDate,
            logoUrl: entry.logoUrl,
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
            booksStartDate: entry.booksStartDate,
            logoUrl: entry.logoUrl,
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
            booksStartDate: payload.booksStartDate ?? now,
            logoUrl: payload.logoUrl ?? null,
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
            ...(payload.booksStartDate !== undefined ? { booksStartDate: payload.booksStartDate } : {}),
            ...(payload.logoUrl !== undefined ? { logoUrl: payload.logoUrl } : {}),
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

adminRoute.delete('/organizations/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const existing = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
        const business = existing[0];
        if (!business) return c.json({ ok: false, message: 'Organization not found.' }, 404);

        const currentSettings = asRecord(business.settings);
        await db.update(businesses).set({
            isActive: false,
            settings: {
                ...currentSettings,
                deletedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
        }).where(eq(businesses.id, id));
        await db.update(businessMembers).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(businessMembers.businessId, id));

        await appendAuditLog(c, 'ORGANIZATION_SOFT_DELETED', 'business', id);
        return c.json({ ok: true, softDeleted: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete organization.' }, 400);
    }
});

adminRoute.get('/businesses/:id/quotas', async (c) => {
    const db = c.get('db');
    const businessId = c.req.param('id');
    const rows = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    const business = rows[0];
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

    const settings = asRecord(business.settings);
    const quotas = asRecord(settings.quotas);
    return c.json({
        ok: true,
        quotas: {
            maxInvoicesTotal: typeof quotas.maxInvoicesTotal === 'number' ? quotas.maxInvoicesTotal : null,
            maxStaffUsers: typeof quotas.maxStaffUsers === 'number' ? quotas.maxStaffUsers : null,
            storageLimitMb: typeof quotas.storageLimitMb === 'number' ? quotas.storageLimitMb : null,
        },
    });
});

adminRoute.patch('/businesses/:id/quotas', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const businessId = c.req.param('id');
        const payload = businessQuotaPatchSchema.parse(await c.req.json());

        const rows = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
        const business = rows[0];
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

        const settings = asRecord(business.settings);
        const currentQuotas = asRecord(settings.quotas);
        const nextQuotas = {
            maxInvoicesTotal: payload.maxInvoicesTotal ?? (typeof currentQuotas.maxInvoicesTotal === 'number' ? currentQuotas.maxInvoicesTotal : null),
            maxStaffUsers: payload.maxStaffUsers ?? (typeof currentQuotas.maxStaffUsers === 'number' ? currentQuotas.maxStaffUsers : null),
            storageLimitMb: payload.storageLimitMb ?? (typeof currentQuotas.storageLimitMb === 'number' ? currentQuotas.storageLimitMb : null),
        };

        await db.update(businesses).set({
            settings: {
                ...settings,
                quotas: nextQuotas,
            },
            updatedAt: new Date(),
        }).where(eq(businesses.id, businessId));

        await appendAuditLog(c, 'BUSINESS_QUOTAS_UPDATED', 'business', businessId, nextQuotas);
        return c.json({ ok: true, quotas: nextQuotas });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update business quotas.' }, 400);
    }
});

adminRoute.get('/subscriptions', async (c) => {
    const db = c.get('db');
    const query = subscriptionListQuerySchema.parse({
        status: c.req.query('status') ?? undefined,
        tier: c.req.query('tier') ?? undefined,
        billingCycle: c.req.query('billingCycle') ?? undefined,
        businessId: c.req.query('businessId') ?? undefined,
        search: c.req.query('search') ?? undefined,
        limit: c.req.query('limit') ?? undefined,
    });

    const whereClauses: SQL[] = [];
    if (query.status) whereClauses.push(eq(subscriptions.status, query.status));
    if (query.tier) whereClauses.push(eq(subscriptions.tier, query.tier));
    if (query.billingCycle) whereClauses.push(eq(subscriptions.billingCycle, query.billingCycle));
    if (query.businessId) whereClauses.push(eq(subscriptions.businessId, query.businessId));

    const rows = whereClauses.length > 0
        ? await db.select().from(subscriptions).where(and(...whereClauses)).orderBy(desc(subscriptions.createdAt)).limit(query.limit)
        : await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(query.limit);

    const businessIds = Array.from(new Set(rows.map((entry) => entry.businessId)));
    const businessRows = businessIds.length > 0
        ? await db.select().from(businesses).where(inArray(businesses.id, businessIds))
        : [];
    const businessById = new Map(businessRows.map((entry) => [entry.id, entry]));

    const ownerIds = Array.from(new Set(businessRows.map((entry) => entry.ownerUserId)));
    const ownerRows = ownerIds.length > 0
        ? await db.select().from(users).where(inArray(users.id, ownerIds))
        : [];
    const ownerById = new Map(ownerRows.map((entry) => [entry.id, entry]));

    const planRows = await db.select().from(plans);
    const planByTierCycle = new Map<string, PlanRow>();
    for (const plan of planRows) {
        if (!planByTierCycle.has(tierCycleKey(plan.tier, plan.billingCycle))) {
            planByTierCycle.set(tierCycleKey(plan.tier, plan.billingCycle), plan);
        }
    }

    let mappedRows = rows.map((entry) => {
        const business = businessById.get(entry.businessId) ?? null;
        const owner = business ? ownerById.get(business.ownerUserId) ?? null : null;
        const linkedPlan = planByTierCycle.get(tierCycleKey(entry.tier, entry.billingCycle)) ?? null;
        const monthlyAmount = linkedPlan
            ? Number(toMonthlyAmount(Number(linkedPlan.pricePerCycle), linkedPlan.billingCycle))
            : null;

        return {
            id: entry.id,
            businessId: entry.businessId,
            businessName: business?.name ?? 'Unknown Business',
            businessCode: business?.code ?? null,
            businessIsActive: business?.isActive ?? false,
            ownerUserId: business?.ownerUserId ?? null,
            ownerName: owner?.name ?? null,
            ownerEmail: owner?.email ?? null,
            tier: entry.tier,
            billingCycle: entry.billingCycle,
            status: entry.status,
            startDate: entry.startDate,
            endDate: entry.endDate,
            nextRenewalDate: entry.nextRenewalDate,
            graceEndDate: entry.graceEndDate,
            maxBillsTotal: entry.maxBillsTotal,
            maxBillsPerMonth: entry.maxBillsPerMonth,
            maxStaffUsers: entry.maxStaffUsers,
            maxBusinesses: entry.maxBusinesses,
            maxDevices: entry.maxDevices,
            maxStorageMb: entry.maxStorageMb,
            offlineOnly: entry.offlineOnly,
            cloudSyncAllowed: entry.cloudSyncAllowed,
            webDashboardAllowed: entry.webDashboardAllowed,
            featureFlagsEnabled: entry.featureFlagsEnabled,
            planId: linkedPlan?.id ?? null,
            planDisplayName: linkedPlan?.displayName ?? `${entry.tier} ${entry.billingCycle ?? ''}`.trim(),
            monthlyAmount,
            currency: linkedPlan?.currency ?? 'INR',
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        };
    });

    if (query.search) {
        const queryText = query.search.toLowerCase();
        mappedRows = mappedRows.filter((entry) => (
            entry.id.toLowerCase().includes(queryText)
            || entry.businessName.toLowerCase().includes(queryText)
            || (entry.businessCode?.toLowerCase().includes(queryText) ?? false)
            || (entry.ownerName?.toLowerCase().includes(queryText) ?? false)
            || (entry.ownerEmail?.toLowerCase().includes(queryText) ?? false)
            || entry.tier.toLowerCase().includes(queryText)
            || (entry.billingCycle?.toLowerCase().includes(queryText) ?? false)
            || entry.status.toLowerCase().includes(queryText)
            || (entry.planDisplayName?.toLowerCase().includes(queryText) ?? false)
        ));
    }

    const summary = {
        total: mappedRows.length,
        byStatus: Object.fromEntries(SUBSCRIPTION_STATUSES.map((entry) => [entry, 0])) as Record<string, number>,
        byTier: Object.fromEntries(SUBSCRIPTION_TIERS.map((entry) => [entry, 0])) as Record<string, number>,
        byCycle: {
            MONTHLY: 0,
            YEARLY: 0,
            THREE_YEAR: 0,
            NONE: 0,
        } as Record<string, number>,
    };

    for (const entry of mappedRows) {
        summary.byStatus[entry.status] = (summary.byStatus[entry.status] ?? 0) + 1;
        summary.byTier[entry.tier] = (summary.byTier[entry.tier] ?? 0) + 1;
        if (entry.billingCycle) {
            summary.byCycle[entry.billingCycle] = (summary.byCycle[entry.billingCycle] ?? 0) + 1;
        } else {
            summary.byCycle.NONE += 1;
        }
    }

    return c.json({
        ok: true,
        subscriptions: mappedRows,
        summary,
    });
});

adminRoute.post('/businesses/:id/subscription', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const businessId = c.req.param('id');
        const payload = subscriptionAssignSchema.parse(await c.req.json());

        const [businessRows, planRows] = await Promise.all([
            db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1),
            db.select().from(plans).where(eq(plans.id, payload.planId)).limit(1),
        ]);
        const business = businessRows[0];
        const plan = planRows[0];
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        if (!plan) return c.json({ ok: false, message: 'Plan not found.' }, 404);

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + payload.durationDays);

        const createdId = `sub_${nanoid(18)}`;
        await db.insert(subscriptions).values({
            id: createdId,
            businessId,
            tier: plan.tier,
            billingCycle: plan.billingCycle,
            status: payload.status,
            startDate,
            endDate,
            nextRenewalDate: payload.status === 'ACTIVE' ? endDate : null,
            graceEndDate: payload.status === 'GRACE' ? new Date(endDate.getTime() + (7 * 24 * 60 * 60 * 1000)) : null,
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

        await appendAuditLog(c, 'BUSINESS_SUBSCRIPTION_ASSIGNED', 'business', businessId, {
            subscriptionId: createdId,
            planId: plan.id,
            status: payload.status,
            durationDays: payload.durationDays,
        });

        return c.json({ ok: true, id: createdId });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to assign subscription.' }, 400);
    }
});

adminRoute.patch('/subscriptions/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = subscriptionPatchSchema.parse(await c.req.json());

        const updated = await db.update(subscriptions).set({
            ...(payload.status !== undefined ? { status: payload.status } : {}),
            ...(payload.endDate !== undefined ? { endDate: payload.endDate } : {}),
            ...(payload.nextRenewalDate !== undefined ? { nextRenewalDate: payload.nextRenewalDate } : {}),
            ...(payload.graceEndDate !== undefined ? { graceEndDate: payload.graceEndDate } : {}),
            ...(payload.maxBillsTotal !== undefined ? { maxBillsTotal: payload.maxBillsTotal } : {}),
            ...(payload.maxBillsPerMonth !== undefined ? { maxBillsPerMonth: payload.maxBillsPerMonth } : {}),
            ...(payload.maxStaffUsers !== undefined ? { maxStaffUsers: payload.maxStaffUsers } : {}),
            ...(payload.maxBusinesses !== undefined ? { maxBusinesses: payload.maxBusinesses } : {}),
            ...(payload.maxDevices !== undefined ? { maxDevices: payload.maxDevices } : {}),
            ...(payload.maxStorageMb !== undefined ? { maxStorageMb: payload.maxStorageMb } : {}),
            ...(payload.offlineOnly !== undefined ? { offlineOnly: payload.offlineOnly } : {}),
            ...(payload.cloudSyncAllowed !== undefined ? { cloudSyncAllowed: payload.cloudSyncAllowed } : {}),
            ...(payload.webDashboardAllowed !== undefined ? { webDashboardAllowed: payload.webDashboardAllowed } : {}),
            ...(payload.featureFlagsEnabled !== undefined ? { featureFlagsEnabled: payload.featureFlagsEnabled } : {}),
            updatedAt: new Date(),
        }).where(eq(subscriptions.id, id)).returning({ id: subscriptions.id, businessId: subscriptions.businessId });

        if (!updated[0]) return c.json({ ok: false, message: 'Subscription not found.' }, 404);

        await appendAuditLog(c, 'SUBSCRIPTION_UPDATED', 'subscription', id, payload as Record<string, unknown>);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update subscription.' }, 400);
    }
});

adminRoute.post('/subscriptions/:id/change-plan', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = subscriptionChangePlanSchema.parse(await c.req.json());

        const [subRows, planRows] = await Promise.all([
            db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1),
            db.select().from(plans).where(eq(plans.id, payload.planId)).limit(1),
        ]);
        const subscription = subRows[0];
        const plan = planRows[0];
        if (!subscription) return c.json({ ok: false, message: 'Subscription not found.' }, 404);
        if (!plan) return c.json({ ok: false, message: 'Plan not found.' }, 404);

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + payload.durationDays);

        await db.update(subscriptions).set({
            tier: plan.tier,
            billingCycle: plan.billingCycle,
            status: payload.status,
            startDate,
            endDate,
            nextRenewalDate: payload.status === 'ACTIVE' ? endDate : null,
            graceEndDate: payload.status === 'GRACE' ? new Date(endDate.getTime() + (7 * 24 * 60 * 60 * 1000)) : null,
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
            updatedAt: new Date(),
        }).where(eq(subscriptions.id, id));

        await appendAuditLog(c, 'SUBSCRIPTION_PLAN_CHANGED', 'subscription', id, {
            planId: plan.id,
            status: payload.status,
            durationDays: payload.durationDays,
        });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to change subscription plan.' }, 400);
    }
});

adminRoute.post('/subscriptions/:id/cancel', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const now = new Date();
        const updated = await db.update(subscriptions).set({
            status: 'CANCELLED',
            endDate: now,
            nextRenewalDate: null,
            graceEndDate: null,
            updatedAt: now,
        }).where(eq(subscriptions.id, id)).returning({ id: subscriptions.id });

        if (!updated[0]) return c.json({ ok: false, message: 'Subscription not found.' }, 404);
        await appendAuditLog(c, 'SUBSCRIPTION_CANCELLED', 'subscription', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to cancel subscription.' }, 400);
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
    const query = transactionListQuerySchema.parse({
        businessId: c.req.query('businessId'),
        paymentStatus: c.req.query('paymentStatus'),
        q: c.req.query('q'),
        includeDeleted: c.req.query('includeDeleted') ?? 'false',
        limit: c.req.query('limit') ?? 500,
    });

    const conditions: SQL<unknown>[] = [];
    if (query.businessId) conditions.push(eq(invoices.businessId, query.businessId));
    if (!query.includeDeleted) conditions.push(eq(invoices.isDeleted, false));
    if (query.paymentStatus === 'PAID') {
        conditions.push(eq(invoices.paymentStatus, 'PAID'));
    } else if (query.paymentStatus === 'PARTIAL') {
        conditions.push(eq(invoices.paymentStatus, 'PARTIALLY_PAID'));
    } else if (query.paymentStatus === 'PENDING') {
        conditions.push(inArray(invoices.paymentStatus, ['UNPAID', 'OVERDUE']));
    }
    if (query.q) {
        const search = `%${query.q}%`;
        conditions.push(or(
            ilike(invoices.id, search),
            ilike(invoices.invoiceNumber, search),
            ilike(invoices.notes, search),
        ) as SQL<unknown>);
    }

    const invoiceRows = conditions.length > 0
        ? await db.select().from(invoices).where(and(...conditions)).orderBy(desc(invoices.createdAt)).limit(query.limit)
        : await db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(query.limit);
    const businessIds = Array.from(new Set(invoiceRows.map((entry) => entry.businessId)));
    const businessRows = businessIds.length > 0
        ? await db.select().from(businesses).where(inArray(businesses.id, businessIds))
        : [];
    const businessById = new Map(businessRows.map((entry) => [entry.id, entry]));

    return c.json({
        ok: true,
        transactions: invoiceRows.map((entry) => ({
            id: entry.id,
            businessId: entry.businessId,
            userId: entry.createdByUserId ?? businessById.get(entry.businessId)?.ownerUserId ?? '',
            invoiceNumber: entry.invoiceNumber,
            invoiceType: entry.invoiceType,
            type: mapInvoiceTypeToLegacyTransactionType(entry.invoiceType),
            totalAmount: Number(entry.totalInvoiceValue ?? 0),
            paymentStatus: mapInvoicePaymentStatus(entry.paymentStatus),
            paymentStatusRaw: entry.paymentStatus,
            paidAmount: Number(entry.paidAmount ?? 0),
            paymentMode: 'CASH',
            dueDate: entry.dueDate,
            notes: entry.notes ?? null,
            isDeleted: entry.isDeleted,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            organizationName: businessById.get(entry.businessId)?.name ?? 'Unknown',
        })),
    });
});

adminRoute.patch('/transactions/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = transactionPatchSchema.parse(await c.req.json());

        const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
        const invoice = rows[0];
        if (!invoice) return c.json({ ok: false, message: 'Transaction not found.' }, 404);

        const nextPaidAmount = payload.paidAmount ?? Number(invoice.paidAmount ?? 0);
        const nextStatus = payload.paymentStatus
            ? mapLegacyToInvoicePaymentStatus(payload.paymentStatus)
            : payload.paidAmount !== undefined
                ? (nextPaidAmount >= Number(invoice.totalInvoiceValue ?? 0)
                    ? 'PAID'
                    : nextPaidAmount > 0
                        ? 'PARTIALLY_PAID'
                        : 'UNPAID')
                : invoice.paymentStatus;

        await db.update(invoices).set({
            ...(payload.paidAmount !== undefined ? { paidAmount: payload.paidAmount } : {}),
            ...(payload.paymentStatus !== undefined || payload.paidAmount !== undefined ? { paymentStatus: nextStatus } : {}),
            ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
            ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
            ...(payload.isDeleted !== undefined ? { isDeleted: payload.isDeleted } : {}),
            updatedAt: new Date(),
        }).where(eq(invoices.id, id));

        await appendAuditLog(c, 'TRANSACTION_UPDATED', 'invoice', id, payload as Record<string, unknown>);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update transaction.' }, 400);
    }
});

adminRoute.post('/transactions/:id/mark-paid', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
        const invoice = rows[0];
        if (!invoice) return c.json({ ok: false, message: 'Transaction not found.' }, 404);

        await db.update(invoices).set({
            paymentStatus: 'PAID',
            paidAmount: Number(invoice.totalInvoiceValue ?? 0),
            isDeleted: false,
            updatedAt: new Date(),
        }).where(eq(invoices.id, id));

        await appendAuditLog(c, 'TRANSACTION_MARKED_PAID', 'invoice', id, {
            paidAmount: Number(invoice.totalInvoiceValue ?? 0),
        });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to mark transaction paid.' }, 400);
    }
});

adminRoute.delete('/transactions/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
        if (!rows[0]) return c.json({ ok: false, message: 'Transaction not found.' }, 404);

        await db.update(invoices).set({
            isDeleted: true,
            updatedAt: new Date(),
        }).where(eq(invoices.id, id));
        await appendAuditLog(c, 'TRANSACTION_SOFT_DELETED', 'invoice', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete transaction.' }, 400);
    }
});

adminRoute.post('/transactions/:id/restore', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
        if (!rows[0]) return c.json({ ok: false, message: 'Transaction not found.' }, 404);

        await db.update(invoices).set({
            isDeleted: false,
            updatedAt: new Date(),
        }).where(eq(invoices.id, id));
        await appendAuditLog(c, 'TRANSACTION_RESTORED', 'invoice', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to restore transaction.' }, 400);
    }
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
            businessId: entry.businessId,
            name: entry.name,
            category: entry.category ?? 'Uncategorized',
            unit: entry.unit ?? 'pcs',
            stock: Number(entry.stock ?? 0),
            price: Number(entry.salePrice ?? 0),
            isActive: entry.isActive,
            organizationName: businessById.get(entry.businessId)?.name ?? 'Unknown',
        })),
    });
});

adminRoute.get('/inventory/items', async (c) => {
    const db = c.get('db');
    const query = inventoryAdminListQuerySchema.parse({
        businessId: c.req.query('businessId'),
        q: c.req.query('q'),
        includeInactive: c.req.query('includeInactive') ?? 'false',
        limit: c.req.query('limit') ?? 500,
    });

    const conditions: SQL<unknown>[] = [];
    if (query.businessId) conditions.push(eq(items.businessId, query.businessId));
    if (!query.includeInactive) conditions.push(eq(items.isActive, true));
    if (query.q) {
        const searchTerm = `%${query.q}%`;
        conditions.push(or(
            ilike(items.name, searchTerm),
            ilike(items.nameLowercase, `%${query.q.toLowerCase()}%`),
            ilike(items.category, searchTerm),
            ilike(items.unit, searchTerm),
            ilike(items.barcode, searchTerm),
            ilike(items.sku, searchTerm),
        ) as SQL<unknown>);
    }

    const rows = conditions.length > 0
        ? await db.select().from(items).where(and(...conditions)).orderBy(desc(items.updatedAt)).limit(query.limit)
        : await db.select().from(items).orderBy(desc(items.updatedAt)).limit(query.limit);

    const businessIds = Array.from(new Set(rows.map((entry) => entry.businessId)));
    const businessRows = businessIds.length > 0
        ? await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, businessIds))
        : [];
    const businessById = new Map(businessRows.map((entry) => [entry.id, entry.name]));

    return c.json({
        ok: true,
        items: rows.map((entry) => ({
            id: entry.id,
            businessId: entry.businessId,
            businessName: businessById.get(entry.businessId) ?? 'Unknown',
            name: entry.name,
            sku: entry.sku,
            barcode: entry.barcode,
            category: entry.category ?? 'Uncategorized',
            unit: entry.unit ?? 'pcs',
            stock: Number(entry.stock ?? 0),
            salePrice: Number(entry.salePrice ?? 0),
            purchasePrice: Number(entry.purchasePrice ?? 0),
            mrp: Number(entry.mrp ?? 0),
            reorderLevel: Number(entry.reorderLevel ?? 0),
            isActive: entry.isActive,
            updatedAt: entry.updatedAt,
            createdAt: entry.createdAt,
        })),
    });
});

adminRoute.patch('/inventory/items/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const authUser = c.get('authUser');
        const id = c.req.param('id');
        const payload = inventoryAdminPatchSchema.parse(await c.req.json());

        const existingRows = await db.select().from(items).where(eq(items.id, id)).limit(1);
        const existing = existingRows[0];
        if (!existing) return c.json({ ok: false, message: 'Item not found.' }, 404);

        const now = new Date();
        const patch: Partial<typeof items.$inferInsert> = { updatedAt: now };
        if (payload.name !== undefined) {
            patch.name = payload.name;
            patch.nameLowercase = payload.name.toLowerCase();
        }
        if (payload.category !== undefined) patch.category = payload.category ?? null;
        if (payload.unit !== undefined) patch.unit = payload.unit ?? null;
        if (payload.salePrice !== undefined) patch.salePrice = payload.salePrice;
        if (payload.purchasePrice !== undefined) patch.purchasePrice = payload.purchasePrice;
        if (payload.mrp !== undefined) patch.mrp = payload.mrp;
        if (payload.reorderLevel !== undefined) patch.reorderLevel = payload.reorderLevel;
        if (payload.isActive !== undefined) patch.isActive = payload.isActive;
        if (payload.stock !== undefined) patch.stock = payload.stock;

        await db.update(items).set(patch).where(eq(items.id, id));

        if (payload.stock !== undefined) {
            const currentStock = Number(existing.stock ?? 0);
            const delta = payload.stock - currentStock;
            if (delta !== 0) {
                await db.insert(inventoryMovements).values({
                    id: `mov_${nanoid(16)}`,
                    businessId: existing.businessId,
                    itemId: existing.id,
                    movementType: 'ADMIN_SET',
                    quantity: delta,
                    balanceAfter: payload.stock,
                    reason: 'Stock set by admin panel',
                    createdByUserId: authUser?.id ?? null,
                    createdAt: now,
                });
            }
        }

        await appendAuditLog(c, 'INVENTORY_ITEM_UPDATED', 'item', id, {
            businessId: existing.businessId,
            changedFields: Object.keys(payload),
        });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update inventory item.' }, 400);
    }
});

adminRoute.post('/inventory/items/:id/adjust', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const authUser = c.get('authUser');
        const id = c.req.param('id');
        const payload = inventoryAdminAdjustSchema.parse(await c.req.json());

        const rows = await db.select().from(items).where(eq(items.id, id)).limit(1);
        const item = rows[0];
        if (!item) return c.json({ ok: false, message: 'Item not found.' }, 404);

        const now = new Date();
        const currentStock = Number(item.stock ?? 0);
        const nextStock = currentStock + payload.delta;

        await db.update(items).set({
            stock: nextStock,
            updatedAt: now,
        }).where(eq(items.id, id));

        await db.insert(inventoryMovements).values({
            id: `mov_${nanoid(16)}`,
            businessId: item.businessId,
            itemId: item.id,
            movementType: payload.delta >= 0 ? 'ADMIN_ADJUST_IN' : 'ADMIN_ADJUST_OUT',
            quantity: payload.delta,
            balanceAfter: nextStock,
            reason: payload.reason ?? 'Adjusted from admin panel',
            createdByUserId: authUser?.id ?? null,
            createdAt: now,
        });

        await appendAuditLog(c, 'INVENTORY_STOCK_ADJUSTED', 'item', id, {
            businessId: item.businessId,
            delta: payload.delta,
            nextStock,
        });

        return c.json({ ok: true, stock: nextStock });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to adjust stock.' }, 400);
    }
});

adminRoute.post('/inventory/items/:id/restore', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');

        const rows = await db.select().from(items).where(eq(items.id, id)).limit(1);
        const item = rows[0];
        if (!item) return c.json({ ok: false, message: 'Item not found.' }, 404);

        await db.update(items).set({
            isActive: true,
            updatedAt: new Date(),
        }).where(eq(items.id, id));

        await appendAuditLog(c, 'INVENTORY_ITEM_RESTORED', 'item', id, {
            businessId: item.businessId,
        });

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to restore item.' }, 400);
    }
});

adminRoute.delete('/inventory/items/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select().from(items).where(eq(items.id, id)).limit(1);
        const item = rows[0];
        if (!item) return c.json({ ok: false, message: 'Item not found.' }, 404);

        await db.update(items).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(items.id, id));

        await appendAuditLog(c, 'INVENTORY_ITEM_DEACTIVATED', 'item', id, {
            businessId: item.businessId,
        });

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to deactivate item.' }, 400);
    }
});

adminRoute.delete('/inventory/items/:id/permanent', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select().from(items).where(eq(items.id, id)).limit(1);
        const item = rows[0];
        if (!item) return c.json({ ok: false, message: 'Item not found.' }, 404);
        if (item.isActive) {
            return c.json({ ok: false, message: 'Deactivate item before permanent delete.' }, 409);
        }

        await db.delete(items).where(eq(items.id, id));

        await appendAuditLog(c, 'INVENTORY_ITEM_PERMANENT_DELETE', 'item', id, {
            businessId: item.businessId,
        });

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to permanently delete item.' }, 400);
    }
});

adminRoute.get('/parties', async (c) => {
    const db = c.get('db');
    const query = partyAdminListQuerySchema.parse({
        businessId: c.req.query('businessId'),
        q: c.req.query('q'),
        type: c.req.query('type') ?? undefined,
        includeInactive: c.req.query('includeInactive') ?? 'false',
        limit: c.req.query('limit') ?? 500,
    });

    const conditions: SQL<unknown>[] = [];
    if (query.businessId) conditions.push(eq(parties.businessId, query.businessId));
    if (!query.includeInactive) conditions.push(eq(parties.isActive, true));
    if (query.type) conditions.push(eq(parties.type, query.type));
    if (query.q) {
        const searchTerm = `%${query.q}%`;
        conditions.push(or(
            ilike(parties.name, searchTerm),
            ilike(parties.nameLowercase, `%${query.q.toLowerCase()}%`),
            ilike(parties.phone, searchTerm),
            ilike(parties.email, searchTerm),
            ilike(parties.gstin, searchTerm),
        ) as SQL<unknown>);
    }

    const rows = conditions.length > 0
        ? await db.select().from(parties).where(and(...conditions)).orderBy(desc(parties.updatedAt)).limit(query.limit)
        : await db.select().from(parties).orderBy(desc(parties.updatedAt)).limit(query.limit);

    const businessIds = Array.from(new Set(rows.map((entry) => entry.businessId)));
    const businessRows = businessIds.length > 0
        ? await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, businessIds))
        : [];
    const businessById = new Map(businessRows.map((entry) => [entry.id, entry.name]));

    const summary = {
        total: rows.length,
        active: rows.filter((entry) => entry.isActive).length,
        inactive: rows.filter((entry) => !entry.isActive).length,
        customers: rows.filter((entry) => entry.type === 'CUSTOMER').length,
        suppliers: rows.filter((entry) => entry.type === 'SUPPLIER').length,
    };

    return c.json({
        ok: true,
        summary,
        parties: rows.map((entry) => ({
            id: entry.id,
            businessId: entry.businessId,
            businessName: businessById.get(entry.businessId) ?? 'Unknown',
            type: entry.type,
            name: entry.name,
            phone: entry.phone,
            email: entry.email,
            billingAddress: entry.billingAddress,
            gstin: entry.gstin,
            openingBalance: Number(entry.openingBalance ?? 0),
            creditLimit: Number(entry.creditLimit ?? 0),
            loyaltyPoints: Number(entry.loyaltyPoints ?? 0),
            isActive: entry.isActive,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        })),
    });
});

adminRoute.patch('/parties/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = partyAdminPatchSchema.parse(await c.req.json());

        const rows = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
        const party = rows[0];
        if (!party) return c.json({ ok: false, message: 'Party not found.' }, 404);

        const patch: Partial<typeof parties.$inferInsert> = {
            updatedAt: new Date(),
        };
        if (payload.name !== undefined) {
            patch.name = payload.name;
            patch.nameLowercase = payload.name.toLowerCase();
        }
        if (payload.type !== undefined) patch.type = payload.type;
        if (payload.phone !== undefined) patch.phone = payload.phone ?? null;
        if (payload.email !== undefined) patch.email = payload.email ?? null;
        if (payload.billingAddress !== undefined) patch.billingAddress = payload.billingAddress ?? null;
        if (payload.gstin !== undefined) patch.gstin = payload.gstin?.toUpperCase() ?? null;
        if (payload.openingBalance !== undefined) patch.openingBalance = payload.openingBalance;
        if (payload.creditLimit !== undefined) patch.creditLimit = payload.creditLimit;
        if (payload.loyaltyPoints !== undefined) patch.loyaltyPoints = payload.loyaltyPoints;
        if (payload.isActive !== undefined) patch.isActive = payload.isActive;

        await db.update(parties).set(patch).where(eq(parties.id, id));
        await appendAuditLog(c, 'PARTY_UPDATED', 'party', id, {
            businessId: party.businessId,
            changedFields: Object.keys(payload),
        });

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update party.' }, 400);
    }
});

adminRoute.post('/parties/:id/restore', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
        const party = rows[0];
        if (!party) return c.json({ ok: false, message: 'Party not found.' }, 404);

        await db.update(parties).set({
            isActive: true,
            updatedAt: new Date(),
        }).where(eq(parties.id, id));

        await appendAuditLog(c, 'PARTY_RESTORED', 'party', id, { businessId: party.businessId });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to restore party.' }, 400);
    }
});

adminRoute.delete('/parties/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
        const party = rows[0];
        if (!party) return c.json({ ok: false, message: 'Party not found.' }, 404);

        await db.update(parties).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(parties.id, id));

        await appendAuditLog(c, 'PARTY_DEACTIVATED', 'party', id, { businessId: party.businessId });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to deactivate party.' }, 400);
    }
});

adminRoute.delete('/parties/:id/permanent', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
        const party = rows[0];
        if (!party) return c.json({ ok: false, message: 'Party not found.' }, 404);
        if (party.isActive) {
            return c.json({ ok: false, message: 'Deactivate party before permanent delete.' }, 409);
        }

        await db.delete(parties).where(eq(parties.id, id));
        await appendAuditLog(c, 'PARTY_PERMANENT_DELETE', 'party', id, { businessId: party.businessId });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to permanently delete party.' }, 400);
    }
});

adminRoute.get('/reporting/governance', async (c) => {
    const db = c.get('db');
    const businessRows = await db.select({
        id: businesses.id,
        name: businesses.name,
        code: businesses.code,
        isActive: businesses.isActive,
        updatedAt: businesses.updatedAt,
    }).from(businesses).orderBy(asc(businesses.name));

    const businessIds = businessRows.map((entry) => entry.id);
    const [subscriptionRows, settingsRows, templateRows] = await Promise.all([
        businessIds.length > 0
            ? db.select().from(subscriptions).where(inArray(subscriptions.businessId, businessIds)).orderBy(desc(subscriptions.createdAt))
            : Promise.resolve([]),
        businessIds.length > 0
            ? db.select({
                businessId: businessSettings.businessId,
                section: businessSettings.section,
                dataJson: businessSettings.dataJson,
            }).from(businessSettings).where(and(
                inArray(businessSettings.businessId, businessIds),
                inArray(businessSettings.section, ['TAXES_AND_GST', 'INVOICE_PRINT']),
            ))
            : Promise.resolve([]),
        businessIds.length > 0
            ? db.select({
                businessId: templates.businessId,
                type: templates.type,
                isActive: templates.isActive,
            }).from(templates).where(inArray(templates.businessId, businessIds))
            : Promise.resolve([]),
    ]);

    const latestSubscriptionByBusiness = new Map<string, typeof subscriptions.$inferSelect>();
    for (const row of subscriptionRows) {
        if (!latestSubscriptionByBusiness.has(row.businessId)) {
            latestSubscriptionByBusiness.set(row.businessId, row);
        }
    }

    const settingsByBusiness = new Map<string, Record<string, Record<string, unknown>>>();
    for (const row of settingsRows) {
        const current = settingsByBusiness.get(row.businessId) ?? {};
        current[row.section] = asRecord(row.dataJson);
        settingsByBusiness.set(row.businessId, current);
    }

    const templateStateByBusiness = new Map<string, { invoice: number; card: number }>();
    for (const row of templateRows) {
        if (!row.businessId || !row.isActive) continue;
        const current = templateStateByBusiness.get(row.businessId) ?? { invoice: 0, card: 0 };
        if (row.type === 'invoice') current.invoice += 1;
        if (row.type === 'card') current.card += 1;
        templateStateByBusiness.set(row.businessId, current);
    }

    const rows = businessRows.map((business) => {
        const subscription = latestSubscriptionByBusiness.get(business.id) ?? null;
        const settings = settingsByBusiness.get(business.id) ?? {};
        const taxSettings = asRecord(settings.TAXES_AND_GST);
        const printSettings = asRecord(settings.INVOICE_PRINT);
        const templatesState = templateStateByBusiness.get(business.id) ?? { invoice: 0, card: 0 };
        const gstEnabled = taxSettings.gst_enabled !== false;
        const exportPdfEnabled = Boolean(subscription?.featureFlagsEnabled?.includes('EXPORT_PDF'));
        const thermalReady =
            printSettings.print_layout_type === 'THERMAL'
            || Boolean(printSettings.thermal_profile_preset);
        const businessCardReady = templatesState.card > 0;

        return {
            businessId: business.id,
            businessName: business.name,
            businessCode: business.code,
            businessIsActive: business.isActive,
            subscriptionTier: subscription?.tier ?? 'FREE',
            subscriptionStatus: subscription?.status ?? 'EXPIRED',
            gstEnabled,
            exportPdfEnabled,
            thermalReady,
            businessCardReady,
            invoiceTemplateCount: templatesState.invoice,
            cardTemplateCount: templatesState.card,
            updatedAt: business.updatedAt,
        };
    });

    const summary = {
        totalBusinesses: rows.length,
        gstReadyBusinesses: rows.filter((entry) => entry.gstEnabled).length,
        pdfExportBusinesses: rows.filter((entry) => entry.exportPdfEnabled).length,
        thermalReadyBusinesses: rows.filter((entry) => entry.thermalReady).length,
        businessCardBusinesses: rows.filter((entry) => entry.businessCardReady).length,
    };

    return c.json({ ok: true, summary, rows });
});

adminRoute.get('/sync/diagnostics', async (c) => {
    const db = c.get('db');
    const businessRows = await db.select({
        id: businesses.id,
        name: businesses.name,
        code: businesses.code,
        isActive: businesses.isActive,
        updatedAt: businesses.updatedAt,
    }).from(businesses).orderBy(asc(businesses.name));

    const businessIds = businessRows.map((entry) => entry.id);
    const [subscriptionRows, queuedDeliveries, liveSnapshot] = await Promise.all([
        businessIds.length > 0
            ? db.select().from(subscriptions).where(inArray(subscriptions.businessId, businessIds)).orderBy(desc(subscriptions.createdAt))
            : Promise.resolve([]),
        db.select({ count: sql<number>`count(*)` })
            .from(notificationDeliveries)
            .where(inArray(notificationDeliveries.status, ['QUEUED', 'FAILED'])),
        getLiveSnapshot(db),
    ]);

    const latestSubscriptionByBusiness = new Map<string, typeof subscriptions.$inferSelect>();
    for (const row of subscriptionRows) {
        if (!latestSubscriptionByBusiness.has(row.businessId)) {
            latestSubscriptionByBusiness.set(row.businessId, row);
        }
    }

    const rows = businessRows.map((business) => {
        const subscription = latestSubscriptionByBusiness.get(business.id) ?? null;
        const hasCloudSyncFlag = Boolean(subscription?.featureFlagsEnabled?.includes('CLOUD_SYNC'));
        const status = subscription?.status ?? 'EXPIRED';
        const cloudSyncAllowed = Boolean(subscription?.cloudSyncAllowed);
        const restrictionReason =
            !business.isActive
                ? 'Business inactive'
                : status !== 'ACTIVE' && status !== 'TRIAL'
                    ? `Subscription ${status.toLowerCase()}`
                    : !cloudSyncAllowed
                        ? 'Cloud sync disabled on subscription'
                        : !hasCloudSyncFlag
                            ? 'CLOUD_SYNC flag disabled'
                            : null;

        return {
            businessId: business.id,
            businessName: business.name,
            businessCode: business.code,
            businessIsActive: business.isActive,
            subscriptionTier: subscription?.tier ?? 'FREE',
            subscriptionStatus: status,
            cloudSyncAllowed,
            hasCloudSyncFlag,
            restrictionReason,
            updatedAt: subscription?.updatedAt ?? business.updatedAt,
        };
    });

    const summary = {
        totalBusinesses: rows.length,
        syncAllowedBusinesses: rows.filter((entry) => !entry.restrictionReason).length,
        syncRestrictedBusinesses: rows.filter((entry) => Boolean(entry.restrictionReason)).length,
        graceBusinesses: rows.filter((entry) => entry.subscriptionStatus === 'GRACE').length,
        expiredBusinesses: rows.filter((entry) => entry.subscriptionStatus === 'EXPIRED').length,
        queuedDeliveries: Number(queuedDeliveries[0]?.count ?? 0),
    };

    return c.json({
        ok: true,
        summary,
        liveSnapshot,
        rows,
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

adminRoute.get('/staff/invites', async (c) => {
    const db = c.get('db');
    const query = staffInviteListQuerySchema.parse({
        businessId: c.req.query('businessId'),
        status: c.req.query('status'),
        limit: c.req.query('limit') ?? 500,
    });

    const whereConditions: SQL<unknown>[] = [];
    if (query.businessId) whereConditions.push(eq(staffInvites.businessId, query.businessId));
    if (query.status) whereConditions.push(eq(staffInvites.status, query.status));

    const inviteRows = whereConditions.length > 0
        ? await db.select().from(staffInvites).where(and(...whereConditions)).orderBy(desc(staffInvites.createdAt)).limit(query.limit)
        : await db.select().from(staffInvites).orderBy(desc(staffInvites.createdAt)).limit(query.limit);

    const businessIds = Array.from(new Set(inviteRows.map((entry) => entry.businessId)));
    const ownerIds = Array.from(new Set(inviteRows.map((entry) => entry.ownerUserId)));

    const [businessRows, ownerRows] = await Promise.all([
        businessIds.length > 0
            ? db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, businessIds))
            : Promise.resolve([]),
        ownerIds.length > 0
            ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, ownerIds))
            : Promise.resolve([]),
    ]);
    const businessById = new Map(businessRows.map((entry) => [entry.id, entry.name]));
    const ownerById = new Map(ownerRows.map((entry) => [entry.id, entry]));

    return c.json({
        ok: true,
        invites: inviteRows.map((entry) => {
            const owner = ownerById.get(entry.ownerUserId);
            return {
                id: entry.id,
                businessId: entry.businessId,
                businessName: businessById.get(entry.businessId) ?? 'Unknown',
                ownerUserId: entry.ownerUserId,
                ownerName: owner?.name ?? null,
                ownerEmail: owner?.email ?? null,
                phoneNumber: entry.phoneNumber,
                role: entry.role,
                status: entry.status,
                code: entry.code,
                expiresAt: entry.expiresAt,
                createdAt: entry.createdAt,
            };
        }),
    });
});

adminRoute.post('/staff/invites', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const payload = staffInviteCreateSchema.parse(await c.req.json());
        const businessRows = await db.select().from(businesses).where(eq(businesses.id, payload.businessId)).limit(1);
        const business = businessRows[0];
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

        const id = `siv_${nanoid(16)}`;
        const code = nanoid(8).toUpperCase();
        const now = new Date();
        const expiresAt = new Date(Date.now() + (payload.expiresInDays * 24 * 60 * 60 * 1000));

        await db.insert(staffInvites).values({
            id,
            businessId: payload.businessId,
            ownerUserId: business.ownerUserId,
            phoneNumber: payload.phoneNumber,
            role: payload.role,
            status: 'pending',
            code,
            expiresAt,
            createdAt: now,
            updatedAt: now,
        });

        await appendAuditLog(c, 'STAFF_INVITE_CREATED', 'staff_invite', id, {
            businessId: payload.businessId,
            role: payload.role,
        });

        return c.json({ ok: true, id, code, expiresAt });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create staff invite.' }, 400);
    }
});

adminRoute.delete('/staff/invites/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select().from(staffInvites).where(eq(staffInvites.id, id)).limit(1);
        const invite = rows[0];
        if (!invite) return c.json({ ok: false, message: 'Invite not found.' }, 404);

        await db.delete(staffInvites).where(eq(staffInvites.id, id));
        await appendAuditLog(c, 'STAFF_INVITE_DELETED', 'staff_invite', id, {
            businessId: invite.businessId,
            phoneNumber: invite.phoneNumber,
        });

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete staff invite.' }, 400);
    }
});

adminRoute.get('/staff/members', async (c) => {
    const db = c.get('db');
    const query = staffMemberListQuerySchema.parse({
        businessId: c.req.query('businessId'),
        role: c.req.query('role'),
        isActive: c.req.query('isActive'),
        limit: c.req.query('limit') ?? 500,
    });

    const whereConditions: SQL<unknown>[] = [];
    if (query.businessId) whereConditions.push(eq(businessMembers.businessId, query.businessId));
    if (query.role) whereConditions.push(eq(businessMembers.role, query.role));
    if (query.isActive !== undefined) whereConditions.push(eq(businessMembers.isActive, query.isActive));

    const members = whereConditions.length > 0
        ? await db.select().from(businessMembers).where(and(...whereConditions)).orderBy(desc(businessMembers.updatedAt)).limit(query.limit)
        : await db.select().from(businessMembers).orderBy(desc(businessMembers.updatedAt)).limit(query.limit);

    const businessIds = Array.from(new Set(members.map((entry) => entry.businessId)));
    const userIds = Array.from(new Set(members.map((entry) => entry.userId)));
    const [businessRows, userRows] = await Promise.all([
        businessIds.length > 0
            ? db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, businessIds))
            : Promise.resolve([]),
        userIds.length > 0
            ? db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone }).from(users).where(inArray(users.id, userIds))
            : Promise.resolve([]),
    ]);

    const businessById = new Map(businessRows.map((entry) => [entry.id, entry.name]));
    const userById = new Map(userRows.map((entry) => [entry.id, entry]));

    return c.json({
        ok: true,
        members: members.map((entry) => {
            const user = userById.get(entry.userId);
            return {
                id: entry.id,
                businessId: entry.businessId,
                businessName: businessById.get(entry.businessId) ?? 'Unknown',
                userId: entry.userId,
                userName: user?.name ?? 'Unknown',
                userEmail: user?.email ?? null,
                userPhone: user?.phone ?? null,
                role: entry.role,
                isActive: entry.isActive,
                joinedAt: entry.joinedAt,
                updatedAt: entry.updatedAt,
            };
        }),
    });
});

adminRoute.patch('/staff/members/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const payload = staffMemberPatchSchema.parse(await c.req.json());

        const rows = await db.select().from(businessMembers).where(eq(businessMembers.id, id)).limit(1);
        const member = rows[0];
        if (!member) return c.json({ ok: false, message: 'Member not found.' }, 404);

        await db.update(businessMembers).set({
            ...(payload.role !== undefined ? { role: payload.role } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
        }).where(eq(businessMembers.id, id));

        await appendAuditLog(c, 'STAFF_MEMBER_UPDATED', 'business_member', id, {
            businessId: member.businessId,
            changedFields: Object.keys(payload),
        });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update staff member.' }, 400);
    }
});

adminRoute.delete('/staff/members/:id', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const rows = await db.select().from(businessMembers).where(eq(businessMembers.id, id)).limit(1);
        const member = rows[0];
        if (!member) return c.json({ ok: false, message: 'Member not found.' }, 404);

        await db.update(businessMembers).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(businessMembers.id, id));

        await appendAuditLog(c, 'STAFF_MEMBER_DEACTIVATED', 'business_member', id, {
            businessId: member.businessId,
            userId: member.userId,
        });
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to remove staff member.' }, 400);
    }
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

adminRoute.delete('/notifications/templates/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        const deleted = await db.delete(notificationTemplates)
            .where(eq(notificationTemplates.id, id))
            .returning({ id: notificationTemplates.id });
        if (!deleted[0]) return c.json({ ok: false, message: 'Notification template not found.' }, 404);
        await appendAuditLog(c, 'NOTIFICATION_TEMPLATE_DELETED', 'notification_template', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete notification template.' }, 400);
    }
});

adminRoute.post('/notifications/templates/bulk', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const payload = notificationTemplateBulkSchema.parse(await c.req.json());
        const ids = [...new Set(payload.ids)];
        if (ids.length === 0) return c.json({ ok: true, affected: 0 });

        let affected = 0;
        if (payload.action === 'DELETE') {
            const deleted = await db.delete(notificationTemplates)
                .where(inArray(notificationTemplates.id, ids))
                .returning({ id: notificationTemplates.id });
            affected = deleted.length;
        } else {
            const updated = await db.update(notificationTemplates).set({
                isActive: payload.action === 'ACTIVATE',
                updatedAt: new Date(),
            }).where(inArray(notificationTemplates.id, ids)).returning({ id: notificationTemplates.id });
            affected = updated.length;
        }

        await appendAuditLog(c, 'NOTIFICATION_TEMPLATE_BULK', 'notification_template', null, {
            action: payload.action,
            requested: ids.length,
            affected,
        });
        return c.json({ ok: true, affected });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed bulk template operation.' }, 400);
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

adminRoute.delete('/notifications/campaigns/:id', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const id = c.req.param('id');
        await db.delete(notificationDeliveries).where(eq(notificationDeliveries.campaignId, id));
        const deleted = await db.delete(notificationCampaigns)
            .where(eq(notificationCampaigns.id, id))
            .returning({ id: notificationCampaigns.id });
        if (!deleted[0]) return c.json({ ok: false, message: 'Campaign not found.' }, 404);
        await appendAuditLog(c, 'NOTIFICATION_CAMPAIGN_DELETED', 'notification_campaign', id);
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete campaign.' }, 400);
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

adminRoute.post('/notifications/campaigns/bulk', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const payload = campaignBulkSchema.parse(await c.req.json());
        const ids = [...new Set(payload.ids)];
        if (ids.length === 0) return c.json({ ok: true, affected: 0, deliveriesQueued: 0 });

        const campaignRows = await db.select().from(notificationCampaigns).where(inArray(notificationCampaigns.id, ids));
        if (campaignRows.length === 0) return c.json({ ok: true, affected: 0, deliveriesQueued: 0 });
        const campaignIdSet = new Set(campaignRows.map((entry) => entry.id));
        let affected = 0;
        let deliveriesQueued = 0;

        if (payload.action === 'DELETE') {
            await db.delete(notificationDeliveries).where(inArray(notificationDeliveries.campaignId, [...campaignIdSet]));
            const deleted = await db.delete(notificationCampaigns).where(inArray(notificationCampaigns.id, [...campaignIdSet]))
                .returning({ id: notificationCampaigns.id });
            affected = deleted.length;
        } else if (payload.action === 'CANCEL') {
            const updated = await db.update(notificationCampaigns).set({
                status: 'CANCELLED',
                updatedAt: new Date(),
            }).where(inArray(notificationCampaigns.id, [...campaignIdSet])).returning({ id: notificationCampaigns.id });
            affected = updated.length;
        } else {
            const now = new Date();
            const activeBusinesses = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.isActive, true));

            for (const campaign of campaignRows) {
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
                            source: 'ADMIN_BULK_TRIGGER',
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
                affected += 1;
            }
        }

        await appendAuditLog(c, 'NOTIFICATION_CAMPAIGN_BULK', 'notification_campaign', null, {
            action: payload.action,
            requested: ids.length,
            matched: campaignRows.length,
            affected,
            deliveriesQueued,
        });
        return c.json({ ok: true, affected, deliveriesQueued });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed bulk campaign operation.' }, 400);
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

adminRoute.get('/master-data', async (c) => {
    const db = c.get('db');
    const [itemRows, templateRows, settingsRows] = await Promise.all([
        db.select({
            category: items.category,
            unit: items.unit,
        }).from(items).limit(5000),
        db.select({
            id: templates.id,
            name: templates.name,
            type: templates.type,
            businessId: templates.businessId,
            isDefault: templates.isDefault,
            isActive: templates.isActive,
            updatedAt: templates.updatedAt,
        }).from(templates).orderBy(desc(templates.updatedAt)).limit(1000),
        db.select().from(adminSettings).where(eq(adminSettings.id, ADMIN_SETTINGS_ROW_ID)).limit(1),
    ]);

    const itemCategorySet = new Set<string>();
    const unitSet = new Set<string>();
    for (const row of itemRows) {
        if (typeof row.category === 'string' && row.category.trim()) itemCategorySet.add(row.category.trim());
        if (typeof row.unit === 'string' && row.unit.trim()) unitSet.add(row.unit.trim());
    }

    const adminConfig = asRecord(settingsRows[0]?.settings);
    const adminMasterData = asRecord(adminConfig.masterData);
    const configCategories = Array.isArray(adminMasterData.categories)
        ? adminMasterData.categories.map((entry) => String(entry).trim()).filter(Boolean)
        : [];
    const configUnits = Array.isArray(adminMasterData.units)
        ? adminMasterData.units.map((entry) => String(entry).trim()).filter(Boolean)
        : [];

    const defaultCategories = [...DEFAULT_ITEM_CATEGORY_PRESETS];
    const defaultUnits = [...DEFAULT_UNIT_PRESETS];

    return c.json({
        ok: true,
        categories: {
            defaults: defaultCategories,
            configured: configCategories,
            discovered: [...itemCategorySet],
            all: [...new Set([...defaultCategories, ...configCategories, ...itemCategorySet])],
        },
        units: {
            defaults: defaultUnits,
            configured: configUnits,
            discovered: [...unitSet],
            all: [...new Set([...defaultUnits, ...configUnits, ...unitSet])],
        },
        templates: templateRows,
    });
});

adminRoute.patch('/master-data', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const payload = masterDataConfigSchema.parse(await c.req.json());
        const now = new Date();

        const settingsRows = await db.select().from(adminSettings).where(eq(adminSettings.id, ADMIN_SETTINGS_ROW_ID)).limit(1);
        const currentSettings = asRecord(settingsRows[0]?.settings);
        const currentMasterData = asRecord(currentSettings.masterData);

        const currentCategories = Array.isArray(currentMasterData.categories)
            ? currentMasterData.categories.map((entry) => String(entry).trim()).filter(Boolean)
            : [];
        const currentUnits = Array.isArray(currentMasterData.units)
            ? currentMasterData.units.map((entry) => String(entry).trim()).filter(Boolean)
            : [];

        const nextCategories = payload.categories
            ? [...new Set(payload.categories.map((entry) => entry.trim()).filter(Boolean))]
            : currentCategories;
        const nextUnits = payload.units
            ? [...new Set(payload.units.map((entry) => entry.trim()).filter(Boolean))]
            : currentUnits;

        await db.insert(adminSettings).values({
            id: ADMIN_SETTINGS_ROW_ID,
            settings: {
                ...currentSettings,
                masterData: {
                    categories: nextCategories,
                    units: nextUnits,
                },
            },
            updatedAt: now,
        }).onConflictDoUpdate({
            target: adminSettings.id,
            set: {
                settings: {
                    ...currentSettings,
                    masterData: {
                        categories: nextCategories,
                        units: nextUnits,
                    },
                },
                updatedAt: now,
            },
        });

        await appendAuditLog(c, 'MASTER_DATA_UPDATED', 'admin_settings', ADMIN_SETTINGS_ROW_ID, {
            categories: nextCategories.length,
            units: nextUnits.length,
        });

        return c.json({
            ok: true,
            categories: nextCategories,
            units: nextUnits,
        });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update master data.' }, 400);
    }
});

adminRoute.post('/master-data/seed-defaults', async (c) => {
    try {
        assertSuperAdmin(c);
        const db = c.get('db');
        const now = new Date();

        const settingsRows = await db.select().from(adminSettings).where(eq(adminSettings.id, ADMIN_SETTINGS_ROW_ID)).limit(1);
        const currentSettings = asRecord(settingsRows[0]?.settings);
        const currentMasterData = asRecord(currentSettings.masterData);

        const nextMasterData = {
            categories: [...new Set([
                ...(Array.isArray(currentMasterData.categories) ? currentMasterData.categories.map((entry) => String(entry).trim()).filter(Boolean) : []),
                ...DEFAULT_ITEM_CATEGORY_PRESETS,
            ])],
            units: [...new Set([
                ...(Array.isArray(currentMasterData.units) ? currentMasterData.units.map((entry) => String(entry).trim()).filter(Boolean) : []),
                ...DEFAULT_UNIT_PRESETS,
            ])],
        };

        await db.insert(adminSettings).values({
            id: ADMIN_SETTINGS_ROW_ID,
            settings: {
                ...currentSettings,
                masterData: nextMasterData,
            },
            updatedAt: now,
        }).onConflictDoUpdate({
            target: adminSettings.id,
            set: {
                settings: {
                    ...currentSettings,
                    masterData: nextMasterData,
                },
                updatedAt: now,
            },
        });

        const templateSeeds = [
            {
                id: `tpl_${nanoid(14)}`,
                businessId: null,
                name: 'Standard GST Invoice',
                type: 'invoice',
                content: {
                    layout: 'standard',
                    showGstin: true,
                    showHsn: true,
                    showQr: true,
                },
                isDefault: true,
                thumbnailUrl: null,
                isActive: true,
            },
            {
                id: `tpl_${nanoid(14)}`,
                businessId: null,
                name: 'Retail Thermal Invoice',
                type: 'invoice',
                content: {
                    layout: 'thermal',
                    paperWidthMm: 80,
                    compact: true,
                    showQr: true,
                },
                isDefault: false,
                thumbnailUrl: null,
                isActive: true,
            },
            {
                id: `tpl_${nanoid(14)}`,
                businessId: null,
                name: 'Executive Business Card',
                type: 'card',
                content: {
                    layout: 'horizontal',
                    showLogo: true,
                    showQr: true,
                },
                isDefault: true,
                thumbnailUrl: null,
                isActive: true,
            },
        ];

        const existingGlobalTemplates = await db.select({
            name: templates.name,
            type: templates.type,
        }).from(templates).where(isNull(templates.businessId));
        const existingKey = new Set(existingGlobalTemplates.map((entry) => `${entry.type}:${entry.name}`));
        const toInsert = templateSeeds.filter((entry) => !existingKey.has(`${entry.type}:${entry.name}`));
        if (toInsert.length > 0) {
            await db.insert(templates).values(toInsert.map((entry) => ({
                ...entry,
                createdAt: now,
                updatedAt: now,
            })));
        }

        await appendAuditLog(c, 'MASTER_DATA_DEFAULTS_SEEDED', 'admin_settings', ADMIN_SETTINGS_ROW_ID, {
            templateCountAdded: toInsert.length,
            categoryCount: nextMasterData.categories.length,
            unitCount: nextMasterData.units.length,
        });

        return c.json({
            ok: true,
            seededTemplates: toInsert.length,
            categories: nextMasterData.categories,
            units: nextMasterData.units,
        });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to seed master defaults.' }, 400);
    }
});

adminRoute.get('/businesses/:id/settings/schema', async (c) => {
    const db = c.get('db');
    const businessId = c.req.param('id');
    const businessRows = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (!businessRows[0]) return c.json({ ok: false, message: 'Business not found.' }, 404);

    return c.json({
        ok: true,
        businessId,
        sections: SETTINGS_SECTIONS,
        schema: SETTINGS_SCHEMA,
    });
});

adminRoute.get('/businesses/:id/settings', async (c) => {
    const db = c.get('db');
    const businessId = c.req.param('id');
    const businessRows = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (!businessRows[0]) return c.json({ ok: false, message: 'Business not found.' }, 404);

    const rows = await db
        .select({
            section: businessSettings.section,
            dataJson: businessSettings.dataJson,
        })
        .from(businessSettings)
        .where(eq(businessSettings.businessId, businessId));

    return c.json({
        ok: true,
        businessId,
        sections: SETTINGS_SECTIONS,
        data: buildNormalizedBusinessSettingsMap(rows),
    });
});

adminRoute.get('/businesses/:id/settings/:section', async (c) => {
    const db = c.get('db');
    const businessId = c.req.param('id');
    const section = c.req.param('section').toUpperCase();
    if (!isValidSettingsSection(section)) return c.json({ ok: false, message: 'Invalid settings section.' }, 400);

    const businessRows = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (!businessRows[0]) return c.json({ ok: false, message: 'Business not found.' }, 404);

    const rows = await db
        .select({
            dataJson: businessSettings.dataJson,
        })
        .from(businessSettings)
        .where(and(eq(businessSettings.businessId, businessId), eq(businessSettings.section, section)))
        .limit(1);

    return c.json({
        ok: true,
        businessId,
        section,
        data: normalizeSettingsData(section, asRecord(rows[0]?.dataJson)),
    });
});

adminRoute.put('/businesses/:id/settings/:section', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const businessId = c.req.param('id');
        const section = c.req.param('section').toUpperCase();
        if (!isValidSettingsSection(section)) return c.json({ ok: false, message: 'Invalid settings section.' }, 400);

        const businessRows = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
        if (!businessRows[0]) return c.json({ ok: false, message: 'Business not found.' }, 404);

        const payload = businessSettingsPatchSchema.parse(await c.req.json());
        const now = new Date();
        const existingRows = await db
            .select()
            .from(businessSettings)
            .where(and(eq(businessSettings.businessId, businessId), eq(businessSettings.section, section)))
            .limit(1);
        const existing = existingRows[0];
        const normalizedData = normalizeSettingsData(section, {
            ...asRecord(existing?.dataJson),
            ...payload.data,
        });

        if (existing) {
            await db.update(businessSettings).set({
                dataJson: normalizedData,
                updatedAt: now,
            }).where(eq(businessSettings.id, existing.id));
        } else {
            await db.insert(businessSettings).values({
                id: `bset_${nanoid(16)}`,
                businessId,
                section,
                dataJson: normalizedData,
                updatedAt: now,
            });
        }

        await appendAuditLog(c, 'BUSINESS_SETTINGS_SECTION_UPDATED', 'business_settings', businessId, {
            section,
            data: normalizedData,
        });

        return c.json({ ok: true, businessId, section, data: normalizedData });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update business settings.' }, 400);
    }
});

adminRoute.delete('/businesses/:id/settings/:section', async (c) => {
    try {
        assertWriteAccess(c);
        const db = c.get('db');
        const businessId = c.req.param('id');
        const section = c.req.param('section').toUpperCase();
        if (!isValidSettingsSection(section)) return c.json({ ok: false, message: 'Invalid settings section.' }, 400);

        const businessRows = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
        if (!businessRows[0]) return c.json({ ok: false, message: 'Business not found.' }, 404);

        const now = new Date();
        const existingRows = await db
            .select()
            .from(businessSettings)
            .where(and(eq(businessSettings.businessId, businessId), eq(businessSettings.section, section)))
            .limit(1);
        const existing = existingRows[0];
        const emptyData = normalizeSettingsData(section, {});

        if (existing) {
            await db.update(businessSettings).set({
                dataJson: emptyData,
                updatedAt: now,
            }).where(eq(businessSettings.id, existing.id));
        } else {
            await db.insert(businessSettings).values({
                id: `bset_${nanoid(16)}`,
                businessId,
                section,
                dataJson: emptyData,
                updatedAt: now,
            });
        }

        await appendAuditLog(c, 'BUSINESS_SETTINGS_SECTION_RESET', 'business_settings', businessId, { section });
        return c.json({ ok: true, businessId, section, data: emptyData });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to reset business settings.' }, 400);
    }
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

    const streamMode = c.req.query('stream') === '1' || c.req.query('format') === 'sse';
    if (!streamMode) {
        return c.json({
            ok: true,
            latest: payload,
            events: [payload],
        });
    }

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
