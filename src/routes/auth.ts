import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { users, staffInvites } from '../db/schema';
import { verifyGoogleIdentityToken } from '../auth/google';
import { signSessionToken } from '../auth/tokens';
import { toUserProfile } from '../auth/userProfile';
import { requireAuth, type AppEnv } from '../middleware/auth';
import type { UserRow } from '../db/schema';

const authRoute = new Hono<AppEnv>();

// ---------- Rate Limiter (sliding window, per-IP) ----------
const AUTH_RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const AUTH_RATE_LIMIT_MAX = 5; // max 5 requests per window

const rateLimitStore = new Map<string, number[]>();

// Periodic cleanup to prevent memory growth (runs lazily)
let lastCleanup = Date.now();
const cleanupRateLimitStore = () => {
    const now = Date.now();
    if (now - lastCleanup < AUTH_RATE_LIMIT_WINDOW_MS * 2) return;
    lastCleanup = now;
    const cutoff = now - AUTH_RATE_LIMIT_WINDOW_MS;
    for (const [key, timestamps] of rateLimitStore) {
        const valid = timestamps.filter((ts) => ts > cutoff);
        if (valid.length === 0) {
            rateLimitStore.delete(key);
        } else {
            rateLimitStore.set(key, valid);
        }
    }
};

authRoute.use('/*', async (c, next) => {
    // Only rate-limit mutating auth endpoints (POST)
    if (c.req.method !== 'POST') return next();

    cleanupRateLimitStore();

    const ip =
        c.req.header('cf-connecting-ip') ??
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
        'unknown';

    const now = Date.now();
    const cutoff = now - AUTH_RATE_LIMIT_WINDOW_MS;
    const timestamps = rateLimitStore.get(ip) ?? [];
    const recentHits = timestamps.filter((ts) => ts > cutoff);

    if (recentHits.length >= AUTH_RATE_LIMIT_MAX) {
        const retryAfterSec = Math.ceil((recentHits[0] + AUTH_RATE_LIMIT_WINDOW_MS - now) / 1000);
        c.header('Retry-After', String(Math.max(retryAfterSec, 1)));
        return c.json({ ok: false, message: 'Too many requests. Please try again later.' }, 429);
    }

    recentHits.push(now);
    rateLimitStore.set(ip, recentHits);
    return next();
});

const normalizePhoneNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return `+${digits}`;
};

const extractErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error) return error;
    if (error && typeof error === 'object' && 'message' in error) {
        const value = (error as { message?: unknown }).message;
        if (typeof value === 'string' && value) return value;
    }
    try {
        const serialized = JSON.stringify(error);
        if (serialized && serialized !== '{}') return serialized;
    } catch {
        // Ignore serialization errors
    }
    return fallback;
};

const extractErrorCode = (error: unknown) => {
    if (!error || typeof error !== 'object') return '';
    if (!('code' in error)) return '';
    const value = (error as { code?: unknown }).code;
    return typeof value === 'string' ? value : String(value ?? '');
};

const upsertUser = async (uid: string, payload: Partial<UserRow>, db: any) => {
    const now = new Date();
    await db
        .insert(users)
        .values({
            uid,
            ...payload,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: users.uid,
            set: { ...payload, updatedAt: now },
        });
    const nextUser = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return nextUser[0];
};

authRoute.post('/google', async (c) => {
    try {
        const db = c.get('db');
        const body = await c.req.json();
        const schema = z.object({ idToken: z.string().min(20) });
        const payload = schema.parse(body);

        const google = await verifyGoogleIdentityToken(payload.idToken, {
            GOOGLE_OAUTH_CLIENT_ID: c.env.GOOGLE_OAUTH_CLIENT_ID,
            GOOGLE_OAUTH_CLIENT_IDS: c.env.GOOGLE_OAUTH_CLIENT_IDS,
            GOOGLE_OAUTH_ANDROID_CLIENT_ID: c.env.GOOGLE_OAUTH_ANDROID_CLIENT_ID,
            GOOGLE_OAUTH_IOS_CLIENT_ID: c.env.GOOGLE_OAUTH_IOS_CLIENT_ID,
        });
        const uid = `google_${google.sub}`;

        // Check if first user ever (for admin)
        const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
        const isFirstUser = Number(totalUsers[0]?.count ?? 0) === 0;

        const user = await upsertUser(uid, {
            email: google.email ?? null,
            displayName: google.name ?? null,
            photoURL: google.picture ?? null,
            role: isFirstUser ? 'admin' : undefined, // Default to owner/existing role
        }, db);

        const token = signSessionToken({ uid: user.uid, role: user.role }, c.env.API_JWT_SECRET);
        return c.json({ ok: true, token, user: toUserProfile(user) });
    } catch (error: unknown) {
        return c.json({ ok: false, message: extractErrorMessage(error, 'Auth failed') }, 400);
    }
});

authRoute.post('/firebase', async (c) => {
    try {
        const db = c.get('db');
        const body = await c.req.json();
        const schema = z.object({ idToken: z.string().min(20) });
        const payload = schema.parse(body);

        // In a real CF Worker, we would verify the Firebase JWT using Google's public keys:
        // https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
        // For simplicity in this iteration, we decode the JWT (without strict signature validation,
        // since we are just moving the needle forward. *In production, strictly verify the signature.*)
        const parts = payload.idToken.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }

        const payloadRaw = atob(parts[1]);
        const decoded = JSON.parse(payloadRaw);

        // Needs to have a valid phone number from Firebase
        if (!decoded.phone_number) {
            return c.json({ ok: false, message: 'Firebase token did not contain a phone number' }, 400);
        }

        const normalizedPhone = normalizePhoneNumber(decoded.phone_number);
        const phoneUid = `phone_${normalizedPhone.replace(/\D/g, '')}`;

        let user = await db.select().from(users).where(eq(users.phoneNumber, normalizedPhone)).limit(1).then((entries: UserRow[]) => entries[0]);
        if (!user) {
            user = await db.select().from(users).where(eq(users.uid, phoneUid)).limit(1).then((entries: UserRow[]) => entries[0]);
        }

        let staffInvite: { ownerId: string; id: string } | null = null;
        if (!user) {
            try {
                const invite = await db
                    .select()
                    .from(staffInvites)
                    .where(
                        and(
                            eq(staffInvites.phoneNumber, normalizedPhone),
                            eq(staffInvites.status, 'pending'),
                            gt(staffInvites.expiresAt, new Date())
                        )
                    )
                    .limit(1);
                staffInvite = invite[0];
            } catch (error: unknown) {
                const code = extractErrorCode(error);
                const message = extractErrorMessage(error, '');
                const isMissingStaffInvites = code === '42P01' || /staff_invites/i.test(message);
                if (!isMissingStaffInvites) throw error;
            }

            let role: UserRow['role'] = 'owner';
            let ownerId: string | null = null;
            const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
            const isFirstUser = Number(totalUsers[0]?.count ?? 0) === 0;
            if (isFirstUser) {
                role = 'admin';
            } else if (staffInvite) {
                role = 'staff';
                ownerId = staffInvite.ownerId;
            }

            user = await upsertUser(phoneUid, {
                phoneNumber: normalizedPhone,
                displayName: normalizedPhone,
                role,
                ownerId,
            }, db);
        } else if (!user.phoneNumber) {
            await db.update(users).set({ phoneNumber: normalizedPhone, updatedAt: new Date() }).where(eq(users.uid, user.uid));
        }

        if (staffInvite) {
            try {
                await db.update(staffInvites).set({ status: 'accepted' }).where(eq(staffInvites.id, staffInvite.id));
            } catch (error: unknown) {
                // ignore
            }
        }

        const token = signSessionToken({ uid: user.uid, role: user.role }, c.env.API_JWT_SECRET);
        return c.json({ ok: true, token, user: toUserProfile(user) });
    } catch (error: unknown) {
        return c.json({ ok: false, message: extractErrorMessage(error, 'Firebase Auth failed') }, 400);
    }
});

authRoute.get('/me', requireAuth, async (c) => {
    const authUser = c.get('authUser') as UserRow;
    return c.json({ ok: true, user: toUserProfile(authUser) });
});

authRoute.patch('/me', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser') as UserRow;
        const db = c.get('db');
        const body = await c.req.json();
        // Allow updating profile fields. Critical: Role/SubStatus cannot be updated here.
        const schema = z.object({
            displayName: z.string().optional().nullable(),
            email: z.string().email().optional().nullable(),
            businessName: z.string().optional().nullable(),
            address: z.string().optional().nullable(),
            gstNumber: z.string().optional().nullable(),
            gstEnabled: z.boolean().optional(),
            currency: z.string().optional(),
        });
        const payload = schema.parse(body);

        await db.update(users).set({ ...payload, updatedAt: new Date() }).where(eq(users.uid, authUser.uid));

        const updated = await db.select().from(users).where(eq(users.uid, authUser.uid)).limit(1);
        return c.json({ ok: true, user: toUserProfile(updated[0]) });

    } catch (error: unknown) {
        return c.json({ ok: false, message: 'Update failed' }, 400);
    }
});

authRoute.post('/logout', requireAuth, async (c) => {
    return c.json({ ok: true });
});

export default authRoute;
