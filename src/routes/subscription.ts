import { Hono } from 'hono';
import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { DEFAULT_PLAN_SEEDS } from '../constants/defaultPlans';
import { discounts, offers, paymentIntents, plans, subscriptions } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    ensurePrimaryBusiness,
    getActiveSubscription,
    getAccessibleBusiness,
    getRequestedBusinessId,
    requireOrganizationAction,
} from './helpers';

const subscriptionRoute = new Hono<AppEnv>();

const checkoutSchema = z.object({
    planId: z.string().min(2),
    planName: z.string().optional(),
    amount: z.number().nonnegative().optional(),
    currency: z.string().trim().optional(),
    discountCode: z.string().trim().optional(),
});

const webhookSchema = z.object({
    intentId: z.string().min(6),
    status: z.enum(['pending', 'succeeded', 'failed', 'canceled']),
    providerReference: z.string().optional(),
    failureReason: z.string().optional(),
});

const validateDiscountSchema = z.object({
    code: z.string().trim().min(2),
    planId: z.string().trim().optional(),
});

const ensurePlansSeeded = async (db: AppEnv['Variables']['db']) => {
    const existing = await db.select({ id: plans.id }).from(plans).limit(1);
    if (existing[0]) return;

    const now = new Date();
    await db.insert(plans).values(DEFAULT_PLAN_SEEDS.map((entry) => ({
        ...entry,
        createdAt: now,
        updatedAt: now,
    })));
};

const toMonthlyAmount = (pricePerCycle: number, cycle: typeof plans.$inferSelect['billingCycle']) => {
    if (cycle === 'YEARLY') return pricePerCycle / 12;
    if (cycle === 'THREE_YEAR') return pricePerCycle / 36;
    return pricePerCycle;
};

const toClientPlan = (plan: typeof plans.$inferSelect) => ({
    id: plan.id,
    name: plan.displayName,
    description: plan.description,
    monthlyPrice: Number(toMonthlyAmount(Number(plan.pricePerCycle), plan.billingCycle)),
    currency: plan.currency,
    isActive: plan.isVisible,
    displayOrder: plan.displayOrder,
    features: plan.enabledFeatures,
    tier: plan.tier,
    billingCycle: plan.billingCycle,
    pricePerCycle: plan.pricePerCycle,
    effectiveDiscountVsMonthlyPercent: plan.effectiveDiscountVsMonthlyPercent,
    restrictions: {
        maxBillsTotal: plan.maxBillsTotal,
        maxBillsPerMonth: plan.maxBillsPerMonth,
        maxStaffUsers: plan.maxStaffUsers,
        maxBusinesses: plan.maxBusinesses,
        maxDevices: plan.maxDevices,
        maxStorageMb: plan.maxStorageMb,
        offlineOnly: plan.offlineOnly,
        cloudSyncAllowed: plan.cloudSyncAllowed,
        webDashboardAllowed: plan.webDashboardAllowed,
    },
    enabledFeatures: plan.enabledFeatures,
    disabledFeatures: plan.disabledFeatures,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
});

const toClientSubscription = (subscription: typeof subscriptions.$inferSelect) => ({
    id: subscription.id,
    businessId: subscription.businessId,
    tier: subscription.tier,
    billingCycle: subscription.billingCycle,
    status: subscription.status,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    nextRenewalDate: subscription.nextRenewalDate,
    renewsAt: subscription.nextRenewalDate,
    graceEndDate: subscription.graceEndDate,
    maxBillsTotal: subscription.maxBillsTotal,
    maxBillsPerMonth: subscription.maxBillsPerMonth,
    maxStaffUsers: subscription.maxStaffUsers,
    maxBusinesses: subscription.maxBusinesses,
    maxDevices: subscription.maxDevices,
    maxStorageMb: subscription.maxStorageMb,
    monthlyInvoiceCount: 0,
    offlineOnly: subscription.offlineOnly,
    cloudSyncAllowed: subscription.cloudSyncAllowed,
    webDashboardAllowed: subscription.webDashboardAllowed,
    featureFlagsEnabled: subscription.featureFlagsEnabled,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
});

subscriptionRoute.get('/plans', async (c) => {
    const db = c.get('db');
    await ensurePlansSeeded(db);

    const includeInactive = c.req.query('includeInactive') === 'true';
    const rows = includeInactive
        ? await db.select().from(plans).orderBy(asc(plans.displayOrder))
        : await db.select().from(plans).where(eq(plans.isVisible, true)).orderBy(asc(plans.displayOrder));

    return c.json({ ok: true, plans: rows.map(toClientPlan) });
});

subscriptionRoute.get('/current', requireAuth, async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const subscription = await getActiveSubscription(db, business.id);

    return c.json({
        ok: true,
        businessId: business.id,
        subscription: subscription ? toClientSubscription(subscription) : null,
    });
});

subscriptionRoute.get('/offers/active', async (c) => {
    const db = c.get('db');
    const now = new Date();

    const rows = await db
        .select()
        .from(offers)
        .where(and(
            eq(offers.isActive, true),
            or(isNull(offers.startsAt), lte(offers.startsAt, now)),
            or(isNull(offers.endsAt), gte(offers.endsAt, now)),
        ))
        .orderBy(asc(offers.priority));

    return c.json({
        ok: true,
        offers: rows.map((entry) => ({
            id: entry.id,
            title: entry.title,
            message: entry.message,
            bannerUrl: entry.bannerUrl,
            bannerBackground: entry.bannerBackground,
            ctaText: entry.ctaText,
            ctaRoute: entry.ctaRoute,
            audience: entry.audience,
            isActive: entry.isActive,
            priority: entry.priority,
            startsAt: entry.startsAt,
            endsAt: entry.endsAt,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        })),
    });
});

subscriptionRoute.get('/discounts/active', async (c) => {
    const db = c.get('db');
    const now = new Date();

    const rows = await db
        .select()
        .from(discounts)
        .where(and(
            eq(discounts.isActive, true),
            or(isNull(discounts.validFrom), lte(discounts.validFrom, now)),
            or(isNull(discounts.validTo), gte(discounts.validTo, now)),
        ))
        .orderBy(asc(discounts.code));

    return c.json({
        ok: true,
        discounts: rows.map((entry) => ({
            id: entry.id,
            code: entry.code,
            type: entry.type,
            scope: entry.scope,
            value: entry.value,
            maxRedemptions: entry.maxRedemptions,
            perUserLimit: entry.perUserLimit,
            validFrom: entry.validFrom,
            validTo: entry.validTo,
            applicableTiers: entry.applicableTiers,
            applicableBillingCycles: entry.applicableBillingCycles,
            isActive: entry.isActive,
            redemptionCount: entry.redemptionCount,
        })),
    });
});

subscriptionRoute.post('/discounts/validate', requireAuth, async (c) => {
    try {
        const db = c.get('db');
        const payload = validateDiscountSchema.parse(await c.req.json());
        const code = payload.code.toUpperCase();
        const now = new Date();

        const rows = await db.select().from(discounts).where(eq(discounts.code, code)).limit(1);
        const discount = rows[0];
        if (!discount) return c.json({ ok: false, message: 'Invalid discount code.' }, 404);
        if (!discount.isActive) return c.json({ ok: false, message: 'Discount code is inactive.' }, 400);
        if (discount.validFrom && discount.validFrom > now) {
            return c.json({ ok: false, message: 'Discount not started yet.' }, 400);
        }
        if (discount.validTo && discount.validTo < now) {
            return c.json({ ok: false, message: 'Discount has expired.' }, 400);
        }
        if (discount.maxRedemptions !== null && Number(discount.redemptionCount ?? 0) >= discount.maxRedemptions) {
            return c.json({ ok: false, message: 'Discount redemption limit reached.' }, 400);
        }

        let plan = null;
        if (payload.planId) {
            const planRows = await db.select().from(plans).where(eq(plans.id, payload.planId)).limit(1);
            plan = planRows[0] ?? null;
            if (!plan) return c.json({ ok: false, message: 'Plan not found for discount validation.' }, 404);

            if (discount.applicableTiers.length > 0 && !discount.applicableTiers.includes(plan.tier)) {
                return c.json({ ok: false, message: 'Discount is not applicable to selected plan tier.' }, 400);
            }
            if (
                plan.billingCycle
                && discount.applicableBillingCycles.length > 0
                && !discount.applicableBillingCycles.includes(plan.billingCycle)
            ) {
                return c.json({ ok: false, message: 'Discount is not applicable to selected billing cycle.' }, 400);
            }
        }

        return c.json({
            ok: true,
            discount: {
                id: discount.id,
                code: discount.code,
                type: discount.type,
                scope: discount.scope,
                value: discount.value,
            },
            plan: plan ? {
                id: plan.id,
                tier: plan.tier,
                billingCycle: plan.billingCycle,
                pricePerCycle: Number(plan.pricePerCycle),
            } : null,
        });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to validate discount.' }, 400);
    }
});

subscriptionRoute.post('/checkout', requireAuth, async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationAction(c, 'subscription.checkout');
        if (denied) return denied;

        await ensurePlansSeeded(db);
        const payload = checkoutSchema.parse(await c.req.json());

        const planRows = await db.select().from(plans).where(eq(plans.id, payload.planId)).limit(1);
        const plan = planRows[0];
        if (!plan || !plan.isVisible) {
            return c.json({ ok: false, message: 'Plan not found.' }, 404);
        }

        let finalAmount = Number(plan.pricePerCycle);
        let appliedDiscount: { id: string; code: string; type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: number } | null = null;
        if (payload.discountCode) {
            const now = new Date();
            const discountRows = await db
                .select()
                .from(discounts)
                .where(eq(discounts.code, payload.discountCode.trim().toUpperCase()))
                .limit(1);
            const discount = discountRows[0];

            if (
                discount
                && discount.isActive
                && (!discount.validFrom || discount.validFrom <= now)
                && (!discount.validTo || discount.validTo >= now)
                && (discount.maxRedemptions === null || Number(discount.redemptionCount ?? 0) < discount.maxRedemptions)
                && (discount.applicableTiers.length === 0 || discount.applicableTiers.includes(plan.tier))
                && (plan.billingCycle ? (discount.applicableBillingCycles.length === 0 || discount.applicableBillingCycles.includes(plan.billingCycle)) : true)
            ) {
                if (discount.type === 'PERCENTAGE') {
                    finalAmount = Math.max(0, finalAmount - ((finalAmount * Number(discount.value)) / 100));
                } else {
                    finalAmount = Math.max(0, finalAmount - Number(discount.value));
                }
                appliedDiscount = {
                    id: discount.id,
                    code: discount.code,
                    type: discount.type,
                    value: Number(discount.value),
                };
            }
        }

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);

        const intentId = `pi_${nanoid(18)}`;
        const now = new Date();
        const checkoutUrl = `${c.req.url.split('/api')[0]}/checkout/${intentId}`;

        await db.insert(paymentIntents).values({
            id: intentId,
            businessId: business.id,
            planId: plan.id,
            planName: plan.displayName,
            amount: finalAmount,
            currency: plan.currency,
            provider: 'manual',
            status: 'pending',
            checkoutUrl,
            providerReference: appliedDiscount?.code ?? null,
            failureReason: null,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({
            ok: true,
            intentId,
            checkoutUrl,
            provider: 'manual',
            amount: finalAmount,
            appliedDiscount,
        });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Unable to create checkout session.' }, 400);
    }
});

subscriptionRoute.get('/intents/:intentId/status', requireAuth, async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const intentId = z.string().min(1).parse(c.req.param('intentId'));
    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);

    const rows = await db
        .select()
        .from(paymentIntents)
        .where(and(eq(paymentIntents.id, intentId), eq(paymentIntents.businessId, business.id)))
        .limit(1);

    const intent = rows[0];
    if (!intent) return c.json({ ok: false, message: 'Intent not found.' }, 404);

    return c.json({ ok: true, status: intent.status, provider: intent.provider });
});

subscriptionRoute.post('/webhook', async (c) => {
    try {
        const db = c.get('db');
        const payload = webhookSchema.parse(await c.req.json());

        const rows = await db.select().from(paymentIntents).where(eq(paymentIntents.id, payload.intentId)).limit(1);
        const intent = rows[0];
        if (!intent) {
            return c.json({ ok: false, message: 'Intent not found.' }, 404);
        }

        const now = new Date();
        await db.update(paymentIntents).set({
            status: payload.status,
            providerReference: payload.providerReference ?? intent.providerReference,
            failureReason: payload.failureReason ?? intent.failureReason,
            updatedAt: now,
        }).where(eq(paymentIntents.id, intent.id));

        if (payload.status === 'succeeded') {
            const planRows = await db.select().from(plans).where(eq(plans.id, intent.planId)).limit(1);
            const plan = planRows[0];

            if (plan) {
                const currentSubscriptionRows = await db.select().from(subscriptions)
                    .where(eq(subscriptions.businessId, intent.businessId))
                    .limit(1);
                const existing = currentSubscriptionRows[0];

                const nextEndDate = (() => {
                    const anchor = new Date();
                    if (plan.billingCycle === 'YEARLY') {
                        anchor.setFullYear(anchor.getFullYear() + 1);
                    } else if (plan.billingCycle === 'THREE_YEAR') {
                        anchor.setFullYear(anchor.getFullYear() + 3);
                    } else {
                        anchor.setMonth(anchor.getMonth() + 1);
                    }
                    return anchor;
                })();

                if (existing) {
                    await db.update(subscriptions).set({
                        tier: plan.tier,
                        billingCycle: plan.billingCycle,
                        status: 'ACTIVE',
                        startDate: now,
                        endDate: nextEndDate,
                        nextRenewalDate: nextEndDate,
                        graceEndDate: null,
                        maxBillsTotal: plan.maxBillsTotal,
                        maxBillsPerMonth: plan.maxBillsPerMonth,
                        maxStaffUsers: plan.maxStaffUsers,
                        maxBusinesses: plan.maxBusinesses,
                        maxDevices: plan.maxDevices,
                        maxStorageMb: plan.maxStorageMb,
                        offlineOnly: plan.offlineOnly,
                        cloudSyncAllowed: plan.cloudSyncAllowed,
                        webDashboardAllowed: plan.webDashboardAllowed,
                        featureFlagsEnabled: plan.enabledFeatures,
                        updatedAt: now,
                    }).where(eq(subscriptions.id, existing.id));
                } else {
                    await db.insert(subscriptions).values({
                        id: `sub_${nanoid(16)}`,
                        businessId: intent.businessId,
                        tier: plan.tier,
                        billingCycle: plan.billingCycle,
                        status: 'ACTIVE',
                        startDate: now,
                        endDate: nextEndDate,
                        nextRenewalDate: nextEndDate,
                        graceEndDate: null,
                        maxBillsTotal: plan.maxBillsTotal,
                        maxBillsPerMonth: plan.maxBillsPerMonth,
                        maxStaffUsers: plan.maxStaffUsers,
                        maxBusinesses: plan.maxBusinesses,
                        maxDevices: plan.maxDevices,
                        maxStorageMb: plan.maxStorageMb,
                        offlineOnly: plan.offlineOnly,
                        cloudSyncAllowed: plan.cloudSyncAllowed,
                        webDashboardAllowed: plan.webDashboardAllowed,
                        featureFlagsEnabled: plan.enabledFeatures,
                        createdAt: now,
                        updatedAt: now,
                    });
                }

                const currentIntentRows = await db.select().from(paymentIntents).where(eq(paymentIntents.id, payload.intentId)).limit(1);
                const currentIntent = currentIntentRows[0];
                if (currentIntent?.providerReference) {
                    const discountRows = await db.select().from(discounts).where(eq(discounts.code, currentIntent.providerReference)).limit(1);
                    const discount = discountRows[0];
                    if (discount) {
                        await db.update(discounts).set({
                            redemptionCount: Number(discount.redemptionCount ?? 0) + 1,
                            updatedAt: now,
                        }).where(eq(discounts.id, discount.id));
                    }
                }
            }
        }

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Webhook failed.' }, 400);
    }
});

export default subscriptionRoute;
