import { and, asc, desc, eq } from 'drizzle-orm';
import type { AppContext, AppVariables } from '../middleware/auth';
import { businesses, businessMembers, subscriptions, users } from '../db/schema';
import type { BusinessRow, SubscriptionRow, UserRow } from '../db/schema';
import type { DrizzleClient } from '../db/client';
import { nanoid } from 'nanoid';

export const getRequestedBusinessId = (c: AppContext): string | null => {
    const fromHeader = c.req.header('X-Organization-Id') ?? c.req.header('x-organization-id');
    const fromQuery = c.req.query('organizationId') ?? c.req.query('businessId');
    const value = (fromHeader ?? fromQuery ?? '').trim();
    return value || null;
};

export const getAccessibleBusiness = async (
    db: DrizzleClient,
    userId: string,
    requestedBusinessId?: string | null
): Promise<BusinessRow | null> => {
    if (requestedBusinessId) {
        const owned = await db
            .select()
            .from(businesses)
            .where(and(
                eq(businesses.id, requestedBusinessId),
                eq(businesses.ownerUserId, userId),
                eq(businesses.isActive, true),
            ))
            .limit(1);

        if (owned[0]) return owned[0];

        const member = await db
            .select({ businessId: businessMembers.businessId })
            .from(businessMembers)
            .where(and(
                eq(businessMembers.businessId, requestedBusinessId),
                eq(businessMembers.userId, userId),
                eq(businessMembers.isActive, true),
            ))
            .limit(1);

        if (!member[0]) return null;

        const memberBusiness = await db
            .select()
            .from(businesses)
            .where(and(
                eq(businesses.id, member[0].businessId),
                eq(businesses.isActive, true),
            ))
            .limit(1);

        return memberBusiness[0] ?? null;
    }

    const firstOwned = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.ownerUserId, userId), eq(businesses.isActive, true)))
        .orderBy(asc(businesses.createdAt))
        .limit(1);

    if (firstOwned[0]) return firstOwned[0];

    const firstMembership = await db
        .select({ businessId: businessMembers.businessId })
        .from(businessMembers)
        .where(and(eq(businessMembers.userId, userId), eq(businessMembers.isActive, true)))
        .orderBy(asc(businessMembers.createdAt))
        .limit(1);

    if (!firstMembership[0]) return null;

    const memberBusiness = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.id, firstMembership[0].businessId), eq(businesses.isActive, true)))
        .limit(1);

    return memberBusiness[0] ?? null;
};

export const ensurePrimaryBusiness = async (
    db: DrizzleClient,
    user: UserRow,
    defaults?: Partial<BusinessRow>
): Promise<BusinessRow> => {
    const existing = await getAccessibleBusiness(db, user.id, null);
    if (existing) return existing;

    const now = new Date();
    const id = `biz_${nanoid(18)}`;
    const name = defaults?.name ?? user.name ?? 'My Business';

    await db.insert(businesses).values({
        id,
        ownerUserId: user.id,
        name,
        legalName: defaults?.legalName ?? null,
        address: defaults?.address ?? null,
        state: defaults?.state ?? null,
        gstin: defaults?.gstin ?? null,
        pan: defaults?.pan ?? null,
        booksStartDate: defaults?.booksStartDate ?? null,
        logoUrl: defaults?.logoUrl ?? null,
        phone: defaults?.phone ?? user.phone,
        email: defaults?.email ?? user.email,
        currency: defaults?.currency ?? 'INR',
        category: defaults?.category ?? null,
        code: defaults?.code ?? null,
        isActive: true,
        settings: defaults?.settings ?? {},
        createdAt: now,
        updatedAt: now,
    });

    const created = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    return created[0] as BusinessRow;
};

export const getActiveSubscription = async (
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

export const updateUserBasics = async (
    db: DrizzleClient,
    userId: string,
    payload: Partial<Pick<UserRow, 'name' | 'email' | 'phone' | 'photoUrl'>>
): Promise<UserRow | null> => {
    const next = {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.email !== undefined ? { email: payload.email } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
        ...(payload.photoUrl !== undefined ? { photoUrl: payload.photoUrl } : {}),
        updatedAt: new Date(),
    };

    await db.update(users).set(next).where(eq(users.id, userId));
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return rows[0] ?? null;
};

type OrganizationRole = NonNullable<AppVariables['organizationRole']>;
type AppModule =
    | 'home'
    | 'billing'
    | 'inventory'
    | 'accounts'
    | 'reports'
    | 'parties'
    | 'settings'
    | 'operations'
    | 'staff';
type AppAction =
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

const DEFAULT_ROLE_MODULE_ACCESS: Record<OrganizationRole, Record<AppModule, boolean>> = {
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
};

const DEFAULT_ROLE_ACTION_ACCESS: Record<OrganizationRole, Record<AppAction, boolean>> = {
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
};

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

const CAPABILITY_MODULE_MAP: Record<string, AppModule> = {
    billing: 'billing',
    pos: 'billing',
    inventory: 'inventory',
    parties: 'parties',
    accounts: 'accounts',
    cashbank: 'accounts',
    expenses: 'accounts',
    loans: 'accounts',
    reports: 'reports',
    settings: 'settings',
    operations: 'operations',
    staff: 'staff',
};

const DEFAULT_ROLE_CAPABILITIES: Record<OrganizationRole, readonly string[]> = {
    owner: ['*'],
    manager: [
        'billing.*',
        'inventory.*',
        'parties.*',
        'reports.read',
        'accounts.*',
        'expenses.*',
        'cashbank.*',
        'loans.*',
        'pos.*',
        'staff.read',
        'settings.read',
        'operations.read',
    ],
    salesman: [
        'billing.*',
        'pos.*',
        'parties.read',
        'parties.write',
        'inventory.read',
        'reports.read',
        'expenses.read',
        'cashbank.read',
        'loans.read',
    ],
};

const capabilityMatches = (granted: string, requested: string) => {
    if (granted === '*') return true;
    if (granted === requested) return true;
    if (!granted.endsWith('.*')) return false;
    const prefix = granted.slice(0, -2);
    return requested === prefix || requested.startsWith(`${prefix}.`);
};

const resolvePermissionOverride = (permissions: Record<string, boolean>, capability: string): boolean | null => {
    const tokens = capability.split('.');
    const candidates: string[] = [capability];

    for (let idx = tokens.length; idx >= 1; idx -= 1) {
        const segment = tokens.slice(0, idx).join('.');
        candidates.push(segment);
        candidates.push(`${segment}.*`);
    }
    candidates.push('*');

    for (const key of candidates) {
        const value = permissions[key];
        if (typeof value === 'boolean') return value;
    }
    return null;
};

const getRoleOverrideValue = (
    overrides: Record<string, Record<string, boolean>> | null | undefined,
    role: OrganizationRole,
    key: string
): boolean | null => {
    const roleMap = overrides?.[role];
    if (!roleMap) return null;
    const value = roleMap[key];
    return typeof value === 'boolean' ? value : null;
};

const resolveCapabilityModule = (capability: string): AppModule | null => {
    const root = capability.split('.')[0] ?? '';
    return CAPABILITY_MODULE_MAP[root] ?? null;
};

const resolveCapabilityAction = (capability: string, method: string): AppAction | null => {
    const normalized = method.toUpperCase();
    if (capability === 'billing.write') {
        if (normalized === 'POST') return 'billing.create';
        if (normalized === 'PUT' || normalized === 'PATCH') return 'billing.update';
        if (normalized === 'DELETE') return 'billing.delete';
    }
    if (capability === 'inventory.write') {
        if (normalized === 'POST') return 'inventory.create';
        if (normalized === 'PUT' || normalized === 'PATCH') return 'inventory.update';
        if (normalized === 'DELETE') return 'inventory.delete';
    }
    if (capability === 'parties.write') {
        if (normalized === 'POST') return 'party.create';
        if (normalized === 'PUT' || normalized === 'PATCH') return 'party.update';
        if (normalized === 'DELETE') return 'party.delete';
    }
    if (capability === 'staff.write') {
        if (normalized === 'POST') return 'staff.invite';
        if (normalized === 'DELETE' || normalized === 'PUT' || normalized === 'PATCH') return 'staff.remove';
    }
    if (capability === 'settings.write') {
        if (normalized === 'PUT' || normalized === 'PATCH' || normalized === 'POST' || normalized === 'DELETE') {
            return 'settings.update';
        }
    }
    return null;
};

export const isOrganizationModuleAllowed = (c: AppContext, module: AppModule) => {
    const authRole = c.get('authRole');
    if (authRole === 'SUPER_ADMIN') return true;

    const activeBusinessId = c.get('activeBusinessId');
    if (!activeBusinessId) return true;

    const role = c.get('organizationRole');
    if (!role) return false;

    const moduleOverride = getRoleOverrideValue(c.get('organizationModuleOverrides'), role, module);
    if (moduleOverride !== null) return moduleOverride;

    return DEFAULT_ROLE_MODULE_ACCESS[role][module];
};

export const requireOrganizationModule = (c: AppContext, module: AppModule) => {
    if (isOrganizationModuleAllowed(c, module)) return null;
    return c.json({
        ok: false,
        message: `Permission denied for module "${module}".`,
        error: {
            code: 'MODULE_ACCESS_DENIED',
            message: `Permission denied for module "${module}".`,
            details: { module },
        },
    }, 403);
};

export const isOrganizationActionAllowed = (c: AppContext, action: AppAction) => {
    const authRole = c.get('authRole');
    if (authRole === 'SUPER_ADMIN') return true;

    const activeBusinessId = c.get('activeBusinessId');
    if (!activeBusinessId) return true;

    const role = c.get('organizationRole');
    if (!role) return false;

    const permissions = c.get('organizationPermissions') ?? {};
    const permissionOverride = resolvePermissionOverride(permissions, action);
    if (permissionOverride !== null) return permissionOverride;

    const requiredModule = ACTION_MODULE_REQUIREMENT[action];
    if (requiredModule && !isOrganizationModuleAllowed(c, requiredModule)) return false;

    const actionOverride = getRoleOverrideValue(c.get('organizationActionOverrides'), role, action);
    if (actionOverride !== null) return actionOverride;

    return DEFAULT_ROLE_ACTION_ACCESS[role][action];
};

export const requireOrganizationAction = (c: AppContext, action: AppAction) => {
    if (isOrganizationActionAllowed(c, action)) return null;
    return c.json({
        ok: false,
        message: `Permission denied for action "${action}".`,
        error: {
            code: 'ACTION_ACCESS_DENIED',
            message: `Permission denied for action "${action}".`,
            details: { action },
        },
    }, 403);
};

export const isOrganizationCapabilityAllowed = (c: AppContext, capability: string) => {
    const authRole = c.get('authRole');
    if (authRole === 'SUPER_ADMIN') return true;

    const activeBusinessId = c.get('activeBusinessId');
    if (!activeBusinessId) return true;

    const role = c.get('organizationRole');
    if (!role) return false;

    const permissions = c.get('organizationPermissions') ?? {};
    const override = resolvePermissionOverride(permissions, capability);
    if (override !== null) return override;

    const defaults = DEFAULT_ROLE_CAPABILITIES[role];
    const roleAllowsCapability = defaults.some((granted) => capabilityMatches(granted, capability));
    if (!roleAllowsCapability) return false;

    const module = resolveCapabilityModule(capability);
    if (module && !isOrganizationModuleAllowed(c, module)) return false;

    const action = resolveCapabilityAction(capability, c.req.method);
    if (action && !isOrganizationActionAllowed(c, action)) return false;

    return true;
};

export const requireOrganizationCapability = (c: AppContext, capability: string) => {
    if (isOrganizationCapabilityAllowed(c, capability)) return null;
    return c.json({
        ok: false,
        message: `Permission denied for capability "${capability}".`,
        error: {
            code: 'CAPABILITY_ACCESS_DENIED',
            message: `Permission denied for capability "${capability}".`,
            details: { capability },
        },
    }, 403);
};
