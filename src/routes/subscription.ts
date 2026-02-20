import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, desc, eq, lte, or, sql } from 'drizzle-orm';
import { plans, offers, paymentIntents, analyticsEvents, users } from '../db/schema';
import { withTransaction } from '../db/transaction';
import { requireAuth, requireAdmin, optionalAuth, type AppEnv } from '../middleware/auth';
import { DEFAULT_PLANS } from '../constants/defaultPlans';

const subscriptionRoute = new Hono<AppEnv>();
let defaultPlansSeeded = false;

const parseBoolean = (value: string | undefined, fallback = false) => {
    if (value === undefined) return fallback;
    return value.toLowerCase() === 'true';
};

const asFallbackPlanRows = () => {
    const now = new Date();
    return DEFAULT_PLANS.map((entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        monthlyPrice: entry.monthlyPrice,
        currency: entry.currency,
        isActive: entry.isActive,
        displayOrder: entry.displayOrder,
        features: entry.features,
        createdAt: now,
        updatedAt: now,
    }));
};

const ensureDefaultPlans = async (db: AppEnv['Variables']['db']) => {
    if (defaultPlansSeeded) return;

    const now = new Date();
    for (const entry of DEFAULT_PLANS) {
        await db.insert(plans).values({
            ...entry,
            createdAt: now,
            updatedAt: now,
        }).onConflictDoUpdate({
            target: plans.id,
            set: {
                name: entry.name,
                description: entry.description,
                monthlyPrice: entry.monthlyPrice,
                currency: entry.currency,
                isActive: entry.isActive,
                displayOrder: entry.displayOrder,
                features: entry.features,
                updatedAt: now,
            },
        });
    }

    defaultPlansSeeded = true;
};

// GET /plans - List Plans
subscriptionRoute.get('/plans', optionalAuth, async (c) => {
    const db = c.get('db');
    const includeInactive = parseBoolean(c.req.query('includeInactive'), false);
    const authUser = c.get('authUser');

    if (includeInactive && authUser?.role !== 'admin') {
        return c.json({ ok: false, message: 'Admin access required.' }, 403);
    }

    try {
        await ensureDefaultPlans(db);

        const data = await db
            .select()
            .from(plans)
            .where(includeInactive ? sql`true` : eq(plans.isActive, true))
            .orderBy(asc(plans.displayOrder));

        return c.json({ ok: true, plans: data });
    } catch (error) {
        console.error('Failed to load plans from database. Falling back to static defaults.', error);
        const fallback = includeInactive ? asFallbackPlanRows() : asFallbackPlanRows().filter((entry) => entry.isActive);
        return c.json({ ok: true, plans: fallback });
    }
});

// GET /offers/active - List Active Offers
subscriptionRoute.get('/offers/active', optionalAuth, async (c) => {
    const authUser = c.get('authUser');
    const db = c.get('db');
    const now = new Date();

    try {
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
    } catch (error) {
        console.error('Failed to load offers from database. Returning empty list.', error);
        return c.json({ ok: true, offers: [] });
    }
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

        let providerReference = null;
        if (provider === 'razorpay') {
            const keyId = c.env.RAZORPAY_KEY_ID;
            const keySecret = c.env.RAZORPAY_KEY_SECRET;
            if (keyId && keySecret) {
                const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`
                    },
                    body: JSON.stringify({
                        amount: Math.round(payload.amount * 100),
                        currency: payload.currency.toUpperCase(),
                        receipt: intentId,
                    })
                });

                if (rzpRes.ok) {
                    const rzpBody = await rzpRes.json() as { id: string };
                    providerReference = rzpBody.id;
                } else {
                    console.error('Razorpay order creation failed:', await rzpRes.text());
                }
            }
        }

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
            providerReference,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({
            ok: true,
            intentId,
            checkoutUrl,
            provider,
            providerOrderId: providerReference,
            razorpayKeyId: provider === 'razorpay' ? c.env.RAZORPAY_KEY_ID : undefined
        });
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

// Helper to verify Razorpay signature using Web Crypto API
async function verifyRazorpaySignature(body: string, signature: string, secret: string) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return signatureHex === signature;
}

// POST /razorpay/webhook - Razorpay Webhook
subscriptionRoute.post('/razorpay/webhook', async (c) => {
    const secret = c.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return c.json({ ok: false, message: 'Webhook not configured.' }, 500);

    const signature = c.req.header('x-razorpay-signature');
    if (!signature) return c.json({ ok: false, message: 'Missing signature.' }, 401);

    const rawBody = await c.req.text();
    const isValid = await verifyRazorpaySignature(rawBody, signature, secret);

    if (!isValid) return c.json({ ok: false, message: 'Invalid signature.' }, 401);

    try {
        const payload = JSON.parse(rawBody);

        // Razorpay sends payment.captured or order.paid
        if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
            const paymentEntity = payload.payload.payment?.entity;
            const orderId = paymentEntity?.order_id || payload.payload.order?.entity?.id;

            if (!orderId) {
                return c.json({ ok: true, message: 'No order ID found.' });
            }

            const db = c.get('db');
            const rows = await db.select().from(paymentIntents).where(eq(paymentIntents.providerReference, orderId)).limit(1);
            const intent = rows[0];
            if (!intent) return c.json({ ok: false, message: 'Intent not found.' }, 404);

            if (intent.status === 'succeeded') return c.json({ ok: true, message: 'Already processed.' });

            const now = new Date();
            await withTransaction(db, async (tx) => {
                await tx.update(paymentIntents)
                    .set({
                        status: 'succeeded',
                        providerReference: orderId,
                        updatedAt: now,
                    })
                    .where(eq(paymentIntents.id, intent.id));

                const startsAt = now;
                const endsAt = new Date(now);
                endsAt.setMonth(endsAt.getMonth() + 1);

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

                await tx.insert(analyticsEvents).values({
                    id: nanoid(),
                    userId: intent.userId,
                    eventType: 'payment_success',
                    source: 'razorpay_webhook',
                    planId: intent.planId,
                    value: intent.amount,
                    currency: intent.currency,
                    metadata: { provider: 'razorpay', intentId: intent.id, orderId },
                    createdAt: now,
                });
            });
        }
        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: 'Webhook processing failed' }, 400);
    }
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
