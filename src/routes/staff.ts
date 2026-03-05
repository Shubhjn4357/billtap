import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { businessMembers, staffInvites, users } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    ensurePrimaryBusiness,
    getAccessibleBusiness,
    getActiveSubscription,
    getRequestedBusinessId,
    requireOrganizationAction,
    requireOrganizationCapability,
} from './helpers';
import {
    assertModuleEnabled,
    assertStaffCreationAllowed,
    assertSubscriptionWriteAllowed,
} from '../services/subscriptionPolicy';
import { toApiErrorPayload } from '../services/apiError';

const staffRoute = new Hono<AppEnv>();

const inviteSchema = z.object({
    phoneNumber: z.string().trim().min(5),
    role: z.string().optional(),
});

const patchSchema = z.object({
    role: z.enum(['owner', 'staff']).optional(),
    ownerId: z.string().nullable().optional(),
}).passthrough();

staffRoute.use('/*', requireAuth);

staffRoute.get('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const denied = requireOrganizationCapability(c, 'staff.read');
    if (denied) return denied;
    assertModuleEnabled(business, 'staff');

    const [members, invites] = await Promise.all([
        db.select().from(businessMembers).where(and(eq(businessMembers.businessId, business.id), eq(businessMembers.isActive, true))),
        db.select().from(staffInvites).where(eq(staffInvites.businessId, business.id)),
    ]);

    const userIds = members.map((entry) => entry.userId);
    const memberUsers = userIds.length > 0
        ? await db.select().from(users).where(inArray(users.id, userIds))
        : [];
    const userById = new Map(memberUsers.map((entry) => [entry.id, entry]));

    return c.json({
        ok: true,
        staff: members.map((entry) => ({
            uid: entry.userId,
            displayName: userById.get(entry.userId)?.name,
            email: userById.get(entry.userId)?.email,
            phoneNumber: userById.get(entry.userId)?.phone,
            role: 'staff',
            ownerId: business.ownerUserId,
        })),
        invites: invites.map((entry) => ({
            id: entry.id,
            ownerId: entry.ownerUserId,
            organizationId: entry.businessId,
            phoneNumber: entry.phoneNumber,
            role: 'staff',
            status: entry.status,
            code: entry.code,
            expiresAt: entry.expiresAt,
            createdAt: entry.createdAt,
        })),
    });
});

staffRoute.post('/', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);
        const denied = requireOrganizationCapability(c, 'staff.write');
        if (denied) return denied;
        const deniedAction = requireOrganizationAction(c, 'staff.invite');
        if (deniedAction) return deniedAction;
        const subscription = await getActiveSubscription(db, business.id);
        assertModuleEnabled(business, 'staff');
        await assertStaffCreationAllowed(db, business.id, subscription);
        const payload = inviteSchema.parse(await c.req.json());
        const now = new Date();
        const id = `inv_${nanoid(16)}`;
        const code = nanoid(8).toUpperCase();
        const expiresAt = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

        await db.insert(staffInvites).values({
            id,
            businessId: business.id,
            ownerUserId: authUser.id,
            phoneNumber: payload.phoneNumber,
            role: 'STAFF',
            status: 'pending',
            code,
            expiresAt,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, inviteId: id, code });
    } catch (error) {
        const mapped = toApiErrorPayload(error, {
            code: 'STAFF_INVITE_CREATE_FAILED',
            message: 'Failed to create invite.',
            status: 400,
        });
        return c.json(
            { ok: false, message: mapped.error.message, error: mapped.error },
            mapped.status as 400 | 401 | 403 | 404 | 409 | 422 | 500
        );
    }
});

staffRoute.get('/:uid', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const denied = requireOrganizationCapability(c, 'staff.read');
    if (denied) return denied;
    assertModuleEnabled(business, 'staff');

    const uid = c.req.param('uid');
    const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (!rows[0]) return c.json({ ok: false, message: 'Staff not found.' }, 404);

    return c.json({
        ok: true,
        staff: {
            uid: rows[0].id,
            displayName: rows[0].name,
            email: rows[0].email,
            phoneNumber: rows[0].phone,
            role: 'staff',
        },
    });
});

staffRoute.patch('/:uid', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const denied = requireOrganizationCapability(c, 'staff.write');
    if (denied) return denied;
    const deniedAction = requireOrganizationAction(c, 'staff.remove');
    if (deniedAction) return deniedAction;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'staff');

    const payload = patchSchema.parse(await c.req.json());
    const uid = c.req.param('uid');
    const [member] = await db.select().from(businessMembers).where(and(
        eq(businessMembers.businessId, business.id),
        eq(businessMembers.userId, uid),
    )).limit(1);
    if (!member) return c.json({ ok: false, message: 'Staff member not found.' }, 404);

    await db.update(businessMembers).set({
        ...(payload.role ? { role: payload.role === 'owner' ? 'OWNER' : 'STAFF' } : {}),
        updatedAt: new Date(),
    }).where(eq(businessMembers.id, member.id));

    return c.json({ ok: true, id: member.id });
});

staffRoute.delete('/invite/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const denied = requireOrganizationCapability(c, 'staff.write');
    if (denied) return denied;
    const deniedAction = requireOrganizationAction(c, 'staff.remove');
    if (deniedAction) return deniedAction;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'staff');

    const id = c.req.param('id');
    await db.delete(staffInvites).where(and(eq(staffInvites.id, id), eq(staffInvites.businessId, business.id)));
    return c.json({ ok: true });
});

staffRoute.delete('/:uid', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const denied = requireOrganizationCapability(c, 'staff.write');
    if (denied) return denied;
    const deniedAction = requireOrganizationAction(c, 'staff.remove');
    if (deniedAction) return deniedAction;
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'staff');

    const uid = c.req.param('uid');
    await db.update(businessMembers).set({ isActive: false, updatedAt: new Date() }).where(and(
        eq(businessMembers.userId, uid),
        eq(businessMembers.businessId, business.id),
    ));
    return c.json({ ok: true });
});

export default staffRoute;
