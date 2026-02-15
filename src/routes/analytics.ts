import { Hono } from 'hono';
import { and, desc, eq, gte, sql, type SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { analyticsEvents } from '../db/schema';
import { requireAdmin, requireAuth, type AppEnv } from '../middleware/auth';

const analyticsRoute = new Hono<AppEnv>();

analyticsRoute.post('/events', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const body = await c.req.json();
    const payload = z.object({
        eventType: z.string().min(2).max(64),
        source: z.string().max(120).optional(),
        planId: z.string().max(80).optional(),
        offerId: z.string().max(80).optional(),
        value: z.number().optional(),
        currency: z.string().max(6).optional(),
        metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    }).parse(body);

    const db = c.get('db');
    await db.insert(analyticsEvents).values({
        id: nanoid(),
        userId: authUser.uid,
        eventType: payload.eventType,
        source: payload.source ?? null,
        planId: payload.planId ?? null,
        offerId: payload.offerId ?? null,
        value: payload.value ?? null,
        currency: payload.currency?.toUpperCase() ?? null,
        metadata: payload.metadata ?? null,
        createdAt: new Date(),
    });

    return c.json({ ok: true });
});

analyticsRoute.get('/events', requireAdmin, async (c) => {
    const db = c.get('db');
    const startDate = c.req.query('startDate');
    const userId = c.req.query('userId');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 5000);

    const conditions: SQL[] = [];

    if (startDate) {
        const parsed = new Date(startDate);
        if (!Number.isNaN(parsed.getTime())) {
            conditions.push(gte(analyticsEvents.createdAt, parsed));
        }
    }

    if (userId) {
        conditions.push(eq(analyticsEvents.userId, userId));
    }

    const data = await db
        .select()
        .from(analyticsEvents)
        .where(conditions.length > 0 ? and(...conditions) : sql`true`)
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(limit);

    return c.json({ ok: true, events: data });
});

export default analyticsRoute;
