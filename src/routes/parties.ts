import { Hono } from 'hono';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { parties } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    ensurePrimaryBusiness,
    getAccessibleBusiness,
    getActiveSubscription,
    getRequestedBusinessId,
    requireOrganizationCapability,
} from './helpers';
import {
    assertFeatureFlag,
    assertModuleEnabled,
    assertSubscriptionWriteAllowed,
} from '../services/subscriptionPolicy';

const partiesRoute = new Hono<AppEnv>();

const partyTypeValues = ['customer', 'supplier'] as const;

const createPartySchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1),
    type: z.enum(partyTypeValues),
    phone: z.string().trim().optional(),
    email: z.string().email().optional(),
    address: z.string().trim().optional(),
    gstNumber: z.string().trim().optional(),
    isActive: z.boolean().optional(),
});

const patchPartySchema = createPartySchema.partial();

const toClientParty = (entry: typeof parties.$inferSelect, userId: string) => ({
    id: entry.id,
    userId,
    name: entry.name,
    type: entry.type === 'CUSTOMER' ? 'customer' : 'supplier',
    phone: entry.phone,
    email: entry.email,
    address: entry.billingAddress,
    gstNumber: entry.gstin,
    isActive: entry.isActive,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
});

partiesRoute.use('/*', requireAuth);

partiesRoute.get('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'parties.read');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'PARTY_MANAGEMENT');
    assertModuleEnabled(business, 'parties');

    const q = c.req.query('q')?.trim();
    const type = c.req.query('type')?.trim().toLowerCase();

    const whereFilters = [eq(parties.businessId, business.id)];
    if (type === 'customer') whereFilters.push(eq(parties.type, 'CUSTOMER'));
    if (type === 'supplier') whereFilters.push(eq(parties.type, 'SUPPLIER'));

    const rows = q
        ? await db
            .select()
            .from(parties)
            .where(and(
                ...whereFilters,
                or(
                    ilike(parties.name, `%${q}%`),
                    ilike(parties.nameLowercase, `%${q.toLowerCase()}%`),
                    ilike(parties.phone, `%${q}%`),
                ),
            ))
            .orderBy(asc(parties.nameLowercase))
        : await db
            .select()
            .from(parties)
            .where(and(...whereFilters))
            .orderBy(asc(parties.nameLowercase));

    return c.json({ ok: true, parties: rows.map((entry) => toClientParty(entry, authUser.id)) });
});

partiesRoute.post('/', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await ensurePrimaryBusiness(db, authUser);
        const denied = requireOrganizationCapability(c, 'parties.write');
        if (denied) return denied;
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'PARTY_MANAGEMENT');
        assertModuleEnabled(business, 'parties');
        const payload = createPartySchema.parse(await c.req.json());
        const now = new Date();
        const id = payload.id?.trim() || `pty_${nanoid(18)}`;

        await db.insert(parties).values({
            id,
            businessId: business.id,
            type: payload.type === 'customer' ? 'CUSTOMER' : 'SUPPLIER',
            name: payload.name,
            nameLowercase: payload.name.toLowerCase(),
            phone: payload.phone ?? null,
            email: payload.email ?? null,
            billingAddress: payload.address ?? null,
            shippingAddress: null,
            gstin: payload.gstNumber?.toUpperCase() ?? null,
            openingBalance: 0,
            creditLimit: 0,
            isActive: payload.isActive ?? true,
            createdAt: now,
            updatedAt: now,
        }).onConflictDoUpdate({
            target: parties.id,
            set: {
                type: payload.type === 'customer' ? 'CUSTOMER' : 'SUPPLIER',
                name: payload.name,
                nameLowercase: payload.name.toLowerCase(),
                phone: payload.phone ?? null,
                email: payload.email ?? null,
                billingAddress: payload.address ?? null,
                gstin: payload.gstNumber?.toUpperCase() ?? null,
                isActive: payload.isActive ?? true,
                updatedAt: now,
            },
        });

        return c.json({ ok: true, id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save party.' }, 400);
    }
});

partiesRoute.patch('/:id', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const denied = requireOrganizationCapability(c, 'parties.write');
        if (denied) return denied;
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertFeatureFlag(subscription, 'PARTY_MANAGEMENT');
        assertModuleEnabled(business, 'parties');

        const id = c.req.param('id');
        const payload = patchPartySchema.parse(await c.req.json());

        await db.update(parties).set({
            ...(payload.name !== undefined ? { name: payload.name, nameLowercase: payload.name.toLowerCase() } : {}),
            ...(payload.type !== undefined ? { type: payload.type === 'customer' ? 'CUSTOMER' : 'SUPPLIER' } : {}),
            ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
            ...(payload.email !== undefined ? { email: payload.email } : {}),
            ...(payload.address !== undefined ? { billingAddress: payload.address } : {}),
            ...(payload.gstNumber !== undefined ? { gstin: payload.gstNumber?.toUpperCase() ?? null } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
        }).where(and(eq(parties.id, id), eq(parties.businessId, business.id)));

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update party.' }, 400);
    }
});

partiesRoute.get('/:id', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'parties.read');
    if (denied) return denied;
    const subscription = await getActiveSubscription(db, business.id);
    assertFeatureFlag(subscription, 'PARTY_MANAGEMENT');
    assertModuleEnabled(business, 'parties');

    const id = c.req.param('id');
    const rows = await db
        .select()
        .from(parties)
        .where(and(eq(parties.id, id), eq(parties.businessId, business.id)))
        .limit(1);

    const party = rows[0];
    if (!party) {
        return c.json({ ok: false, message: 'Party not found.' }, 404);
    }

    return c.json({ ok: true, party: toClientParty(party, authUser.id) });
});

export default partiesRoute;
