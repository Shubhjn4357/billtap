import type { Context, Next } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { verifySessionToken } from '../auth/tokens';
import { organizationMembers, organizations, users } from '../db/schema';
import type { DrizzleClient } from '../db/client';
import type { UserRow } from '../db/schema';

// Define App Variables for Hono Context
export type Bindings = {
    DATABASE_URL: string;
    MEDIA_BUCKET?: R2Bucket;
    MEDIA_UPLOAD_SECRET?: string;
    MEDIA_PUBLIC_BASE_URL?: string;
    MEDIA_MAX_UPLOAD_MB?: string;
    CRON_SECRET?: string;
    PAYMENT_PROVIDER?: string;
    PAYMENT_WEBHOOK_SECRET?: string;
    RAZORPAY_KEY_ID?: string;
    RAZORPAY_KEY_SECRET?: string;
    RAZORPAY_WEBHOOK_SECRET?: string;
    CHECKOUT_BASE_URL?: string;
    CORS_ORIGINS?: string;
    API_JWT_SECRET?: string;
    GOOGLE_OAUTH_CLIENT_ID?: string;
    GOOGLE_OAUTH_CLIENT_IDS?: string;
    GOOGLE_OAUTH_ANDROID_CLIENT_ID?: string;
    GOOGLE_OAUTH_IOS_CLIENT_ID?: string;
    DEVELOPER_ADMIN_UIDS?: string;
    DEVELOPER_ADMIN_EMAILS?: string;
    APK_OWNER_UID?: string;
    OTP_RETENTION_HOURS?: string;
    WHATSAPP_API_URL?: string;
    WHATSAPP_API_TOKEN?: string;
};

export type AppVariables = {
    authUser: UserRow | null;
    effectiveUserId: string | null; // Active organization ID (legacy alias).
    effectiveOwnerUserId: string | null;
    effectiveOrganizationId: string | null;
    organizationRole: 'owner' | 'manager' | 'salesman' | null;
    organizationPermissions: Record<string, boolean>;
    db: DrizzleClient;
};

export type AppEnv = {
    Bindings: Bindings;
    Variables: AppVariables;
};

export type AppContext = Context<AppEnv>;

const getBearerToken = (authHeader: string | undefined) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice('Bearer '.length).trim() || null;
};

const parseEnvCsv = (value: string | undefined): string[] =>
    (value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

const extractErrorCode = (error: unknown): string => {
    if (!error || typeof error !== 'object') return '';
    if (!('code' in error)) return '';
    const value = (error as { code?: unknown }).code;
    return typeof value === 'string' ? value : String(value ?? '');
};

const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (!error || typeof error !== 'object') return '';
    if (!('message' in error)) return '';
    const value = (error as { message?: unknown }).message;
    return typeof value === 'string' ? value : String(value ?? '');
};

const isMissingRelationError = (error: unknown, relationName: string): boolean => {
    const code = extractErrorCode(error);
    if (code === '42P01') return true;
    return new RegExp(relationName, 'i').test(extractErrorMessage(error));
};

const normalizeOrgId = (value: string | undefined | null): string | null => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
};

const getRequestedOrganizationId = (c: AppContext): string | null => {
    const byHeader = normalizeOrgId(
        c.req.header('X-Organization-Id')
        ?? c.req.header('x-organization-id')
    );
    if (byHeader) return byHeader;

    return normalizeOrgId(c.req.query('organizationId'));
};

type OrganizationAccessContext = {
    ownerUserId: string;
    organizationId: string;
    role: 'owner' | 'manager' | 'salesman';
    permissions: Record<string, boolean>;
};

const resolveOrganizationAccessContext = async (
    c: AppContext,
    authUser: UserRow
): Promise<OrganizationAccessContext | null> => {
    const db = c.get('db');
    const requestedOrganizationId = getRequestedOrganizationId(c);
    const inferredOwnerUserId = authUser.role === 'staff' && authUser.ownerId ? authUser.ownerId : authUser.uid;

    const fallbackContext: OrganizationAccessContext = {
        ownerUserId: inferredOwnerUserId,
        organizationId: inferredOwnerUserId,
        role: authUser.role === 'staff' ? 'salesman' : 'owner',
        permissions: {},
    };

    try {
        if (authUser.role === 'admin') {
            if (!requestedOrganizationId) {
                return {
                    ownerUserId: authUser.uid,
                    organizationId: authUser.uid,
                    role: 'owner',
                    permissions: {},
                };
            }

            const rows = await db
                .select({
                    id: organizations.id,
                    userId: organizations.userId,
                })
                .from(organizations)
                .where(eq(organizations.id, requestedOrganizationId))
                .limit(1);

            const org = rows[0];
            if (!org) {
                if (requestedOrganizationId === authUser.uid) {
                    return {
                        ownerUserId: authUser.uid,
                        organizationId: authUser.uid,
                        role: 'owner',
                        permissions: {},
                    };
                }
                return null;
            }

            return {
                ownerUserId: org.userId,
                organizationId: org.id,
                role: 'owner',
                permissions: {},
            };
        }

        if (authUser.role === 'staff') {
            const whereConditions = [
                eq(organizationMembers.userId, authUser.uid),
                eq(organizationMembers.isActive, true),
            ];
            if (requestedOrganizationId) {
                whereConditions.push(eq(organizationMembers.organizationId, requestedOrganizationId));
            }

            const rows = await db
                .select({
                    organizationId: organizationMembers.organizationId,
                    role: organizationMembers.role,
                    permissions: organizationMembers.permissions,
                    ownerUserId: organizations.userId,
                    isActive: organizations.isActive,
                })
                .from(organizationMembers)
                .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
                .where(and(...whereConditions))
                .orderBy(asc(organizationMembers.joinedAt))
                .limit(1);

            const membership = rows[0];
            if (!membership || membership.isActive !== true) {
                if (requestedOrganizationId && requestedOrganizationId !== inferredOwnerUserId) {
                    return null;
                }
                return fallbackContext;
            }

            return {
                ownerUserId: membership.ownerUserId,
                organizationId: membership.organizationId,
                role: membership.role,
                permissions: membership.permissions ?? {},
            };
        }

        const ownerConditions = [eq(organizations.userId, inferredOwnerUserId), eq(organizations.isActive, true)];
        if (requestedOrganizationId) {
            ownerConditions.push(eq(organizations.id, requestedOrganizationId));
        }

        const ownerRows = await db
            .select({
                id: organizations.id,
            })
            .from(organizations)
            .where(and(...ownerConditions))
            .orderBy(asc(organizations.createdAt))
            .limit(1);

        const org = ownerRows[0];
        if (!org) {
            if (requestedOrganizationId && requestedOrganizationId !== inferredOwnerUserId) {
                return null;
            }
            return fallbackContext;
        }

        return {
            ownerUserId: inferredOwnerUserId,
            organizationId: org.id,
            role: 'owner',
            permissions: {},
        };
    } catch (error: unknown) {
        const missingOrgTables =
            isMissingRelationError(error, 'organizations')
            || isMissingRelationError(error, 'organization_members');
        if (!missingOrgTables) throw error;
        return fallbackContext;
    }
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

    const entry = await db.select().from(users).where(eq(users.uid, payload.uid)).limit(1);
    return entry[0] ?? null;
};

export const isDeveloperAdminPrincipal = (authUser: UserRow, bindings: Bindings): boolean => {
    const configuredUids = new Set<string>([
        ...parseEnvCsv(bindings.DEVELOPER_ADMIN_UIDS),
        ...(bindings.APK_OWNER_UID ? [bindings.APK_OWNER_UID] : []),
    ]);
    const configuredEmails = new Set<string>(
        parseEnvCsv(bindings.DEVELOPER_ADMIN_EMAILS).map((email) => email.toLowerCase())
    );

    const hasConfiguredPrincipals = configuredUids.size > 0 || configuredEmails.size > 0;
    const uidMatch = configuredUids.has(authUser.uid);
    const emailMatch = !!authUser.email && configuredEmails.has(authUser.email.toLowerCase());

    if (hasConfiguredPrincipals) {
        return uidMatch || emailMatch;
    }

    // Fallback for setups where principal env values are not configured yet.
    return authUser.role === 'admin';
};

export const optionalAuth = async (c: AppContext, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const db = c.get('db');
    const authUser = await getAuthUserFromRequest(authHeader, db, c.env.API_JWT_SECRET);

    if (!authUser) {
        c.set('authUser', null);
        c.set('effectiveUserId', null);
        c.set('effectiveOwnerUserId', null);
        c.set('effectiveOrganizationId', null);
        c.set('organizationRole', null);
        c.set('organizationPermissions', {});
        await next();
        return;
    }

    const context = await resolveOrganizationAccessContext(c, authUser);
    c.set('authUser', authUser);
    c.set('effectiveUserId', context?.organizationId ?? authUser.uid);
    c.set('effectiveOwnerUserId', context?.ownerUserId ?? authUser.uid);
    c.set('effectiveOrganizationId', context?.organizationId ?? authUser.uid);
    c.set('organizationRole', context?.role ?? (authUser.role === 'staff' ? 'salesman' : 'owner'));
    c.set('organizationPermissions', context?.permissions ?? {});

    await next();
};

export const requireAuth = async (c: AppContext, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const db = c.get('db');
    const authUser = await getAuthUserFromRequest(authHeader, db, c.env.API_JWT_SECRET);

    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    c.set('authUser', authUser);

    const context = await resolveOrganizationAccessContext(c, authUser);
    const requestedOrganizationId = getRequestedOrganizationId(c);
    if (requestedOrganizationId && !context) {
        return c.json({ ok: false, message: 'Organization access denied.' }, 403);
    }

    const ownerUserId = context?.ownerUserId
        ?? (authUser.role === 'staff' && authUser.ownerId ? authUser.ownerId : authUser.uid);
    const organizationId = context?.organizationId ?? ownerUserId;

    c.set('effectiveUserId', organizationId);
    c.set('effectiveOwnerUserId', ownerUserId);
    c.set('effectiveOrganizationId', organizationId);
    c.set('organizationRole', context?.role ?? (authUser.role === 'staff' ? 'salesman' : 'owner'));
    c.set('organizationPermissions', context?.permissions ?? {});

    await next();
};

export const requireAdmin = async (c: AppContext, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const db = c.get('db');
    const authUser = await getAuthUserFromRequest(authHeader, db, c.env.API_JWT_SECRET);

    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    if (authUser.role !== 'admin') {
        return c.json({ ok: false, message: 'Admin access required.' }, 403);
    }

    c.set('authUser', authUser);
    c.set('effectiveUserId', authUser.uid);
    c.set('effectiveOwnerUserId', authUser.uid);
    c.set('effectiveOrganizationId', authUser.uid);
    c.set('organizationRole', 'owner');
    c.set('organizationPermissions', {});

    await next();
};

export const requireDeveloperAdmin = async (c: AppContext, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const db = c.get('db');
    const authUser = await getAuthUserFromRequest(authHeader, db, c.env.API_JWT_SECRET);

    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    if (!isDeveloperAdminPrincipal(authUser, c.env)) {
        return c.json({ ok: false, message: 'Developer admin access required.' }, 403);
    }

    c.set('authUser', authUser);
    c.set('effectiveUserId', authUser.uid);
    c.set('effectiveOwnerUserId', authUser.uid);
    c.set('effectiveOrganizationId', authUser.uid);
    c.set('organizationRole', 'owner');
    c.set('organizationPermissions', {});

    await next();
};
