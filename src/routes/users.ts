import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { toUserProfile } from '../auth/userProfile';
import { businesses, devices } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { ensurePrimaryBusiness, getAccessibleBusiness, getActiveSubscription, getRequestedBusinessId, updateUserBasics } from './helpers';
import {
    assertDeviceRegistrationAllowed,
    assertSubscriptionWriteAllowed,
} from '../services/subscriptionPolicy';

const usersRoute = new Hono<AppEnv>();

const updateUserSchema = z.object({
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

const linkPhoneSchema = z.object({
    verificationId: z.string().optional(),
    verificationCode: z.string().optional(),
    phoneNumber: z.string().trim().optional(),
});

const registerDeviceSchema = z.object({
    platform: z.enum(['ANDROID', 'IOS', 'WEB']),
    deviceInfo: z.record(z.string(), z.unknown()).optional(),
});

usersRoute.get('/me', requireAuth, async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');

    if (!authUser) {
        return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    const subscription = business ? await getActiveSubscription(db, business.id) : null;

    return c.json({ ok: true, user: toUserProfile(authUser, business, subscription, 'owner') });
});

usersRoute.patch('/me', requireAuth, async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');

        if (!authUser) {
            return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        }

        const payload = updateUserSchema.parse(await c.req.json());
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

        return c.json({
            ok: true,
            user: toUserProfile(updatedUser ?? authUser, refreshedBusiness[0] ?? business, subscription, 'owner'),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Profile update failed.';
        return c.json({ ok: false, message }, 400);
    }
});

usersRoute.post('/me/phone/link', requireAuth, async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) {
            return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        }

        const payload = linkPhoneSchema.parse(await c.req.json());
        const nextPhone = payload.phoneNumber?.trim();

        const updatedUser = nextPhone
            ? await updateUserBasics(db, authUser.id, { phone: nextPhone })
            : authUser;

        const business = await ensurePrimaryBusiness(db, updatedUser ?? authUser);
        const subscription = await getActiveSubscription(db, business.id);

        return c.json({
            ok: true,
            user: toUserProfile(updatedUser ?? authUser, business, subscription, 'owner'),
            message: nextPhone ? 'Phone linked successfully.' : 'Phone link accepted.',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Phone link failed.';
        return c.json({ ok: false, message }, 400);
    }
});

usersRoute.post('/me/devices/register', requireAuth, async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) {
            return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        }

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        await assertDeviceRegistrationAllowed(db, business.id, subscription);

        const payload = registerDeviceSchema.parse(await c.req.json());
        const now = new Date();
        const id = `dev_${nanoid(18)}`;

        await db.insert(devices).values({
            id,
            businessId: business.id,
            userId: authUser.id,
            platform: payload.platform,
            deviceInfo: payload.deviceInfo ?? {},
            lastSeenAt: now,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Device registration failed.';
        return c.json({ ok: false, message }, 400);
    }
});

export default usersRoute;
