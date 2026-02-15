import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import { items } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';

const itemsRoute = new Hono<AppEnv>();

// Schema for Item Input
const itemSchema = z.object({
    id: z.string().min(6).optional(),
    name: z.string().min(1),
    price: z.number().nonnegative(),
    purchasePrice: z.number().nonnegative().default(0),
    mrp: z.number().nonnegative().default(0),
    stock: z.number().int().default(0),
    minimumStock: z.number().int().default(0),
    openingStock: z.number().int().default(0),
    unit: z.string().default('pcs'),
    hsn: z.string().optional(),
    gstPercentage: z.number().nonnegative().default(0),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    location: z.string().optional(),
    barcode: z.string().optional(),
    expiresAt: z.coerce.date().optional().nullable(),
    autoDeleteAt: z.coerce.date().optional().nullable(),
    autoDeleteEnabled: z.boolean().default(false),
    isActive: z.boolean().default(true),
});

// GET /items - List items
itemsRoute.get('/', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const db = c.get('db');
    const queryText = c.req.query('q')?.trim();
    const limit = Math.min(Number(c.req.query('limit') || 100), 500);

    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

    const baseConditions = [eq(items.userId, effectiveUserId)];

    if (queryText) {
        const normalized = queryText.toLowerCase();
        const searchCondition = or(
            sql`${items.nameLowercase} like ${`%${normalized}%`}`,
            sql`coalesce(${items.barcode}, '') like ${`%${queryText}%`}`
        );
        if (searchCondition) baseConditions.push(searchCondition);
    }

    const data = await db
        .select()
        .from(items)
        .where(and(...baseConditions))
        .orderBy(asc(items.nameLowercase))
        .limit(limit);

    return c.json({ ok: true, items: data });
});

// GET /items/:id - Get item detail
itemsRoute.get('/:id', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const db = c.get('db');
    const id = c.req.param('id');

    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

    const data = await db
        .select()
        .from(items)
        .where(and(eq(items.id, id), eq(items.userId, effectiveUserId)))
        .limit(1);

    if (!data[0]) {
        return c.json({ ok: false, message: 'Item not found.' }, 404);
    }

    return c.json({ ok: true, item: data[0] });
});

// POST /items - Create item
itemsRoute.post('/', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const db = c.get('db');
        const body = await c.req.json();

        if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

        const payload = itemSchema.parse(body);
        const id = payload.id ?? nanoid();
        const now = new Date();

        // Check for duplicate ID (rare with nanoid but possible if user provides one)
        if (payload.id) {
            const existing = await db.select({ id: items.id }).from(items).where(eq(items.id, id)).limit(1);
            if (existing[0]) return c.json({ ok: false, message: 'Item ID already exists.' }, 409);
        }

        // Check for duplicate Barcode (optional but good practice)
        if (payload.barcode) {
            const existingBarcode = await db
                .select({ id: items.id })
                .from(items)
                .where(and(eq(items.barcode, payload.barcode), eq(items.userId, effectiveUserId)))
                .limit(1);
            if (existingBarcode[0]) return c.json({ ok: false, message: 'Barcode already used.' }, 409);
        }

        await db.insert(items).values({
            id,
            userId: effectiveUserId,
            name: payload.name.trim(),
            nameLowercase: payload.name.trim().toLowerCase(),
            price: payload.price,
            purchasePrice: payload.purchasePrice,
            mrp: payload.mrp,
            stock: payload.stock,
            minimumStock: payload.minimumStock,
            openingStock: payload.openingStock,
            unit: payload.unit,
            hsn: payload.hsn?.trim() || null,
            gstPercentage: payload.gstPercentage,
            category: payload.category?.trim() || null,
            subcategory: payload.subcategory?.trim() || null,
            location: payload.location?.trim() || null,
            barcode: payload.barcode?.trim() || null,
            expiresAt: payload.expiresAt ?? null,
            autoDeleteAt: payload.autoDeleteAt ?? null,
            autoDeleteEnabled: payload.autoDeleteEnabled,
            isActive: payload.isActive,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Invalid request.' }, 400);
    }
});

// PATCH /items/:id - Update item
itemsRoute.patch('/:id', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const db = c.get('db');
        const id = c.req.param('id');
        const body = await c.req.json();

        if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

        const updateSchema = itemSchema.partial();
        const payload = updateSchema.parse(body);

        const updatePayload: Partial<typeof items.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (payload.name !== undefined) {
            updatePayload.name = payload.name.trim();
            updatePayload.nameLowercase = payload.name.trim().toLowerCase();
        }
        if (payload.price !== undefined) updatePayload.price = payload.price;
        if (payload.purchasePrice !== undefined) updatePayload.purchasePrice = payload.purchasePrice;
        if (payload.mrp !== undefined) updatePayload.mrp = payload.mrp;
        if (payload.stock !== undefined) updatePayload.stock = payload.stock;
        if (payload.minimumStock !== undefined) updatePayload.minimumStock = payload.minimumStock;
        if (payload.unit !== undefined) updatePayload.unit = payload.unit;
        if (payload.hsn !== undefined) updatePayload.hsn = payload.hsn;
        if (payload.gstPercentage !== undefined) updatePayload.gstPercentage = payload.gstPercentage;
        if (payload.category !== undefined) updatePayload.category = payload.category;
        if (payload.subcategory !== undefined) updatePayload.subcategory = payload.subcategory;
        if (payload.location !== undefined) updatePayload.location = payload.location;
        if (payload.barcode !== undefined) updatePayload.barcode = payload.barcode;
        if (payload.expiresAt !== undefined) updatePayload.expiresAt = payload.expiresAt;
        if (payload.autoDeleteAt !== undefined) updatePayload.autoDeleteAt = payload.autoDeleteAt;
        if (payload.autoDeleteEnabled !== undefined) updatePayload.autoDeleteEnabled = payload.autoDeleteEnabled;
        if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

        const updated = await db
            .update(items)
            .set(updatePayload)
            .where(and(eq(items.id, id), eq(items.userId, effectiveUserId)))
            .returning({ id: items.id });

        if (!updated[0]) {
            return c.json({ ok: false, message: 'Item not found.' }, 404);
        }

        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Invalid request.' }, 400);
    }
});

// DELETE /items/:id - Delete item
itemsRoute.delete('/:id', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const db = c.get('db');
    const id = c.req.param('id');

    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized' }, 401);

    const deleted = await db
        .delete(items)
        .where(and(eq(items.id, id), eq(items.userId, effectiveUserId)))
        .returning({ id: items.id });

    if (!deleted[0]) {
        return c.json({ ok: false, message: 'Item not found.' }, 404);
    }

    return c.json({ ok: true });
});

export default itemsRoute;
