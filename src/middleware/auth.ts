import type { Context, Next } from 'hono';
import { and, eq } from 'drizzle-orm';
import { verifySessionToken } from '../auth/tokens';
import { businessMembers, businesses, businessSettings, users } from '../db/schema';
import type { DrizzleClient } from '../db/client';
import type { UserRow } from '../db/schema';

export type Bindings = {
    DATABASE_URL: string;
    CORS_ORIGINS?: string;
    JWT_SECRET?: string;
    API_JWT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_OAUTH_CLIENT_ID?: string;
    GOOGLE_OAUTH_CLIENT_IDS?: string;
    GOOGLE_OAUTH_ANDROID_CLIENT_ID?: string;
    GOOGLE_OAUTH_IOS_CLIENT_ID?: string;
    ADMINS?: string;
    SUPPORT_ADMINS?: string;
    READ_ONLY_ADMINS?: string;
    DEVELOPER_ADMIN_EMAILS?: string;
};

export type AdminAccessRole = 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'READ_ONLY_ADMIN' | null;

export type AppVariables = {
    authUser: UserRow | null;
    authRole: AdminAccessRole;
    activeBusinessId: string | null;
    effectiveUserId: string | null;
    effectiveOwnerUserId: string | null;
    effectiveOrganizationId: string | null;
    organizationRole: 'owner' | 'manager' | 'salesman' | null;
    organizationPermissions: Record<string, boolean>;
    organizationActionOverrides: Record<string, Record<string, boolean>>;
    organizationModuleOverrides: Record<string, Record<string, boolean>>;
    db: DrizzleClient;
};

export type AppEnv = {
    Bindings: Bindings;
    Variables: AppVariables;
};

export type AppContext = Context<AppEnv>;

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
        // Fallback to CSV.
    }

    return value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
};

const getBearerToken = (authHeader: string | undefined) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice('Bearer '.length).trim() || null;
};

const getRequestedBusinessId = (c: AppContext): string | null => {
    const fromHeader = c.req.header('X-Organization-Id') ?? c.req.header('x-organization-id');
    const fromQuery = c.req.query('organizationId') ?? c.req.query('businessId');
    const value = (fromHeader ?? fromQuery ?? '').trim();
    return value || null;
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

const parseRoleOverrides = (raw: unknown): Record<string, Record<string, boolean>> => {
    const parsed = parseJsonLike(raw);
    if (!isRecord(parsed)) return {};

    const result: Record<string, Record<string, boolean>> = {};
    for (const [role, roleValue] of Object.entries(parsed)) {
        if (!isRecord(roleValue)) continue;
        const mapped: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(roleValue)) {
            if (typeof value === 'boolean') {
                mapped[key] = value;
            }
        }
        if (Object.keys(mapped).length > 0) {
            result[role] = mapped;
        }
    }
    return result;
};

const getRoleOverridesFromSecurity = async (
    db: DrizzleClient,
    businessId: string
) => {
    const rows = await db
        .select({ dataJson: businessSettings.dataJson })
        .from(businessSettings)
        .where(and(
            eq(businessSettings.businessId, businessId),
            eq(businessSettings.section, 'SECURITY')
        ))
        .limit(1);

    const security = (rows[0]?.dataJson ?? {}) as Record<string, unknown>;
    return {
        actionOverrides: parseRoleOverrides(security.role_action_overrides_json),
        moduleOverrides: parseRoleOverrides(security.role_module_overrides_json),
    };
};

const getAuthUserFromRequest = async (
    authorizationHeader: string | undefined,
    db: DrizzleClient,
    jwtSecret?: string
) => {
    const token = getBearerToken(authorizationHeader);
    if (!token) return null;

    const payload = verifySessionToken(token, jwtSecret);
    if (!payload) return null;

    const entry = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    return entry[0] ?? null;
};

const resolveAdminRole = (authUser: UserRow | null, bindings: Bindings): AdminAccessRole => {
    if (!authUser?.email) return null;
    const email = authUser.email.toLowerCase();
    const superAdmins = new Set([
        ...parseAdmins(bindings.ADMINS),
        ...parseAdmins(bindings.DEVELOPER_ADMIN_EMAILS),
    ]);
    if (superAdmins.has(email)) {
        return 'SUPER_ADMIN';
    }
    const supportAdmins = new Set(parseAdmins(bindings.SUPPORT_ADMINS));
    if (supportAdmins.has(email)) return 'SUPPORT_ADMIN';

    const readOnlyAdmins = new Set(parseAdmins(bindings.READ_ONLY_ADMINS));
    if (readOnlyAdmins.has(email)) return 'READ_ONLY_ADMIN';

    return null;
};

const resolveActiveBusinessId = async (
    c: AppContext,
    db: DrizzleClient,
    authUser: UserRow
): Promise<string | null> => {
    const requestedBusinessId = getRequestedBusinessId(c);

    if (requestedBusinessId) {
        const owned = await db
            .select({ id: businesses.id })
            .from(businesses)
            .where(and(eq(businesses.id, requestedBusinessId), eq(businesses.ownerUserId, authUser.id), eq(businesses.isActive, true)))
            .limit(1);

        if (owned[0]) return owned[0].id;

        const membership = await db
            .select({ businessId: businessMembers.businessId })
            .from(businessMembers)
            .where(and(
                eq(businessMembers.businessId, requestedBusinessId),
                eq(businessMembers.userId, authUser.id),
                eq(businessMembers.isActive, true),
            ))
            .limit(1);

        if (membership[0]) return membership[0].businessId;

        return null;
    }

    const firstOwned = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(and(eq(businesses.ownerUserId, authUser.id), eq(businesses.isActive, true)))
        .limit(1);

    if (firstOwned[0]) return firstOwned[0].id;

    const firstMember = await db
        .select({ businessId: businessMembers.businessId })
        .from(businessMembers)
        .where(and(eq(businessMembers.userId, authUser.id), eq(businessMembers.isActive, true)))
        .limit(1);

    return firstMember[0]?.businessId ?? null;
};

const setAnonymousContext = (c: AppContext) => {
    c.set('authUser', null);
    c.set('authRole', null);
    c.set('activeBusinessId', null);
    c.set('effectiveUserId', null);
    c.set('effectiveOwnerUserId', null);
    c.set('effectiveOrganizationId', null);
    c.set('organizationRole', null);
    c.set('organizationPermissions', {});
    c.set('organizationActionOverrides', {});
    c.set('organizationModuleOverrides', {});
};

const resolveOrganizationContext = async (
    db: DrizzleClient,
    user: UserRow,
    businessId: string | null
) => {
    if (!businessId) {
        return {
            organizationRole: null as AppVariables['organizationRole'],
            organizationPermissions: {} as Record<string, boolean>,
            organizationActionOverrides: {} as Record<string, Record<string, boolean>>,
            organizationModuleOverrides: {} as Record<string, Record<string, boolean>>,
            ownerUserId: user.id,
        };
    }

    const businessRows = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    const business = businessRows[0];
    if (!business) {
        return {
            organizationRole: null as AppVariables['organizationRole'],
            organizationPermissions: {},
            organizationActionOverrides: {} as Record<string, Record<string, boolean>>,
            organizationModuleOverrides: {} as Record<string, Record<string, boolean>>,
            ownerUserId: user.id,
        };
    }

    const roleOverrides = await getRoleOverridesFromSecurity(db, businessId);

    if (business.ownerUserId === user.id) {
        return {
            organizationRole: 'owner' as const,
            organizationPermissions: {} as Record<string, boolean>,
            organizationActionOverrides: roleOverrides.actionOverrides,
            organizationModuleOverrides: roleOverrides.moduleOverrides,
            ownerUserId: business.ownerUserId,
        };
    }

    const membershipRows = await db
        .select()
        .from(businessMembers)
        .where(and(
            eq(businessMembers.businessId, businessId),
            eq(businessMembers.userId, user.id),
            eq(businessMembers.isActive, true),
        ))
        .limit(1);
    const membership = membershipRows[0];

    if (!membership) {
        return {
            organizationRole: null as AppVariables['organizationRole'],
            organizationPermissions: {} as Record<string, boolean>,
            organizationActionOverrides: roleOverrides.actionOverrides,
            organizationModuleOverrides: roleOverrides.moduleOverrides,
            ownerUserId: business.ownerUserId,
        };
    }

    return {
        organizationRole: membership.role === 'OWNER' ? 'manager' as const : 'salesman' as const,
        organizationPermissions: (membership.permissions ?? {}) as Record<string, boolean>,
        organizationActionOverrides: roleOverrides.actionOverrides,
        organizationModuleOverrides: roleOverrides.moduleOverrides,
        ownerUserId: business.ownerUserId,
    };
};

const setAuthenticatedContext = async (
    c: AppContext,
    db: DrizzleClient,
    user: UserRow,
    role: AdminAccessRole,
    businessId: string | null
) => {
    const organizationContext = await resolveOrganizationContext(db, user, businessId);

    c.set('authUser', user);
    c.set('authRole', role);
    c.set('activeBusinessId', businessId);
    c.set('effectiveUserId', user.id);
    c.set('effectiveOwnerUserId', organizationContext.ownerUserId);
    c.set('effectiveOrganizationId', businessId);
    c.set('organizationRole', organizationContext.organizationRole);
    c.set('organizationPermissions', organizationContext.organizationPermissions);
    c.set('organizationActionOverrides', organizationContext.organizationActionOverrides);
    c.set('organizationModuleOverrides', organizationContext.organizationModuleOverrides);
};

export const optionalAuth = async (c: AppContext, next: Next) => {
    const db = c.get('db');
    const jwtSecret = c.env.JWT_SECRET ?? c.env.API_JWT_SECRET;
    const authUser = await getAuthUserFromRequest(c.req.header('Authorization'), db, jwtSecret);

    if (!authUser) {
        setAnonymousContext(c);
        await next();
        return;
    }

    const businessId = await resolveActiveBusinessId(c, db, authUser);
    await setAuthenticatedContext(c, db, authUser, resolveAdminRole(authUser, c.env), businessId);
    await next();
};

export const requireAuth = async (c: AppContext, next: Next) => {
    const db = c.get('db');
    const jwtSecret = c.env.JWT_SECRET ?? c.env.API_JWT_SECRET;
    const authUser = await getAuthUserFromRequest(c.req.header('Authorization'), db, jwtSecret);

    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const businessId = await resolveActiveBusinessId(c, db, authUser);
    if (getRequestedBusinessId(c) && !businessId) {
        return c.json({ ok: false, message: 'Business access denied.' }, 403);
    }

    await setAuthenticatedContext(c, db, authUser, resolveAdminRole(authUser, c.env), businessId);
    await next();
};

export const requireAdmin = async (c: AppContext, next: Next) => {
    const db = c.get('db');
    const jwtSecret = c.env.JWT_SECRET ?? c.env.API_JWT_SECRET;
    const authUser = await getAuthUserFromRequest(c.req.header('Authorization'), db, jwtSecret);

    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const authRole = resolveAdminRole(authUser, c.env);
    if (!authRole) {
        return c.json({ ok: false, message: 'Admin access required.' }, 403);
    }

    const businessId = await resolveActiveBusinessId(c, db, authUser);
    await setAuthenticatedContext(c, db, authUser, authRole, businessId);
    await next();
};

export const requireSuperAdmin = async (c: AppContext, next: Next) => {
    const db = c.get('db');
    const jwtSecret = c.env.JWT_SECRET ?? c.env.API_JWT_SECRET;
    const authUser = await getAuthUserFromRequest(c.req.header('Authorization'), db, jwtSecret);

    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const authRole = resolveAdminRole(authUser, c.env);
    if (authRole !== 'SUPER_ADMIN') {
        return c.json({ ok: false, message: 'Super-admin access required.' }, 403);
    }

    const businessId = await resolveActiveBusinessId(c, db, authUser);
    await setAuthenticatedContext(c, db, authUser, authRole, businessId);
    await next();
};

export const requireDeveloperAdmin = requireSuperAdmin;

export const isDeveloperAdminPrincipal = (authUser: UserRow, bindings: Bindings): boolean => {
    const role = resolveAdminRole(authUser, bindings);
    return role === 'SUPER_ADMIN';
};
