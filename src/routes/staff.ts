import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';
import { staffInvites, users } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';

const staffRoute = new Hono<AppEnv>();
const normalizePhoneNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return `+${digits}`;
};

// POST /staff - Invite Staff
staffRoute.post('/', requireAuth, async (c) => {
    try {
        const authUser = c.get('authUser');
        const db = c.get('db');

        // Owners and admins can manage their team.
        if (!authUser || !['owner', 'admin'].includes(authUser.role || '')) {
            return c.json({ ok: false, message: 'Only owners/admins can invite staff.' }, 403);
        }

        const body = await c.req.json();
        const schema = z.object({ phoneNumber: z.string().min(10) });
        const payload = schema.parse(body);
        const normalizedPhone = normalizePhoneNumber(payload.phoneNumber);
        if (!normalizedPhone || normalizedPhone.length < 8) {
            return c.json({ ok: false, message: 'Invalid phone number.' }, 400);
        }

        const code = nanoid(8); // Simple invite code
        const id = nanoid();

        await db.insert(staffInvites).values({
            id,
            ownerId: authUser.uid,
            phoneNumber: normalizedPhone,
            code,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            createdAt: new Date(),
        });

        // In real app, send SMS with code/link
        return c.json({ ok: true, inviteId: id, code });
    } catch (error: unknown) {
        return c.json({ ok: false, message: 'Invite failed' }, 400);
    }
});

// GET /staff - List Staff
staffRoute.get('/', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    const db = c.get('db');

    if (!authUser || !['owner', 'admin'].includes(authUser.role || '')) {
        return c.json({ ok: false, message: 'Only owners/admins can view staff.' }, 403);
    }

    // Get users who have ownerId = authUser.uid
    const staffMembers = await db.select().from(users).where(eq(users.ownerId, authUser.uid));
    const pendingInvites = await db.select().from(staffInvites).where(and(eq(staffInvites.ownerId, authUser.uid), eq(staffInvites.status, 'pending')));

    return c.json({ ok: true, staff: staffMembers, invites: pendingInvites });
});

// GET /staff/:uid - Staff member details under owner/admin
staffRoute.get('/:uid', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    if (!authUser || !['owner', 'admin'].includes(authUser.role || '')) {
        return c.json({ ok: false, message: 'Only owners/admins can view staff.' }, 403);
    }

    const db = c.get('db');
    const uid = c.req.param('uid');
    const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.uid, uid), eq(users.ownerId, authUser.uid)))
        .limit(1);

    if (!rows[0]) return c.json({ ok: false, message: 'Staff member not found.' }, 404);
    return c.json({ ok: true, staff: rows[0] });
});

// PATCH /staff/:uid - Update staff relation/role under owner
staffRoute.patch('/:uid', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    if (!authUser || !['owner', 'admin'].includes(authUser.role || '')) {
        return c.json({ ok: false, message: 'Only owners/admins can manage staff.' }, 403);
    }

    const db = c.get('db');
    const uid = c.req.param('uid');
    const body = await c.req.json();
    const payload = z.object({
        role: z.enum(['staff', 'owner']).optional(),
        ownerId: z.string().nullable().optional(),
    }).parse(body);

    const nextRole = payload.role ?? 'staff';
    const nextOwnerId = nextRole === 'owner' ? null : (payload.ownerId ?? authUser.uid);

    const updated = await db
        .update(users)
        .set({
            role: nextRole,
            ownerId: nextOwnerId,
            updatedAt: new Date(),
        })
        .where(and(eq(users.uid, uid), eq(users.ownerId, authUser.uid)))
        .returning({ uid: users.uid });

    if (!updated[0]) return c.json({ ok: false, message: 'Staff member not found.' }, 404);
    return c.json({ ok: true });
});

// DELETE /staff/invite/:id - Cancel pending invite
staffRoute.delete('/invite/:id', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    if (!authUser || !['owner', 'admin'].includes(authUser.role || '')) {
        return c.json({ ok: false, message: 'Only owners/admins can manage invites.' }, 403);
    }

    const db = c.get('db');
    const id = c.req.param('id');

    const deleted = await db
        .delete(staffInvites)
        .where(and(eq(staffInvites.id, id), eq(staffInvites.ownerId, authUser.uid)))
        .returning({ id: staffInvites.id });

    if (!deleted[0]) return c.json({ ok: false, message: 'Invite not found.' }, 404);
    return c.json({ ok: true });
});

// DELETE /staff/:uid - Remove staff access from this owner
staffRoute.delete('/:uid', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    if (!authUser || !['owner', 'admin'].includes(authUser.role || '')) {
        return c.json({ ok: false, message: 'Only owners/admins can remove staff.' }, 403);
    }

    const db = c.get('db');
    const uid = c.req.param('uid');
    const updated = await db
        .update(users)
        .set({
            role: 'owner',
            ownerId: null,
            updatedAt: new Date(),
        })
        .where(and(eq(users.uid, uid), eq(users.ownerId, authUser.uid)))
        .returning({ uid: users.uid });

    if (!updated[0]) return c.json({ ok: false, message: 'Staff member not found.' }, 404);
    return c.json({ ok: true });
});

export default staffRoute;
