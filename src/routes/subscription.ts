import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, desc, eq, lte, or, sql } from 'drizzle-orm';
import { plans, offers, paymentIntents, analyticsEvents, users } from '../db/schema';
import { withTransaction } from '../db/transaction';
import { requireAuth, requireAdmin, optionalAuth, type AppEnv } from '../middleware/auth';

const subscriptionRoute = new Hono<AppEnv>();

const parseBoolean = (value: string | undefined, fallback = false) => {
    if (value === undefined) return fallback;
    return value.toLowerCase() === 'true';
};

// GET /plans - List Plans
subscriptionRoute.get('/plans', optionalAuth, async (c) => {
    const db = c.get('db');
    const includeInactive = parseBoolean(c.req.query('includeInactive'), false);
    const authUser = c.get('authUser');

    if (includeInactive && authUser?.role !== 'admin') {
        return c.json({ ok: false, message: 'Admin access required.' }, 403);
    }

    const data = await db
        .select()
        .from(plans)
        .where(includeInactive ? sql`true` : eq(plans.isActive, true))
        .orderBy(asc(plans.displayOrder));

    return c.json({ ok: true, plans: data });
});

// GET /offers/active - List Active Offers
subscriptionRoute.get('/offers/active', optionalAuth, async (c) => {
    const authUser = c.get('authUser');
    const db = c.get('db');
    const now = new Date();

    const data = await db
        .select()
        .from(offers)
        .where(
            and(
                eq(offers.isActive, true),
                sql`(${offers.startsAt} is null or ${offers.startsAt} <= ${now})`,
                sql`(${offers.endsAt} is null or ${offers.endsAt} >= ${now})`
            )
        )
        .orderBy(desc(offers.priority));

    // Filter audience logic...
    const filtered = data.filter((entry) => {
        const audience = entry.audience;
        const subStatus = authUser?.subscriptionStatus || 'inactive';
        if (audience === 'all') return true;
        if (audience === 'active_subscribers') return subStatus === 'active';
        if (audience === 'inactive_subscribers') return subStatus !== 'active';
        return false;
    });

    return c.json({ ok: true, offers: filtered });
});

// POST /checkout - Create Checkout Session
subscriptionRoute.post('/checkout', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized' }, 401);

        const body = await c.req.json();
        const schema = z.object({
            planId: z.string().min(1),
            planName: z.string().min(1),
            amount: z.number().positive(),
            currency: z.string().min(3).max(6),
        });
        const payload = schema.parse(body);

        const provider = ['stripe', 'razorpay'].includes(String(c.env.PAYMENT_PROVIDER || '').toLowerCase())
            ? String(c.env.PAYMENT_PROVIDER || '').toLowerCase()
            : 'mock';

        const intentId = nanoid();
        const checkoutBase = c.env.CHECKOUT_BASE_URL || 'https://example.com/checkout';
        const checkoutUrl = `${checkoutBase}?intentId=${encodeURIComponent(intentId)}&provider=${provider}`;
        const now = new Date();
        const db = c.get('db');

        await db.insert(paymentIntents).values({
            id: intentId,
            userId: authUser.uid,
            planId: payload.planId,
            planName: payload.planName,
            amount: payload.amount,
            currency: payload.currency.toUpperCase(),
            provider,
            status: 'pending',
            checkoutUrl,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, intentId, checkoutUrl, provider });
    } catch (error: unknown) {
        return c.json({ ok: false, message: 'Checkout failed' }, 400);
    }
});

// GET /intents/:intentId/status - Auth user can view own intent status
subscriptionRoute.get('/intents/:intentId/status', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const db = c.get('db');
    const intentId = c.req.param('intentId');
    const rows = await db.select().from(paymentIntents).where(
        and(eq(paymentIntents.id, intentId), eq(paymentIntents.userId, authUser.uid))
    ).limit(1);

    const intent = rows[0];
    if (!intent) return c.json({ ok: false, message: 'Intent not found.' }, 404);

    return c.json({
        ok: true,
        intentId: intent.id,
        status: intent.status,
        provider: intent.provider,
    });
});

// POST /webhook - Payment Webhook
subscriptionRoute.post('/webhook', async (c) => {
    const provided = c.req.header('X-Webhook-Secret');
    const expected = c.env.PAYMENT_WEBHOOK_SECRET;

    if (expected && provided !== expected) return c.json({ ok: false, message: 'Invalid signature.' }, 401);

    try {
        const body = await c.req.json();
        const schema = z.object({
            intentId: z.string().min(1),
            status: z.enum(['pending', 'succeeded', 'failed', 'canceled']),
            providerReference: z.string().nullable().optional(),
            failureReason: z.string().nullable().optional(),
        });
        const payload = schema.parse(body);
        const db = c.get('db');

        const rows = await db.select().from(paymentIntents).where(eq(paymentIntents.id, payload.intentId)).limit(1);
        const intent = rows[0];
        if (!intent) return c.json({ ok: false, message: 'Intent not found.' }, 404);

        const now = new Date();

        if (intent.status === 'succeeded' && payload.status === 'succeeded') {
            return c.json({ ok: true, message: 'Already processed.' });
        }

        await withTransaction(db, async (tx) => {
            await tx.update(paymentIntents)
                .set({
                    status: payload.status,
                    providerReference: payload.providerReference ?? null,
                    failureReason: payload.failureReason ?? null,
                    updatedAt: now,
                })
                .where(eq(paymentIntents.id, payload.intentId));

            if (payload.status === 'succeeded') {
                const startsAt = now;
                const endsAt = new Date(now);
                endsAt.setMonth(endsAt.getMonth() + 1);

                // Activate Subscription
                await tx.update(users).set({
                    subscriptionStatus: 'active',
                    subscriptionPlanId: intent.planId,
                    subscriptionPlanName: intent.planName,
                    subscriptionAmountMonthly: intent.amount,
                    subscriptionCurrency: intent.currency,
                    subscriptionStartsAt: startsAt,
                    subscriptionEndsAt: endsAt,
                    updatedAt: now,
                }).where(eq(users.uid, intent.userId));

                // Record Analytics
                await tx.insert(analyticsEvents).values({
                    id: nanoid(),
                    userId: intent.userId,
                    eventType: 'payment_success',
                    source: 'payment_webhook',
                    planId: intent.planId,
                    value: intent.amount,
                    currency: intent.currency,
                    metadata: { provider: intent.provider, intentId: intent.id },
                    createdAt: now,
                });
            }
        });

        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: 'Webhook failed' }, 400);
    }
});

export default subscriptionRoute;
