import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { phoneVerifications, users } from '../db/schema';
import { toUserProfile } from '../auth/userProfile';
import { requireAuth, type AppEnv } from '../middleware/auth';

const usersRoute = new Hono<AppEnv>();

const normalizePhoneNumber = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return `+${digits}`;
};

usersRoute.get('/me', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    return c.json({ ok: true, user: toUserProfile(authUser) });
});

usersRoute.patch('/me', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const db = c.get('db');
        const body = await c.req.json();
        const payload = z.object({
            displayName: z.string().optional().nullable(),
            email: z.string().email().optional().nullable(),
            phoneNumber: z.string().optional().nullable(),
            businessName: z.string().optional().nullable(),
            address: z.string().optional().nullable(),
            gstNumber: z.string().optional().nullable(),
            gstEnabled: z.boolean().optional(),
            currency: z.string().optional(),
        }).parse(body);

        const updatePayload: Record<string, unknown> = { ...payload };
        if (payload.phoneNumber !== undefined) {
            const normalizedPhone = payload.phoneNumber ? normalizePhoneNumber(payload.phoneNumber) : null;
            if (normalizedPhone && normalizedPhone.length < 8) {
                return c.json({ ok: false, message: 'Invalid phone number.' }, 400);
            }
            updatePayload.phoneNumber = normalizedPhone;
        }

        await db.update(users).set({
            ...updatePayload,
            updatedAt: new Date(),
        }).where(eq(users.uid, authUser.uid));

        const nextUser = await db.select().from(users).where(eq(users.uid, authUser.uid)).limit(1);
        const resolvedUser = nextUser[0] ?? authUser;
        return c.json({ ok: true, user: toUserProfile(resolvedUser) });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Update failed.' }, 400);
    }
});

usersRoute.post('/me/phone/link', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const db = c.get('db');
        const body = await c.req.json();
        const payload = z.object({
            verificationId: z.string().min(8),
            verificationCode: z.string().min(1),
        }).parse(body);

        const normalizedCode = payload.verificationCode.replace(/\D/g, '');
        if (normalizedCode.length !== 6) {
            return c.json({ ok: false, message: 'Invalid code.' }, 400);
        }

        const rows = await db
            .select()
            .from(phoneVerifications)
            .where(eq(phoneVerifications.id, payload.verificationId))
            .limit(1);
        const verification = rows[0];
        if (!verification) {
            return c.json({ ok: false, message: 'Verification request not found.' }, 404);
        }
        if (verification.consumedAt) {
            return c.json({ ok: false, message: 'Verification code already used.' }, 400);
        }
        if (verification.expiresAt < new Date()) {
            return c.json({ ok: false, message: 'Verification code expired.' }, 400);
        }
        if ((verification.attempts ?? 0) >= 5) {
            return c.json({ ok: false, message: 'Too many attempts. Request a new code.' }, 400);
        }

        if ((verification.code ?? '').trim() !== normalizedCode) {
            const nextAttempts = (verification.attempts ?? 0) + 1;
            await db
                .update(phoneVerifications)
                .set({
                    attempts: nextAttempts,
                    consumedAt: nextAttempts >= 5 ? new Date() : verification.consumedAt,
                })
                .where(eq(phoneVerifications.id, verification.id));
            return c.json({
                ok: false,
                message: nextAttempts >= 5 ? 'Too many attempts. Request a new code.' : 'Invalid code.',
            }, 400);
        }

        const normalizedPhone = normalizePhoneNumber(verification.phoneNumber);
        if (!normalizedPhone || normalizedPhone.length < 8) {
            return c.json({ ok: false, message: 'Invalid phone number.' }, 400);
        }

        const existingUserRows = await db
            .select()
            .from(users)
            .where(eq(users.phoneNumber, normalizedPhone))
            .limit(1);
        const existingUser = existingUserRows[0];
        if (existingUser && existingUser.uid !== authUser.uid) {
            return c.json({ ok: false, message: 'This phone number is already linked to another account.' }, 409);
        }

        const consumed = await db
            .update(phoneVerifications)
            .set({
                consumedAt: new Date(),
                attempts: (verification.attempts ?? 0) + 1,
            })
            .where(and(eq(phoneVerifications.id, verification.id), isNull(phoneVerifications.consumedAt)))
            .returning({ id: phoneVerifications.id });

        if (consumed.length === 0) {
            return c.json({ ok: false, message: 'Verification code already used.' }, 400);
        }

        await db.update(users).set({
            phoneNumber: normalizedPhone,
            updatedAt: new Date(),
        }).where(eq(users.uid, authUser.uid));

        const nextUser = await db.select().from(users).where(eq(users.uid, authUser.uid)).limit(1);
        const resolvedUser = nextUser[0] ?? authUser;
        return c.json({ ok: true, user: toUserProfile(resolvedUser) });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Phone linking failed.' }, 400);
    }
});

export default usersRoute;
