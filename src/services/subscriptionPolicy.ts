import { and, count, desc, eq, gte, lt, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
    businesses,
    businessMembers,
    devices,
    invoices,
    planUsage,
    subscriptions,
} from '../db/schema';
import type { BusinessRow, SubscriptionRow } from '../db/schema';
import type { DrizzleClient } from '../db/client';
import { AppError } from './apiError';

export const GST_RATE_SLABS = [0, 0.25, 3, 5, 18, 40] as const;

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const toNumber = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toDateOnly = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const getMonthRange = (value: Date) => {
    const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
    const end = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
    return { start, end };
};

const nowDateOnly = () => toDateOnly(new Date());

export const isAllowedGstRate = (value: number) => {
    return GST_RATE_SLABS.some((entry) => Math.abs(entry - value) < 0.000001);
};

export const assertAllowedGstRate = (value: number) => {
    if (!isAllowedGstRate(value)) {
        throw new AppError(
            'GST_RATE_NOT_ALLOWED',
            `Unsupported GST rate: ${value}. Allowed slabs: ${GST_RATE_SLABS.join(', ')}.`,
            400
        );
    }
};

export const getLatestSubscriptionForBusiness = async (
    db: DrizzleClient,
    businessId: string
): Promise<SubscriptionRow | null> => {
    const rows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.businessId, businessId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
    return rows[0] ?? null;
};

const assertSubscriptionWritableByStatus = (subscription: SubscriptionRow | null, now = nowDateOnly()) => {
    if (!subscription) {
        throw new AppError('SUBSCRIPTION_REQUIRED', 'Subscription is required for this action.', 403);
    }

    if (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL') {
        return;
    }

    if (subscription.status === 'GRACE') {
        throw new AppError(
            'SUBSCRIPTION_READ_ONLY',
            'Subscription is in grace mode. Account is read-only until renewal.',
            403
        );
    }

    if (subscription.status === 'EXPIRED' || subscription.status === 'CANCELLED') {
        const graceEndDate = subscription.graceEndDate ? toDateOnly(subscription.graceEndDate) : null;
        if (graceEndDate && graceEndDate >= now) {
            throw new AppError(
                'SUBSCRIPTION_READ_ONLY',
                'Subscription is expired and within grace period. Account is read-only.',
                403
            );
        }
        throw new AppError(
            'SUBSCRIPTION_READ_ONLY',
            'Subscription is expired/cancelled. Account is read-only.',
            403
        );
    }

    throw new AppError(
        'SUBSCRIPTION_READ_ONLY',
        `Subscription status "${subscription.status}" does not permit writes.`,
        403
    );
};

export const assertSubscriptionWriteAllowed = (subscription: SubscriptionRow | null) => {
    assertSubscriptionWritableByStatus(subscription);
    if (!subscription) return;
    if (subscription.offlineOnly || !subscription.cloudSyncAllowed) {
        throw new AppError(
            'SUBSCRIPTION_WRITE_BLOCKED',
            'Current subscription allows offline mode only. Cloud write actions are blocked.',
            403
        );
    }
};

export const hasFeatureFlag = (subscription: SubscriptionRow | null, featureFlag: string) => {
    if (!subscription) return false;
    return (subscription.featureFlagsEnabled ?? []).includes(featureFlag);
};

export const assertFeatureFlag = (subscription: SubscriptionRow | null, featureFlag: string) => {
    if (!hasFeatureFlag(subscription, featureFlag)) {
        throw new AppError(
            'FEATURE_NOT_ENABLED',
            `Feature "${featureFlag}" is not enabled for current subscription.`,
            403
        );
    }
};

export const assertBillCreationAllowed = async (
    db: DrizzleClient,
    businessId: string,
    subscription: SubscriptionRow | null,
    billDateInput?: Date
) => {
    assertSubscriptionWriteAllowed(subscription);
    assertFeatureFlag(subscription, 'GST_INVOICES');

    if (!subscription) return;

    const billDate = billDateInput ? new Date(billDateInput) : new Date();
    const { start, end } = getMonthRange(billDate);

    const [totalResult] = await db
        .select({ total: count() })
        .from(invoices)
        .where(eq(invoices.businessId, businessId));
    const totalBills = toNumber(totalResult?.total);

    if (subscription.maxBillsTotal !== null && totalBills >= subscription.maxBillsTotal) {
        throw new AppError(
            'PLAN_LIMIT_EXCEEDED',
            `Plan limit exceeded: max total bills is ${subscription.maxBillsTotal}.`,
            409
        );
    }

    const [monthlyResult] = await db
        .select({ total: count() })
        .from(invoices)
        .where(and(
            eq(invoices.businessId, businessId),
            gte(invoices.invoiceDate, start),
            lt(invoices.invoiceDate, end),
        ));
    const monthlyBills = toNumber(monthlyResult?.total);
    if (subscription.maxBillsPerMonth !== null && monthlyBills >= subscription.maxBillsPerMonth) {
        throw new AppError(
            'PLAN_LIMIT_EXCEEDED',
            `Plan limit exceeded: max bills per month is ${subscription.maxBillsPerMonth}.`,
            409
        );
    }
};

export const bumpMonthlyBillUsage = async (
    db: DrizzleClient,
    businessId: string,
    subscription: SubscriptionRow | null,
    billDateInput?: Date
) => {
    if (!subscription) return;

    const billDate = billDateInput ? new Date(billDateInput) : new Date();
    const month = billDate.getUTCMonth() + 1;
    const year = billDate.getUTCFullYear();
    const now = new Date();

    const existing = await db
        .select()
        .from(planUsage)
        .where(and(
            eq(planUsage.businessId, businessId),
            eq(planUsage.subscriptionId, subscription.id),
            eq(planUsage.month, month),
            eq(planUsage.year, year),
        ))
        .limit(1);

    if (existing[0]) {
        await db.update(planUsage).set({
            billsCreatedInMonth: Number(existing[0].billsCreatedInMonth ?? 0) + 1,
            updatedAt: now,
        }).where(eq(planUsage.id, existing[0].id));
        return;
    }

    await db.insert(planUsage).values({
        id: `usage_${nanoid(16)}`,
        businessId,
        subscriptionId: subscription.id,
        month,
        year,
        billsCreatedInMonth: 1,
        storageUsedMb: 0,
        staffUsersCount: 0,
        devicesCount: 0,
        createdAt: now,
        updatedAt: now,
    });
};

export const assertStaffCreationAllowed = async (
    db: DrizzleClient,
    businessId: string,
    subscription: SubscriptionRow | null
) => {
    assertSubscriptionWriteAllowed(subscription);
    assertFeatureFlag(subscription, 'STAFF_USERS');

    if (!subscription || subscription.maxStaffUsers === null) return;

    const [result] = await db
        .select({ total: count() })
        .from(businessMembers)
        .where(and(
            eq(businessMembers.businessId, businessId),
            eq(businessMembers.isActive, true),
            ne(businessMembers.role, 'OWNER'),
        ));
    const currentStaffUsers = toNumber(result?.total);
    if (currentStaffUsers >= subscription.maxStaffUsers) {
        throw new AppError(
            'STAFF_INVITE_NOT_ALLOWED',
            `Plan limit exceeded: max staff users is ${subscription.maxStaffUsers}.`,
            409
        );
    }
};

export const assertDeviceRegistrationAllowed = async (
    db: DrizzleClient,
    businessId: string,
    subscription: SubscriptionRow | null
) => {
    assertSubscriptionWriteAllowed(subscription);
    assertFeatureFlag(subscription, 'MULTI_DEVICE');

    if (!subscription || subscription.maxDevices === null) return;

    const [result] = await db
        .select({ total: count() })
        .from(devices)
        .where(eq(devices.businessId, businessId));
    const currentDevices = toNumber(result?.total);
    if (currentDevices >= subscription.maxDevices) {
        throw new AppError(
            'PLAN_LIMIT_EXCEEDED',
            `Plan limit exceeded: max devices is ${subscription.maxDevices}.`,
            409
        );
    }
};

export const assertBusinessCreationAllowed = async (
    db: DrizzleClient,
    userId: string,
    referenceBusinessId?: string | null
) => {
    const ownedBusinesses = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(and(eq(businesses.ownerUserId, userId), eq(businesses.isActive, true)));

    const activeBusinessCount = ownedBusinesses.length;
    if (activeBusinessCount === 0) return;

    const subscriptionBusinessId = referenceBusinessId ?? ownedBusinesses[0]?.id ?? null;
    if (!subscriptionBusinessId) return;

    const subscription = await getLatestSubscriptionForBusiness(db, subscriptionBusinessId);
    assertSubscriptionWritableByStatus(subscription);

    if (subscription?.maxBusinesses !== null && subscription?.maxBusinesses !== undefined && activeBusinessCount >= subscription.maxBusinesses) {
        throw new AppError(
            'PLAN_LIMIT_EXCEEDED',
            `Plan limit exceeded: max businesses is ${subscription.maxBusinesses}.`,
            409
        );
    }

    if (!hasFeatureFlag(subscription, 'MULTI_BUSINESS') && activeBusinessCount >= 1) {
        throw new AppError(
            'MULTI_BUSINESS_NOT_ALLOWED',
            'Current subscription does not allow multiple businesses.',
            409
        );
    }
};

export const isModuleEnabled = (business: BusinessRow | null, moduleKey: string) => {
    if (!business) return false;
    const settings = asRecord(business.settings);
    const direct = asRecord(settings.appModuleAccess);
    const legacy = asRecord(settings.moduleVisibility);

    if (typeof direct[moduleKey] === 'boolean') return Boolean(direct[moduleKey]);
    if (typeof legacy[moduleKey] === 'boolean') return Boolean(legacy[moduleKey]);
    return true;
};

export const assertModuleEnabled = (business: BusinessRow | null, moduleKey: string) => {
    if (!isModuleEnabled(business, moduleKey)) {
        throw new AppError(
            'MODULE_DISABLED',
            `Module "${moduleKey}" is disabled in organization settings.`,
            403
        );
    }
};
