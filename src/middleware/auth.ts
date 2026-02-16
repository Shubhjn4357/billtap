import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { verifySessionToken } from '../auth/tokens';
import { users } from '../db/schema';
import type { DrizzleClient } from '../db/client';
import type { UserRow } from '../db/schema';

// Define App Variables for Hono Context
export type Bindings = {
    DATABASE_URL: string;
    CRON_SECRET?: string;
    PAYMENT_PROVIDER?: string;
    PAYMENT_WEBHOOK_SECRET?: string;
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
    effectiveUserId: string | null; // Owner ID if staff, Self ID if owner
    organizationId: string | null;
    organizationRole: string | null;
    organizationPermissions: Record<string, boolean> | null;
    organizationOwnerId: string | null;
    organizationSettings: Record<string, unknown> | null;
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

    c.set('authUser', authUser ?? null);
    c.set('effectiveUserId', authUser?.role === 'staff' ? authUser.ownerId : authUser?.uid ?? null);
    c.set('organizationId', null);
    c.set('organizationRole', null);
    c.set('organizationPermissions', null);
    c.set('organizationOwnerId', null);
    c.set('organizationSettings', null);

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
    // If staff, operate on behalf of owner. If owner, operate on self.
    c.set('effectiveUserId', authUser.role === 'staff' && authUser.ownerId ? authUser.ownerId : authUser.uid);
    c.set('organizationId', null);
    c.set('organizationRole', null);
    c.set('organizationPermissions', null);
    c.set('organizationOwnerId', null);
    c.set('organizationSettings', null);

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
    c.set('organizationId', null);
    c.set('organizationRole', null);
    c.set('organizationPermissions', null);
    c.set('organizationOwnerId', null);
    c.set('organizationSettings', null);

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
    c.set('organizationId', null);
    c.set('organizationRole', null);
    c.set('organizationPermissions', null);
    c.set('organizationOwnerId', null);
    c.set('organizationSettings', null);

    await next();
};
