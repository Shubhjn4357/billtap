import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { godowns, godownStock, stockTransfers, items } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { getAccessibleBusiness, getRequestedBusinessId } from './helpers';
import { nanoid } from 'nanoid';

const godownsRoute = new Hono<AppEnv>();

godownsRoute.use('/*', requireAuth);

// List godowns
godownsRoute.get('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

    const rows = await db.select().from(godowns)
        .where(and(eq(godowns.businessId, business.id), eq(godowns.isActive, true)))
        .orderBy(desc(godowns.isDefault), godowns.name);

    return c.json({ ok: true, data: rows });
});

// Create godown
godownsRoute.post('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

    try {
        const body = z.object({
            name: z.string().min(1).max(200),
            address: z.string().max(500).optional(),
            isDefault: z.boolean().optional().default(false),
        }).parse(await c.req.json());

        const now = new Date();
        if (body.isDefault) {
            await db.update(godowns).set({ isDefault: false, updatedAt: now })
                .where(and(eq(godowns.businessId, business.id), eq(godowns.isDefault, true)));
        }

        const [godown] = await db.insert(godowns).values({
            id: `gdwn_${nanoid(16)}`,
            businessId: business.id,
            name: body.name,
            address: body.address,
            isDefault: body.isDefault ?? false,
            isActive: true,
            createdByUserId: authUser.id,
            createdAt: now,
            updatedAt: now,
        }).returning();

        return c.json({ ok: true, data: godown }, 201);
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Failed to create godown.' }, 400);
    }
});

// Update godown
godownsRoute.put('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

    const id = c.req.param('id');
    try {
        const body = z.object({
            name: z.string().min(1).max(200).optional(),
            address: z.string().max(500).optional(),
            isDefault: z.boolean().optional(),
        }).parse(await c.req.json());

        const now = new Date();
        if (body.isDefault) {
            await db.update(godowns).set({ isDefault: false, updatedAt: now })
                .where(and(eq(godowns.businessId, business.id), eq(godowns.isDefault, true)));
        }

        const [godown] = await db.update(godowns).set({ ...body, updatedAt: now })
            .where(and(eq(godowns.id, id), eq(godowns.businessId, business.id))).returning();
        if (!godown) return c.json({ ok: false, message: 'Godown not found' }, 404);
        return c.json({ ok: true, data: godown });
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Failed to update godown.' }, 400);
    }
});

// Deactivate godown
godownsRoute.delete('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

    const id = c.req.param('id');
    await db.update(godowns).set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(godowns.id, id), eq(godowns.businessId, business.id)));
    return c.json({ ok: true, message: 'Godown deactivated' });
});

// Get stock in godown
godownsRoute.get('/:id/stock', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

    const godownId = c.req.param('id');
    const [gdn] = await db.select().from(godowns).where(and(eq(godowns.id, godownId), eq(godowns.businessId, business.id)));
    if (!gdn) return c.json({ ok: false, message: 'Godown not found' }, 404);

    const stock = await db
        .select({
            itemId: godownStock.itemId,
            quantity: godownStock.quantity,
            itemName: items.name,
            itemSku: items.sku,
            itemUnit: items.unit,
        })
        .from(godownStock)
        .leftJoin(items, eq(items.id, godownStock.itemId))
        .where(and(eq(godownStock.godownId, godownId), eq(godownStock.businessId, business.id)));

    return c.json({ ok: true, data: stock });
});

// Transfer stock between godowns
godownsRoute.post('/transfer', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

    try {
        const body = z.object({
            fromGodownId: z.string(),
            toGodownId: z.string(),
            itemId: z.string(),
            quantity: z.number().positive(),
            date: z.string().datetime().optional(),
            notes: z.string().max(500).optional(),
        }).parse(await c.req.json());

        if (body.fromGodownId === body.toGodownId) {
            return c.json({ ok: false, message: 'Source and destination godowns must differ' }, 400);
        }

        const [fromGdn] = await db.select().from(godowns).where(and(eq(godowns.id, body.fromGodownId), eq(godowns.businessId, business.id)));
        const [toGdn] = await db.select().from(godowns).where(and(eq(godowns.id, body.toGodownId), eq(godowns.businessId, business.id)));
        if (!fromGdn || !toGdn) return c.json({ ok: false, message: 'Invalid godown' }, 400);

        const [fromStock] = await db.select().from(godownStock)
            .where(and(eq(godownStock.godownId, body.fromGodownId), eq(godownStock.itemId, body.itemId)));
        if (!fromStock || fromStock.quantity < body.quantity) {
            return c.json({ ok: false, message: 'Insufficient stock in source godown' }, 400);
        }

        const now = new Date();
        await db.transaction(async (tx) => {
            await tx.update(godownStock)
                .set({ quantity: sql`${godownStock.quantity} - ${body.quantity}`, updatedAt: now })
                .where(and(eq(godownStock.godownId, body.fromGodownId), eq(godownStock.itemId, body.itemId)));

            await tx.insert(godownStock).values({
                id: `gstk_${nanoid(16)}`,
                businessId: business.id,
                godownId: body.toGodownId,
                itemId: body.itemId,
                quantity: body.quantity,
                createdAt: now,
                updatedAt: now,
            }).onConflictDoUpdate({
                target: [godownStock.godownId, godownStock.itemId],
                set: { quantity: sql`${godownStock.quantity} + ${body.quantity}`, updatedAt: now },
            });

            await tx.insert(stockTransfers).values({
                id: `stxfr_${nanoid(14)}`,
                businessId: business.id,
                fromGodownId: body.fromGodownId,
                toGodownId: body.toGodownId,
                itemId: body.itemId,
                quantity: body.quantity,
                date: body.date ? new Date(body.date) : now,
                notes: body.notes,
                createdByUserId: authUser.id,
                createdAt: now,
            });
        });

        return c.json({ ok: true, message: 'Stock transferred successfully' });
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Transfer failed.' }, 400);
    }
});

// List transfers
godownsRoute.get('/transfers', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);

    const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
    const offset = Number(c.req.query('offset') ?? 0);

    const rows = await db.select().from(stockTransfers)
        .where(eq(stockTransfers.businessId, business.id))
        .orderBy(desc(stockTransfers.date))
        .limit(limit)
        .offset(offset);

    return c.json({ ok: true, data: rows });
});

export default godownsRoute;
