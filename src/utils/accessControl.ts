import { FeatureFlag, SubscriptionTier, type FeatureFlag as FeatureFlagType } from '../constants/enums';
import { SUBSCRIPTION_TIERS } from '../constants/subscription';
import type { Subscription } from '../types/domain';

export type OrganizationRole = 'owner' | 'manager' | 'salesman' | 'staff';

export type AppModule =
    | 'home'
    | 'billing'
    | 'inventory'
    | 'accounts'
    | 'reports'
    | 'parties'
    | 'settings'
    | 'operations'
    | 'staff';

const ROLE_ACCESS: Record<OrganizationRole, Record<AppModule, boolean>> = {
    owner: {
        home: true,
        billing: true,
        inventory: true,
        accounts: true,
        reports: true,
        parties: true,
        settings: true,
        operations: true,
        staff: true,
    },
    manager: {
        home: true,
        billing: true,
        inventory: true,
        accounts: true,
        reports: true,
        parties: true,
        settings: true,
        operations: true,
        staff: false,
    },
    salesman: {
        home: true,
        billing: true,
        inventory: true,
        accounts: false,
        reports: true,
        parties: true,
        settings: false,
        operations: false,
        staff: false,
    },
    staff: {
        home: true,
        billing: true,
        inventory: true,
        accounts: true,
        reports: true,
        parties: true,
        settings: false,
        operations: false,
        staff: false,
    },
};

const toTier = (subscription: Subscription | null): SubscriptionTier =>
    subscription?.tier ?? SubscriptionTier.FREE;

export const getEffectiveFeatureFlags = (subscription: Subscription | null): FeatureFlagType[] => {
    const explicitFlags = subscription?.featureFlagsEnabled ?? [];
    if (explicitFlags.length > 0) return explicitFlags as FeatureFlagType[];
    return SUBSCRIPTION_TIERS[toTier(subscription)].enabledFeatures;
};

export const hasFeatureAccess = (subscription: Subscription | null, flag: FeatureFlagType): boolean =>
    getEffectiveFeatureFlags(subscription).includes(flag);

export const canAccessModule = (
    role: OrganizationRole,
    module: AppModule,
    subscription: Subscription | null
): boolean => {
    if (!ROLE_ACCESS[role][module]) return false;

    if (module === 'inventory' && !hasFeatureAccess(subscription, FeatureFlag.STOCK_MODULE)) return false;
    if (module === 'parties' && !hasFeatureAccess(subscription, FeatureFlag.PARTY_MANAGEMENT)) return false;
    if (module === 'reports') {
        return hasFeatureAccess(subscription, FeatureFlag.GST_REPORTS)
            || hasFeatureAccess(subscription, FeatureFlag.ADVANCED_REPORTS);
    }
    if (module === 'staff' && !hasFeatureAccess(subscription, FeatureFlag.STAFF_USERS)) return false;

    return true;
};

export const canUsePos = (subscription: Subscription | null): boolean =>
    hasFeatureAccess(subscription, FeatureFlag.POS_MODE);

