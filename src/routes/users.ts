import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '../db/schema';
import { toUserProfile } from '../auth/userProfile';
import { requireAuth, type AppEnv } from '../middleware/auth';

const usersRoute = new Hono<AppEnv>();

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
            businessName: z.string().optional().nullable(),
            address: z.string().optional().nullable(),
            gstNumber: z.string().optional().nullable(),
            gstEnabled: z.boolean().optional(),
            currency: z.string().optional(),
        }).parse(body);

        await db.update(users).set({
            ...payload,
            updatedAt: new Date(),
        }).where(eq(users.uid, authUser.uid));

        const nextUser = await db.select().from(users).where(eq(users.uid, authUser.uid)).limit(1);
        const resolvedUser = nextUser[0] ?? authUser;
        return c.json({ ok: true, user: toUserProfile(resolvedUser) });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Update failed.' }, 400);
    }
});

export default usersRoute;
