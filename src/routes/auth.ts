import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { users, phoneVerifications, staffInvites } from '../db/schema';
import { verifyGoogleIdentityToken } from '../auth/google';
import { signSessionToken } from '../auth/tokens';
import { requireAuth, type AppEnv } from '../middleware/auth';
import type { UserRow } from '../db/schema';

const authRoute = new Hono<AppEnv>();

const toUserProfile = (row: UserRow) => ({
    uid: row.uid,
    email: row.email,
    phoneNumber: row.phoneNumber,
    displayName: row.displayName,
    photoURL: row.photoURL,
    businessName: row.businessName,
    address: row.address,
    gstEnabled: row.gstEnabled ?? false,
    gstNumber: row.gstNumber,
    currency: row.currency ?? 'INR',
    role: row.role ?? 'owner',
    ownerId: row.ownerId,
    subscriptionStatus: row.subscriptionStatus ?? 'inactive',
    subscriptionPlanId: row.subscriptionPlanId,
    subscriptionPlanName: row.subscriptionPlanName,
    subscriptionAmountMonthly: row.subscriptionAmountMonthly,
    subscriptionCurrency: row.subscriptionCurrency,
    subscriptionStartsAt: row.subscriptionStartsAt,
    subscriptionEndsAt: row.subscriptionEndsAt,
});

const normalizePhoneNumber = (raw: string) => {
    const digits = raw.replace(/[^\d+]/g, '');
    if (!digits) return '';
    return digits.startsWith('+') ? digits : `+${digits}`;
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

        const token = signSessionToken({ uid: user.uid, role: user.role });
        return c.json({ ok: true, token, user: toUserProfile(user) });
    } catch (error: unknown) {
        return c.json({ ok: false, message: extractErrorMessage(error, 'Auth failed') }, 400);
    }
});

authRoute.post('/phone/send', async (c) => {
    try {
        const db = c.get('db');
        const body = await c.req.json();
        const schema = z.object({ phoneNumber: z.string().min(6) });
        const payload = schema.parse(body);
        const phoneNumber = normalizePhoneNumber(payload.phoneNumber);

        if (!phoneNumber || phoneNumber.length < 8) return c.json({ ok: false, message: 'Invalid phone.' }, 400);

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const verificationId = nanoid(24);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.insert(phoneVerifications).values({
            id: verificationId,
            phoneNumber,
            code,
            expiresAt,
            attempts: 0,
            createdAt: new Date(),
        });

        // Return code for now (Development)
        return c.json({ ok: true, verificationId, testCode: code, expiresAt });
    } catch (error: unknown) {
        return c.json({ ok: false, message: extractErrorMessage(error, 'Send failed') }, 400);
    }
});

authRoute.post('/phone/verify', async (c) => {
    try {
        const db = c.get('db');
        const body = await c.req.json();
        const schema = z.object({
            verificationId: z.string().min(8),
            verificationCode: z.string().min(1),
        });
        const payload = schema.parse(body);
        const normalizedCode = payload.verificationCode.replace(/\D/g, '');
        if (normalizedCode.length !== 6) {
            return c.json({ ok: false, message: 'Invalid code' }, 400);
        }

        const user = await db.transaction(async (tx) => {
            const rows = await tx.select().from(phoneVerifications).where(eq(phoneVerifications.id, payload.verificationId)).limit(1);
            const verification = rows[0];

            if (!verification) {
                throw new Error('Not found');
            }
            if (verification.consumedAt) {
                throw new Error('Already used');
            }
            if (verification.expiresAt < new Date()) {
                throw new Error('Expired');
            }

            if ((verification.code ?? '').trim() !== normalizedCode) {
                await tx
                    .update(phoneVerifications)
                    .set({ attempts: sql`${phoneVerifications.attempts} + 1` })
                    .where(eq(phoneVerifications.id, verification.id));
                throw new Error('Invalid code');
            }

            const normalizedPhone = normalizePhoneNumber(verification.phoneNumber);
            const uid = `phone_${normalizedPhone.replace(/\D/g, '')}`;

            // Check for pending staff invite
            let staffInvite: { ownerId: string; id: string } | null = null;
            try {
                const invite = await tx
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
                if (!isMissingStaffInvites) {
                    throw error;
                }
            }
            let role = 'owner';
            let ownerId = null;

            const totalUsers = await tx.select({ count: sql<number>`count(*)` }).from(users);
            const isFirstUser = Number(totalUsers[0]?.count ?? 0) === 0;

            if (isFirstUser) {
                role = 'admin';
            } else if (staffInvite) {
                role = 'staff';
                ownerId = staffInvite.ownerId;
            }

            const user = await upsertUser(uid, {
                phoneNumber: normalizedPhone,
                displayName: normalizedPhone,
                role,
                ownerId,
            }, tx);

            if (staffInvite) {
                try {
                    await tx.update(staffInvites).set({ status: 'accepted' }).where(eq(staffInvites.id, staffInvite.id));
                } catch (error: unknown) {
                    const code = extractErrorCode(error);
                    const message = extractErrorMessage(error, '');
                    const isMissingStaffInvites = code === '42P01' || /staff_invites/i.test(message);
                    if (!isMissingStaffInvites) {
                        throw error;
                    }
                }
            }

            const consumed = await tx
                .update(phoneVerifications)
                .set({
                    consumedAt: new Date(),
                    attempts: sql`${phoneVerifications.attempts} + 1`,
                })
                .where(and(eq(phoneVerifications.id, verification.id), isNull(phoneVerifications.consumedAt)))
                .returning({ id: phoneVerifications.id });

            if (consumed.length === 0) {
                throw new Error('Already used');
            }

            return user;
        });

        const token = signSessionToken({ uid: user.uid, role: user.role });
        return c.json({ ok: true, token, user: toUserProfile(user) });
    } catch (error: unknown) {
        return c.json({ ok: false, message: extractErrorMessage(error, 'Verify failed') }, 400);
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
