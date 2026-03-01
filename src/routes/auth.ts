import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { verifyGoogleIdentityToken } from '../auth/google';
import { signSessionToken } from '../auth/tokens';
import { toUserProfile } from '../auth/userProfile';
import { businesses, subscriptions, users } from '../db/schema';
import { DEFAULT_PLAN_SEEDS, FREE_PLAN_ID } from '../constants/defaultPlans';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { ensurePrimaryBusiness, getAccessibleBusiness, getActiveSubscription, getRequestedBusinessId, updateUserBasics } from './helpers';

const authRoute = new Hono<AppEnv>();

const googleSignInSchema = z.object({
    idToken: z.string().min(20),
});

const updateProfileSchema = z.object({
    displayName: z.string().trim().min(1).optional().nullable(),
    email: z.string().email().optional().nullable(),
    phoneNumber: z.string().trim().optional().nullable(),
    businessName: z.string().trim().min(1).optional().nullable(),
    address: z.string().trim().optional().nullable(),
    gstNumber: z.string().trim().optional().nullable(),
    gstEnabled: z.boolean().optional(),
    currency: z.string().trim().min(3).max(3).optional(),
    category: z.string().trim().optional().nullable(),
    state: z.string().trim().optional().nullable(),
    legalName: z.string().trim().optional().nullable(),
});

const readJwtSecret = (env: AppEnv['Bindings']) => env.JWT_SECRET ?? env.API_JWT_SECRET;

const ensureFreeSubscription = async (db: AppEnv['Variables']['db'], businessId: string) => {
    const existing = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.businessId, businessId))
        .limit(1);

    if (existing[0]) {
        return existing[0];
    }

    const now = new Date();
    const freePlan = DEFAULT_PLAN_SEEDS.find((entry) => entry.id === FREE_PLAN_ID);

    const subscriptionId = `sub_${nanoid(18)}`;
    await db.insert(subscriptions).values({
        id: subscriptionId,
        businessId,
        tier: freePlan?.tier ?? 'FREE',
        billingCycle: freePlan?.billingCycle ?? null,
        status: 'TRIAL',
        startDate: now,
        endDate: null,
        nextRenewalDate: null,
        graceEndDate: null,
        maxBillsTotal: freePlan?.maxBillsTotal ?? 50,
        maxBillsPerMonth: freePlan?.maxBillsPerMonth ?? 50,
        maxStaffUsers: freePlan?.maxStaffUsers ?? 0,
        maxBusinesses: freePlan?.maxBusinesses ?? 1,
        maxDevices: freePlan?.maxDevices ?? 1,
        maxStorageMb: freePlan?.maxStorageMb ?? 50,
        offlineOnly: freePlan?.offlineOnly ?? true,
        cloudSyncAllowed: freePlan?.cloudSyncAllowed ?? false,
        webDashboardAllowed: freePlan?.webDashboardAllowed ?? false,
        featureFlagsEnabled: freePlan?.enabledFeatures ?? [],
        createdAt: now,
        updatedAt: now,
    });

    const inserted = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);

    return inserted[0] ?? null;
};

authRoute.post('/google', async (c) => {
    try {
        const db = c.get('db');
        const payload = googleSignInSchema.parse(await c.req.json());

        const googleUser = await verifyGoogleIdentityToken(payload.idToken, c.env);

        const existing = await db
            .select()
            .from(users)
            .where(eq(users.googleSub, googleUser.sub))
            .limit(1);

        const now = new Date();
        const userId = existing[0]?.id ?? `usr_${nanoid(18)}`;
        const name = googleUser.name?.trim() || existing[0]?.name || googleUser.email?.split('@')[0] || 'Vahi User';
        const email = googleUser.email?.trim().toLowerCase() || existing[0]?.email;

        if (!email) {
            return c.json({ ok: false, message: 'Google account email is required.' }, 400);
        }

        if (existing[0]) {
            await db.update(users).set({
                name,
                email,
                photoUrl: googleUser.picture ?? existing[0].photoUrl,
                updatedAt: now,
            }).where(eq(users.id, existing[0].id));
        } else {
            await db.insert(users).values({
                id: userId,
                googleSub: googleUser.sub,
                name,
                email,
                phone: null,
                photoUrl: googleUser.picture ?? null,
                metadata: {},
                isDisabled: false,
                createdAt: now,
                updatedAt: now,
            });
        }

        const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const user = userRows[0];
        if (!user) {
            return c.json({ ok: false, message: 'Unable to create user session.' }, 500);
        }

        const business = await ensurePrimaryBusiness(db, user, {
            name: name.includes(' ') ? `${name.split(' ')[0]} Business` : `${name} Business`,
            email: user.email,
            phone: user.phone,
            currency: 'INR',
        });

        const subscription = await ensureFreeSubscription(db, business.id);
        const token = signSessionToken(
            { sub: user.id, email: user.email },
            readJwtSecret(c.env)
        );

        return c.json({
            ok: true,
            token,
            user: toUserProfile(user, business, subscription, 'owner'),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Google sign-in failed.';
        return c.json({ ok: false, message }, 400);
    }
});

authRoute.post('/firebase', async (c) => {
    return c.json({ ok: false, message: 'Phone OTP sign-in is disabled. Use Google login.' }, 400);
});

authRoute.get('/me', requireAuth, async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');

    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    const subscription = business ? await getActiveSubscription(db, business.id) : null;
    const organizationRole = c.get('organizationRole');
    const role = organizationRole === 'owner' || organizationRole === null ? 'owner' : 'staff';

    return c.json({ ok: true, user: toUserProfile(authUser, business, subscription, role) });
});

authRoute.patch('/me', requireAuth, async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) {
            return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        }

        const payload = updateProfileSchema.parse(await c.req.json());

        const updatedUser = await updateUserBasics(db, authUser.id, {
            name: payload.displayName ?? undefined,
            email: payload.email?.toLowerCase() ?? undefined,
            phone: payload.phoneNumber ?? undefined,
        });

        const business = await ensurePrimaryBusiness(db, updatedUser ?? authUser);
        const patch: Partial<typeof businesses.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (payload.businessName !== undefined) patch.name = payload.businessName ?? business.name;
        if (payload.legalName !== undefined) patch.legalName = payload.legalName ?? null;
        if (payload.address !== undefined) patch.address = payload.address ?? null;
        if (payload.state !== undefined) patch.state = payload.state ?? null;
        if (payload.gstEnabled !== undefined) {
            patch.gstin = payload.gstEnabled ? (payload.gstNumber?.toUpperCase() ?? business.gstin) : null;
        } else if (payload.gstNumber !== undefined) {
            patch.gstin = payload.gstNumber?.toUpperCase() ?? null;
        }
        if (payload.currency !== undefined) patch.currency = payload.currency.toUpperCase();
        if (payload.category !== undefined) patch.category = payload.category ?? null;

        await db.update(businesses).set(patch).where(and(
            eq(businesses.id, business.id),
            eq(businesses.ownerUserId, authUser.id),
        ));

        const refreshedBusiness = await db.select().from(businesses).where(eq(businesses.id, business.id)).limit(1);
        const subscription = await getActiveSubscription(db, business.id);
        const organizationRole = c.get('organizationRole');
        const role = organizationRole === 'owner' || organizationRole === null ? 'owner' : 'staff';

        return c.json({
            ok: true,
            user: toUserProfile(updatedUser ?? authUser, refreshedBusiness[0] ?? business, subscription, role),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Profile update failed.';
        return c.json({ ok: false, message }, 400);
    }
});

authRoute.post('/logout', requireAuth, async (c) => {
    return c.json({ ok: true });
});

export default authRoute;
