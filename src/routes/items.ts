import { Hono } from 'hono';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { inventoryMovements, items } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { ensurePrimaryBusiness, getAccessibleBusiness, getActiveSubscription, getRequestedBusinessId } from './helpers';
import {
    assertAllowedGstRate,
    assertFeatureFlag,
    assertModuleEnabled,
    assertSubscriptionWriteAllowed,
} from '../services/subscriptionPolicy';

const itemsRoute = new Hono<AppEnv>();

const upsertItemSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1),
    price: z.number().nonnegative(),
    stock: z.number(),
    purchasePrice: z.number().optional(),
    mrp: z.number().optional(),
    minimumStock: z.number().optional(),
    unit: z.string().trim().optional(),
    hsn: z.string().trim().optional(),
    gstPercentage: z.number().optional(),
    category: z.string().trim().optional(),
    subcategory: z.string().trim().optional(),
    description: z.string().trim().optional(),
    location: z.string().trim().optional(),
    barcode: z.string().trim().optional(),
    imageUrl: z.string().trim().optional(),
    isActive: z.boolean().optional(),
    autoDeleteEnabled: z.boolean().optional(),
    autoDeleteAt: z.coerce.date().optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
});

const patchItemSchema = upsertItemSchema.partial().extend({
    name: z.string().trim().min(1).optional(),
});

const adjustStockSchema = z.object({
    type: z.enum(['IN', 'OUT', 'ADJUST']),
    quantity: z.number().positive(),
    reason: z.string().trim().optional(),
});

const toClientItem = (item: typeof items.$inferSelect, userId: string) => ({
    id: item.id,
    userId,
    name: item.name,
    nameLowercase: item.nameLowercase,
    price: Number(item.salePrice ?? 0),
    purchasePrice: Number(item.purchasePrice ?? 0),
    mrp: Number(item.mrp ?? 0),
    hsn: item.hsnCode,
    gstPercentage: Number(item.gstRate ?? 0),
    stock: Number(item.stock ?? 0),
    minimumStock: Number(item.reorderLevel ?? 0),
    openingStock: Number(item.openingStock ?? 0),
    unit: item.unit,
    category: item.category,
    subcategory: null,
    description: item.description,
    location: item.location,
    barcode: item.barcode,
    imageUrl: item.imageUrl,
    expiresAt: item.expiresAt,
    autoDeleteAt: item.autoDeleteAt,
    autoDeleteEnabled: item.autoDeleteEnabled,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
});

itemsRoute.use('/*', requireAuth);

itemsRoute.get('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'STOCK_MODULE');
    assertModuleEnabled(business, 'stock');

    const q = c.req.query('q')?.trim();
    const limit = Math.min(Number(c.req.query('limit') ?? 200), 1000);

    const whereBase = and(eq(items.businessId, business.id), eq(items.isActive, true));

    const rows = q
        ? await db
            .select()
            .from(items)
            .where(and(
                whereBase,
                or(
                    ilike(items.name, `%${q}%`),
                    ilike(items.nameLowercase, `%${q.toLowerCase()}%`),
                    ilike(items.barcode, `%${q}%`),
                ),
            ))
            .orderBy(asc(items.nameLowercase))
            .limit(limit)
        : await db
            .select()
            .from(items)
            .where(whereBase)
            .orderBy(asc(items.nameLowercase))
            .limit(limit);

    return c.json({ ok: true, items: rows.map((row) => toClientItem(row, authUser.id)) });
});

itemsRoute.get('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'STOCK_MODULE');
    assertModuleEnabled(business, 'stock');

    const id = c.req.param('id');
    const rows = await db
        .select()
        .from(items)
        .where(and(eq(items.id, id), eq(items.businessId, business.id)))
        .limit(1);

    const item = rows[0];
    if (!item) return c.json({ ok: false, message: 'Item not found.' }, 404);

    return c.json({ ok: true, item: toClientItem(item, authUser.id) });
});

itemsRoute.post('/', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await ensurePrimaryBusiness(db, authUser);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'STOCK_MODULE');
        assertModuleEnabled(business, 'stock');
        const payload = upsertItemSchema.parse(await c.req.json());
        if (payload.gstPercentage !== undefined) {
            assertAllowedGstRate(payload.gstPercentage);
        }
        const id = payload.id?.trim() || `itm_${nanoid(18)}`;
        const now = new Date();

        await db.insert(items).values({
            id,
            businessId: business.id,
            name: payload.name,
            nameLowercase: payload.name.toLowerCase(),
            sku: null,
            barcode: payload.barcode ?? null,
            hsnCode: payload.hsn ?? null,
            unit: payload.unit ?? 'pcs',
            category: payload.category ?? null,
            mrp: payload.mrp ?? payload.price,
            purchasePrice: payload.purchasePrice ?? 0,
            salePrice: payload.price,
            gstRate: payload.gstPercentage ?? 0,
            openingStock: payload.stock,
            stock: payload.stock,
            reorderLevel: payload.minimumStock ?? 0,
            description: payload.description ?? null,
            location: payload.location ?? null,
            imageUrl: payload.imageUrl ?? null,
            expiresAt: payload.expiresAt ?? null,
            autoDeleteAt: payload.autoDeleteAt ?? null,
            autoDeleteEnabled: payload.autoDeleteEnabled ?? false,
            isActive: payload.isActive ?? true,
            createdAt: now,
            updatedAt: now,
        }).onConflictDoUpdate({
            target: items.id,
            set: {
                name: payload.name,
                nameLowercase: payload.name.toLowerCase(),
                barcode: payload.barcode ?? null,
                hsnCode: payload.hsn ?? null,
                unit: payload.unit ?? 'pcs',
                category: payload.category ?? null,
                mrp: payload.mrp ?? payload.price,
                purchasePrice: payload.purchasePrice ?? 0,
                salePrice: payload.price,
                gstRate: payload.gstPercentage ?? 0,
                stock: payload.stock,
                reorderLevel: payload.minimumStock ?? 0,
                description: payload.description ?? null,
                location: payload.location ?? null,
                imageUrl: payload.imageUrl ?? null,
                expiresAt: payload.expiresAt ?? null,
                autoDeleteAt: payload.autoDeleteAt ?? null,
                autoDeleteEnabled: payload.autoDeleteEnabled ?? false,
                isActive: payload.isActive ?? true,
                updatedAt: now,
            },
        });

        await db.insert(inventoryMovements).values({
            id: `mov_${nanoid(16)}`,
            businessId: business.id,
            itemId: id,
            movementType: 'ADJUST',
            quantity: payload.stock,
            balanceAfter: payload.stock,
            reason: 'Opening/Upsert',
            referenceId: id,
            createdByUserId: authUser.id,
            createdAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save item.' }, 400);
    }
});

itemsRoute.patch('/:id', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'STOCK_MODULE');
        assertModuleEnabled(business, 'stock');

        const id = c.req.param('id');
        const payload = patchItemSchema.parse(await c.req.json());
        if (payload.gstPercentage !== undefined) {
            assertAllowedGstRate(payload.gstPercentage);
        }

        await db.update(items).set({
            ...(payload.name !== undefined ? { name: payload.name, nameLowercase: payload.name.toLowerCase() } : {}),
            ...(payload.barcode !== undefined ? { barcode: payload.barcode } : {}),
            ...(payload.hsn !== undefined ? { hsnCode: payload.hsn } : {}),
            ...(payload.unit !== undefined ? { unit: payload.unit } : {}),
            ...(payload.category !== undefined ? { category: payload.category } : {}),
            ...(payload.mrp !== undefined ? { mrp: payload.mrp } : {}),
            ...(payload.purchasePrice !== undefined ? { purchasePrice: payload.purchasePrice } : {}),
            ...(payload.price !== undefined ? { salePrice: payload.price } : {}),
            ...(payload.gstPercentage !== undefined ? { gstRate: payload.gstPercentage } : {}),
            ...(payload.stock !== undefined ? { stock: payload.stock } : {}),
            ...(payload.minimumStock !== undefined ? { reorderLevel: payload.minimumStock } : {}),
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            ...(payload.location !== undefined ? { location: payload.location } : {}),
            ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
            ...(payload.expiresAt !== undefined ? { expiresAt: payload.expiresAt } : {}),
            ...(payload.autoDeleteAt !== undefined ? { autoDeleteAt: payload.autoDeleteAt } : {}),
            ...(payload.autoDeleteEnabled !== undefined ? { autoDeleteEnabled: payload.autoDeleteEnabled } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
        }).where(and(eq(items.id, id), eq(items.businessId, business.id)));

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update item.' }, 400);
    }
});

itemsRoute.post('/:id/adjust', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'STOCK_MODULE');
        assertModuleEnabled(business, 'stock');

        const id = c.req.param('id');
        const payload = adjustStockSchema.parse(await c.req.json());

        const current = await db
            .select()
            .from(items)
            .where(and(eq(items.id, id), eq(items.businessId, business.id)))
            .limit(1);

        const item = current[0];
        if (!item) {
            return c.json({ ok: false, message: 'Item not found.' }, 404);
        }

        const currentStock = Number(item.stock ?? 0);
        const nextStock = payload.type === 'IN'
            ? currentStock + payload.quantity
            : payload.type === 'OUT'
                ? currentStock - payload.quantity
                : payload.quantity;

        if (nextStock < 0) {
            return c.json({ ok: false, message: 'Insufficient stock.' }, 400);
        }

        const now = new Date();
        await db.update(items).set({ stock: nextStock, updatedAt: now })
            .where(and(eq(items.id, id), eq(items.businessId, business.id)));

        await db.insert(inventoryMovements).values({
            id: `mov_${nanoid(16)}`,
            businessId: business.id,
            itemId: id,
            movementType: payload.type,
            quantity: payload.quantity,
            balanceAfter: nextStock,
            reason: payload.reason ?? null,
            referenceId: null,
            createdByUserId: authUser.id,
            createdAt: now,
        });

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to adjust stock.' }, 400);
    }
});

itemsRoute.delete('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertFeatureFlag(subscription, 'STOCK_MODULE');
    assertModuleEnabled(business, 'stock');

    const id = c.req.param('id');
    await db.update(items).set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(items.id, id), eq(items.businessId, business.id)));

    return c.json({ ok: true });
});

itemsRoute.get('/:id/ledger', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'STOCK_MODULE');
    assertModuleEnabled(business, 'stock');

    const id = c.req.param('id');
    const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);

    const rows = await db.select().from(inventoryMovements)
        .where(and(eq(inventoryMovements.businessId, business.id), eq(inventoryMovements.itemId, id)))
        .orderBy(desc(inventoryMovements.createdAt))
        .limit(limit);

    return c.json({ ok: true, ledger: rows });
});

export default itemsRoute;
