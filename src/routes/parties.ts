import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { parties } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { requireFeatureToggle, requirePermission, withOrganizationContext } from '../middleware/permissions';

const partiesRoute = new Hono<AppEnv>();

const partySchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    type: z.enum(['customer', 'supplier']),
    phone: z.string().optional().nullable(),
    email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
    address: z.string().optional().nullable(),
    gstNumber: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
});

// GET /parties - List parties
partiesRoute.get('/', requireAuth, withOrganizationContext, requirePermission('can_manage_parties'), requireFeatureToggle('parties'), async (c) => {
    const effectiveUserId = c.get('organizationOwnerId');
    const organizationId = c.get('organizationId');
    const db = c.get('db');
    const queryText = c.req.query('q')?.trim();
    const type = c.req.query('type') as 'customer' | 'supplier' | undefined;
    const limit = Math.min(Number(c.req.query('limit') || 100), 500);

    if (!effectiveUserId || !organizationId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

    const conditions = [
        eq(parties.userId, effectiveUserId),
        eq(parties.organizationId, organizationId),
    ];

    if (type) {
        conditions.push(eq(parties.type, type));
    }

    if (queryText) {
        const normalized = queryText.toLowerCase();
        const searchCondition = or(
            sql`${parties.nameLowercase} like ${`%${normalized}%`}`,
            sql`coalesce(${parties.phone}, '') like ${`%${queryText}%`}`
        );
        if (searchCondition) conditions.push(searchCondition);
    }

    const data = await db
        .select()
        .from(parties)
        .where(and(...conditions))
        .orderBy(asc(parties.nameLowercase))
        .limit(limit);

    return c.json({ ok: true, parties: data });
});

// POST /parties - Create party
partiesRoute.post('/', requireAuth, withOrganizationContext, requirePermission('can_manage_parties'), requireFeatureToggle('parties'), async (c) => {
    try {
        const effectiveUserId = c.get('organizationOwnerId');
        const organizationId = c.get('organizationId');
        const db = c.get('db');
        const body = await c.req.json();

        if (!effectiveUserId || !organizationId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

        const payload = partySchema.parse(body);
        const id = payload.id ?? nanoid();
        const now = new Date();

        const insertPayload = {
            id,
            userId: effectiveUserId,
            organizationId,
            name: payload.name.trim(),
            nameLowercase: payload.name.trim().toLowerCase(),
            type: payload.type,
            phone: payload.phone?.trim() || null,
            email: payload.email?.trim() || null,
            address: payload.address?.trim() || null,
            gstNumber: payload.gstNumber?.trim() || null,
            isActive: payload.isActive,
            createdAt: now,
            updatedAt: now,
        };

        await db.insert(parties).values(insertPayload).onConflictDoUpdate({
            target: parties.id,
            set: { ...insertPayload, createdAt: sql`parties."createdAt"` } // Preserve original createdAt
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Invalid request.' }, 400);
    }
});

// PATCH /parties/:id - Update party
partiesRoute.patch('/:id', requireAuth, withOrganizationContext, requirePermission('can_manage_parties'), requireFeatureToggle('parties'), async (c) => {
    try {
        const effectiveUserId = c.get('organizationOwnerId');
        const organizationId = c.get('organizationId');
        const db = c.get('db');
        const id = c.req.param('id');
        const body = await c.req.json();

        if (!effectiveUserId || !organizationId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

        const updateSchema = partySchema.partial();
        const payload = updateSchema.parse(body);

        const updatePayload: Partial<typeof parties.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (payload.name !== undefined) {
            updatePayload.name = payload.name.trim();
            updatePayload.nameLowercase = payload.name.trim().toLowerCase();
        }
        if (payload.phone !== undefined) updatePayload.phone = payload.phone;
        if (payload.email !== undefined) updatePayload.email = payload.email;
        if (payload.address !== undefined) updatePayload.address = payload.address;
        if (payload.gstNumber !== undefined) updatePayload.gstNumber = payload.gstNumber;
        if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

        const updated = await db
            .update(parties)
            .set(updatePayload)
            .where(and(
                eq(parties.id, id),
                eq(parties.userId, effectiveUserId),
                eq(parties.organizationId, organizationId),
            ))
            .returning({ id: parties.id });

        if (!updated[0]) {
            return c.json({ ok: false, message: 'Party not found.' }, 404);
        }

        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Invalid request.' }, 400);
    }
});

export default partiesRoute;
