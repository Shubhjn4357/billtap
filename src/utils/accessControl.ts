import { FeatureFlag, SubscriptionTier, type FeatureFlag as FeatureFlagType } from '../constants/enums';
import { getStatusScopedFeatureFlags, SUBSCRIPTION_TIERS } from '../constants/subscription';
import type { Business, Subscription } from '../types/domain';

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

export type AppAction =
    | 'billing.create'
    | 'billing.update'
    | 'billing.delete'
    | 'inventory.create'
    | 'inventory.update'
    | 'inventory.delete'
    | 'party.create'
    | 'party.update'
    | 'party.delete'
    | 'staff.invite'
    | 'staff.remove'
    | 'settings.update'
    | 'subscription.checkout';

export type RoleActionOverrides = Partial<Record<OrganizationRole, Partial<Record<AppAction, boolean>>>>;
export type RoleModuleOverrides = Partial<Record<OrganizationRole, Partial<Record<AppModule, boolean>>>>;

export const ROLE_ACTION_OVERRIDES_KEY = 'role_action_overrides_json';
export const ROLE_MODULE_OVERRIDES_KEY = 'role_module_overrides_json';

export const APP_MODULES: AppModule[] = [
    'home',
    'billing',
    'inventory',
    'accounts',
    'reports',
    'parties',
    'settings',
    'operations',
    'staff',
];

export const BUSINESS_TOGGLABLE_MODULES: Exclude<AppModule, 'home'>[] = [
    'billing',
    'inventory',
    'accounts',
    'reports',
    'parties',
    'settings',
    'operations',
    'staff',
];

const BUSINESS_MODULE_ALIASES: Partial<Record<Exclude<AppModule, 'home'>, readonly string[]>> = {
    inventory: ['stock'],
    accounts: ['accounting'],
};

export const APP_ACTIONS: AppAction[] = [
    'billing.create',
    'billing.update',
    'billing.delete',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'party.create',
    'party.update',
    'party.delete',
    'staff.invite',
    'staff.remove',
    'settings.update',
    'subscription.checkout',
];

export const ORGANIZATION_ROLES: OrganizationRole[] = ['owner', 'manager', 'salesman', 'staff'];

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

let runtimeActionOverrides: RoleActionOverrides = {};
let runtimeModuleOverrides: RoleModuleOverrides = {};

const ACTION_MODULE_REQUIREMENT: Record<AppAction, AppModule | null> = {
    'billing.create': 'billing',
    'billing.update': 'billing',
    'billing.delete': 'billing',
    'inventory.create': 'inventory',
    'inventory.update': 'inventory',
    'inventory.delete': 'inventory',
    'party.create': 'parties',
    'party.update': 'parties',
    'party.delete': 'parties',
    'staff.invite': 'staff',
    'staff.remove': 'staff',
    'settings.update': 'settings',
    'subscription.checkout': null,
};

const ROLE_ACTION_ACCESS: Record<OrganizationRole, Record<AppAction, boolean>> = {
    owner: {
        'billing.create': true,
        'billing.update': true,
        'billing.delete': true,
        'inventory.create': true,
        'inventory.update': true,
        'inventory.delete': true,
        'party.create': true,
        'party.update': true,
        'party.delete': true,
        'staff.invite': true,
        'staff.remove': true,
        'settings.update': true,
        'subscription.checkout': true,
    },
    manager: {
        'billing.create': true,
        'billing.update': true,
        'billing.delete': true,
        'inventory.create': true,
        'inventory.update': true,
        'inventory.delete': true,
        'party.create': true,
        'party.update': true,
        'party.delete': true,
        'staff.invite': false,
        'staff.remove': false,
        'settings.update': true,
        'subscription.checkout': false,
    },
    salesman: {
        'billing.create': true,
        'billing.update': true,
        'billing.delete': false,
        'inventory.create': true,
        'inventory.update': true,
        'inventory.delete': false,
        'party.create': true,
        'party.update': true,
        'party.delete': false,
        'staff.invite': false,
        'staff.remove': false,
        'settings.update': false,
        'subscription.checkout': false,
    },
    staff: {
        'billing.create': true,
        'billing.update': true,
        'billing.delete': false,
        'inventory.create': true,
        'inventory.update': true,
        'inventory.delete': false,
        'party.create': true,
        'party.update': true,
        'party.delete': false,
        'staff.invite': false,
        'staff.remove': false,
        'settings.update': false,
        'subscription.checkout': false,
    },
};

const parseJsonLike = (value: unknown): unknown => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return {};
        try {
            return JSON.parse(trimmed) as unknown;
        } catch {
            return {};
        }
    }
    if (value && typeof value === 'object') return value;
    return {};
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const resolveRole = (role: OrganizationRole | string | null | undefined): OrganizationRole =>
    ORGANIZATION_ROLES.includes(role as OrganizationRole) ? role as OrganizationRole : 'owner';

const normalizeBusinessModuleKey = (module: Exclude<AppModule, 'home'> | string) => {
    const normalized = String(module).trim().toLowerCase();
    if (normalized === 'stock') return 'inventory';
    if (normalized === 'accounting') return 'accounts';
    return normalized;
};

const getBusinessModuleLookupKeys = (module: Exclude<AppModule, 'home'>) => {
    const normalized = normalizeBusinessModuleKey(module) as Exclude<AppModule, 'home'>;
    const aliases = BUSINESS_MODULE_ALIASES[normalized] ?? [];
    return [normalized, ...aliases];
};

const isBusinessModuleEnabled = (business: Business | null, module: AppModule): boolean => {
    if (!business || module === 'home') return true;
    const settings = isRecord(business.settings) ? business.settings : {};
    const direct = isRecord(settings.appModuleAccess) ? settings.appModuleAccess : {};
    const legacy = isRecord(settings.moduleVisibility) ? settings.moduleVisibility : {};

    for (const key of getBusinessModuleLookupKeys(module)) {
        if (typeof direct[key] === 'boolean') return Boolean(direct[key]);
    }
    for (const key of getBusinessModuleLookupKeys(module)) {
        if (typeof legacy[key] === 'boolean') return Boolean(legacy[key]);
    }
    return true;
};

const parseOverrides = <T extends string>(
    raw: unknown,
    allowedKeys: readonly T[]
): Partial<Record<OrganizationRole, Partial<Record<T, boolean>>>> => {
    const result: Partial<Record<OrganizationRole, Partial<Record<T, boolean>>>> = {};
    const parsed = parseJsonLike(raw);
    if (!isRecord(parsed)) return result;

    for (const role of ORGANIZATION_ROLES) {
        const rolePayload = parsed[role];
        if (!isRecord(rolePayload)) continue;
        const roleResult: Partial<Record<T, boolean>> = {};
        for (const key of allowedKeys) {
            const value = rolePayload[key];
            if (typeof value === 'boolean') {
                roleResult[key] = value;
            }
        }
        if (Object.keys(roleResult).length > 0) {
            result[role] = roleResult;
        }
    }

    return result;
};

export const parseRoleActionOverrides = (raw: unknown): RoleActionOverrides =>
    parseOverrides(raw, APP_ACTIONS);

export const parseRoleModuleOverrides = (raw: unknown): RoleModuleOverrides =>
    parseOverrides(raw, APP_MODULES);

export const stringifyRoleActionOverrides = (overrides: RoleActionOverrides): string =>
    JSON.stringify(overrides);

export const stringifyRoleModuleOverrides = (overrides: RoleModuleOverrides): string =>
    JSON.stringify(overrides);

export const setRoleAccessOverrides = (payload: {
    actionOverrides?: unknown;
    moduleOverrides?: unknown;
}) => {
    runtimeActionOverrides = parseRoleActionOverrides(payload.actionOverrides);
    runtimeModuleOverrides = parseRoleModuleOverrides(payload.moduleOverrides);
};

export const getDefaultModulePermission = (role: OrganizationRole, module: AppModule): boolean =>
    ROLE_ACCESS[resolveRole(role)][module];

export const getDefaultActionPermission = (role: OrganizationRole, action: AppAction): boolean =>
    ROLE_ACTION_ACCESS[resolveRole(role)][action];

const toTier = (subscription: Subscription | null): SubscriptionTier =>
    subscription?.tier ?? SubscriptionTier.FREE;

export const getEffectiveFeatureFlags = (subscription: Subscription | null): FeatureFlagType[] => {
    const explicitFlags = subscription?.featureFlagsEnabled ?? [];
    const baseFlags = explicitFlags.length > 0
        ? explicitFlags as FeatureFlagType[]
        : SUBSCRIPTION_TIERS[toTier(subscription)].enabledFeatures;
    return getStatusScopedFeatureFlags(subscription?.status, baseFlags) as FeatureFlagType[];
};

export const hasFeatureAccess = (subscription: Subscription | null, flag: FeatureFlagType): boolean =>
    getEffectiveFeatureFlags(subscription).includes(flag);

export const canAccessModule = (
    role: OrganizationRole,
    module: AppModule,
    subscription: Subscription | null,
    business?: Business | null
): boolean => {
    const resolvedRole = resolveRole(role);
    const moduleOverride = runtimeModuleOverrides[resolvedRole]?.[module];
    const roleModuleAllowed = typeof moduleOverride === 'boolean'
        ? moduleOverride
        : ROLE_ACCESS[resolvedRole][module];
    if (!roleModuleAllowed) return false;
    if (!isBusinessModuleEnabled(business ?? null, module)) return false;

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

export const canPerformAction = (
    role: OrganizationRole,
    action: AppAction,
    subscription: Subscription | null,
    business?: Business | null
): boolean => {
    const resolvedRole = resolveRole(role);
    const requiredModule = ACTION_MODULE_REQUIREMENT[action];
    if (requiredModule && !canAccessModule(resolvedRole, requiredModule, subscription, business)) return false;
    const actionOverride = runtimeActionOverrides[resolvedRole]?.[action];
    if (typeof actionOverride === 'boolean') return actionOverride;
    return ROLE_ACTION_ACCESS[resolvedRole][action];
};
