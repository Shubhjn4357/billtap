import { Hono } from 'hono';
import { and, desc, eq, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { analyticsEvents } from '../db/schema';
import { requireAdmin, requireAuth, type AppEnv } from '../middleware/auth';
import { ensurePrimaryBusiness, getAccessibleBusiness, getRequestedBusinessId } from './helpers';

const analyticsRoute = new Hono<AppEnv>();

const eventSchema = z.object({
    eventType: z.string().trim().min(2),
    source: z.string().trim().optional(),
    planId: z.string().trim().optional(),
    offerId: z.string().trim().optional(),
    value: z.number().optional(),
    currency: z.string().trim().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

analyticsRoute.post('/events', requireAuth, async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const payload = eventSchema.parse(await c.req.json());
        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);

        const now = new Date();
        await db.insert(analyticsEvents).values({
            id: `evt_${nanoid(16)}`,
            businessId: business.id,
            userId: authUser.id,
            eventType: payload.eventType,
            source: payload.source ?? null,
            planId: payload.planId ?? null,
            offerId: payload.offerId ?? null,
            value: payload.value ?? null,
            currency: payload.currency ?? null,
            metadata: payload.metadata ?? {},
            createdAt: now,
        });

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to track event.' }, 400);
    }
});

analyticsRoute.get('/events', requireAdmin, async (c) => {
    const db = c.get('db');
    const days = Math.max(1, Math.min(Number(c.req.query('days') ?? 7), 365));
    const from = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const rows = await db
        .select()
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, from))
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(5000);

    return c.json({ ok: true, events: rows });
});

export default analyticsRoute;
