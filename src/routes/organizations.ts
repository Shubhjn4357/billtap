import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import {
    businesses,
    businessMembers,
    businessSettings,
    signatures,
    staffInvites,
    templates,
    users,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    ensurePrimaryBusiness,
    getAccessibleBusiness,
    getActiveSubscription,
    getRequestedBusinessId,
    requireOrganizationCapability,
} from './helpers';
import {
    assertBusinessCreationAllowed,
    assertModuleEnabled,
    assertStaffCreationAllowed,
    assertSubscriptionWriteAllowed,
} from '../services/subscriptionPolicy';
import { normalizeSettingsData } from '../constants/settingsSchema';

const organizationsRoute = new Hono<AppEnv>();

const createOrganizationSchema = z.object({
    name: z.string().trim().min(2),
    code: z.string().trim().min(2),
    currency: z.string().trim().min(3).max(3).optional(),
    phoneNumber: z.string().trim().optional(),
    email: z.string().email().optional(),
    gstNumber: z.string().trim().optional(),
    address: z.string().trim().optional(),
});

const patchOrganizationSchema = createOrganizationSchema.partial().extend({
    state: z.string().trim().optional(),
    legalName: z.string().trim().optional(),
    pan: z.string().trim().optional(),
    category: z.string().trim().optional(),
    isActive: z.boolean().optional(),
});

const memberPayloadSchema = z.object({
    displayName: z.string().trim().min(1),
    phoneNumber: z.string().trim().min(5),
    role: z.enum(['manager', 'salesman']).default('salesman'),
    permissions: z.record(z.string(), z.boolean()).optional(),
});

const patchMemberSchema = z.object({
    role: z.enum(['manager', 'salesman']).optional(),
    permissions: z.record(z.string(), z.boolean()).optional(),
    isActive: z.boolean().optional(),
});

const settingsPayloadSchema = z.object({
    settings: z.record(z.string(), z.unknown()),
});

const createTemplateSchema = z.object({
    templateKey: z.string().trim().min(2),
    name: z.string().trim().min(1),
    isPremium: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    layoutConfig: z.record(z.string(), z.unknown()).optional().default({}),
});

const createSignatureSchema = z.object({
    name: z.string().trim().optional(),
    signatureData: z.string().trim().optional(),
    signatureUrl: z.string().trim().optional(),
    isDefault: z.boolean().optional().default(false),
});

organizationsRoute.use('/*', requireAuth);

organizationsRoute.get('/mine', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');

        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const owned = await db
            .select()
            .from(businesses)
            .where(and(eq(businesses.ownerUserId, authUser.id), eq(businesses.isActive, true)));

        const organizations = owned.map((business) => ({
            id: business.id,
            name: business.name,
            code: business.code ?? business.id,
            currency: business.currency,
            role: 'owner',
            permissions: {},
        }));

        return c.json({ ok: true, organizations });
    } catch (error) {
        console.error('[organizations] failed to list mine', error);
        return c.json({ ok: false, message: 'Unable to load businesses right now.' }, 500);
    }
});

organizationsRoute.post('/', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        await assertBusinessCreationAllowed(db, authUser.id, getRequestedBusinessId(c));

        const payload = createOrganizationSchema.parse(await c.req.json());
        const now = new Date();
        const id = `biz_${nanoid(18)}`;

        await db.insert(businesses).values({
            id,
            ownerUserId: authUser.id,
            name: payload.name,
            code: payload.code,
            currency: payload.currency?.toUpperCase() ?? 'INR',
            phone: payload.phoneNumber ?? null,
            email: payload.email ?? null,
            gstin: payload.gstNumber?.toUpperCase() ?? null,
            address: payload.address ?? null,
            legalName: null,
            state: null,
            pan: null,
            booksStartDate: now,
            logoUrl: null,
            category: null,
            isActive: true,
            settings: {},
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create organization.';
        if (message.toLowerCase().includes('failed query')) {
            return c.json({ ok: false, message: 'Database error while creating business. Please try again.' }, 500);
        }
        if (
            message.includes('multiple businesses')
            || message.includes('max businesses')
            || message.includes('Plan limit exceeded')
        ) {
            return c.json({ ok: false, message }, 409);
        }
        if (
            message.includes('offline mode only')
            || message.includes('Subscription is required')
            || message.includes('read-only')
        ) {
            return c.json({ ok: false, message }, 403);
        }
        return c.json({ ok: false, message }, 400);
    }
});

organizationsRoute.get('/current', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) {
            return c.json({ ok: false, message: 'Organization not found.' }, 404);
        }

        return c.json({
            ok: true,
            organization: {
                id: business.id,
                userId: business.ownerUserId,
                name: business.name,
                code: business.code ?? business.id,
                currency: business.currency,
                gstNumber: business.gstin,
                address: business.address,
                phoneNumber: business.phone,
                email: business.email,
            },
            context: {
                role: c.get('organizationRole') ?? 'owner',
                permissions: c.get('organizationPermissions') ?? {},
                ownerUserId: business.ownerUserId,
                settings: business.settings ?? {},
            },
        });
    } catch (error) {
        console.error('[organizations] failed to load current', error);
        return c.json({ ok: false, message: 'Unable to load selected business right now.' }, 500);
    }
});

organizationsRoute.patch('/:id', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const id = c.req.param('id');
        const payload = patchOrganizationSchema.parse(await c.req.json());

        const businessRows = await db.select().from(businesses).where(and(eq(businesses.id, id), eq(businesses.ownerUserId, authUser.id))).limit(1);
        const targetBusiness = businessRows[0];
        if (!targetBusiness) {
            return c.json({ ok: false, message: 'Organization not found.' }, 404);
        }

        const subscription = await getActiveSubscription(db, id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(targetBusiness, 'settings');

        await db.update(businesses).set({
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.code !== undefined ? { code: payload.code } : {}),
            ...(payload.currency !== undefined ? { currency: payload.currency.toUpperCase() } : {}),
            ...(payload.phoneNumber !== undefined ? { phone: payload.phoneNumber } : {}),
            ...(payload.email !== undefined ? { email: payload.email } : {}),
            ...(payload.gstNumber !== undefined ? { gstin: payload.gstNumber?.toUpperCase() ?? null } : {}),
            ...(payload.address !== undefined ? { address: payload.address } : {}),
            ...(payload.state !== undefined ? { state: payload.state } : {}),
            ...(payload.legalName !== undefined ? { legalName: payload.legalName } : {}),
            ...(payload.pan !== undefined ? { pan: payload.pan } : {}),
            ...(payload.category !== undefined ? { category: payload.category } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
        }).where(and(eq(businesses.id, id), eq(businesses.ownerUserId, authUser.id)));

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update organization.' }, 400);
    }
});

organizationsRoute.get('/settings/current', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Organization not found.' }, 404);
    }

    return c.json({ ok: true, settings: business.settings ?? {} });
});

organizationsRoute.put('/settings/current', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) {
            return c.json({ ok: false, message: 'Organization not found.' }, 404);
        }

        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'settings');

        const payload = settingsPayloadSchema.parse(await c.req.json());
        const settings = payload.settings;

        await db.update(businesses).set({
            settings,
            updatedAt: new Date(),
        }).where(eq(businesses.id, business.id));

        return c.json({ ok: true, settings });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update settings.' }, 400);
    }
});

organizationsRoute.get('/members/current', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Organization not found.' }, 404);
    }

    const members = await db
        .select()
        .from(businessMembers)
        .where(and(eq(businessMembers.businessId, business.id), eq(businessMembers.isActive, true)));

    const userIds = members.map((entry) => entry.userId);
    const linkedUsers = userIds.length > 0
        ? await db.select().from(users)
            .where(inArray(users.id, userIds))
        : [];

    const userById = new Map(linkedUsers.map((entry) => [entry.id, entry]));

    return c.json({
        ok: true,
        members: members.map((entry) => ({
            id: entry.id,
            userId: entry.userId,
            role: entry.role === 'OWNER' ? 'manager' : 'salesman',
            permissions: entry.permissions,
            isActive: entry.isActive,
            phoneNumberSnapshot: entry.phoneSnapshot,
            joinedAt: entry.joinedAt,
            user: userById.get(entry.userId)
                ? {
                    uid: userById.get(entry.userId)?.id,
                    displayName: userById.get(entry.userId)?.name,
                    phoneNumber: userById.get(entry.userId)?.phone,
                    email: userById.get(entry.userId)?.email,
                }
                : null,
        })),
    });
});

organizationsRoute.post('/members/current', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) {
            return c.json({ ok: false, message: 'Organization not found.' }, 404);
        }

        const subscription = await getActiveSubscription(db, business.id);
        assertModuleEnabled(business, 'staff');
        await assertStaffCreationAllowed(db, business.id, subscription);

        const payload = memberPayloadSchema.parse(await c.req.json());
        const now = new Date();

        const shadowUserId = `usr_shadow_${nanoid(10)}`;
        await db.insert(users).values({
            id: shadowUserId,
            googleSub: `manual_${shadowUserId}`,
            name: payload.displayName,
            email: `${shadowUserId}@local.vahi`,
            phone: payload.phoneNumber,
            photoUrl: null,
            isDisabled: false,
            metadata: {},
            createdAt: now,
            updatedAt: now,
        });

        const memberId = `mbr_${nanoid(16)}`;
        await db.insert(businessMembers).values({
            id: memberId,
            businessId: business.id,
            userId: shadowUserId,
            role: payload.role === 'manager' ? 'OWNER' : 'STAFF',
            permissions: payload.permissions ?? {},
            isActive: true,
            invitedByUserId: authUser.id,
            phoneSnapshot: payload.phoneNumber,
            joinedAt: now,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, userId: shadowUserId });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to add member.' }, 400);
    }
});

organizationsRoute.patch('/members/current/:memberId', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) {
            return c.json({ ok: false, message: 'Organization not found.' }, 404);
        }

        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'staff');

        const memberId = c.req.param('memberId');
        const payload = patchMemberSchema.parse(await c.req.json());

        await db.update(businessMembers).set({
            ...(payload.role !== undefined ? { role: payload.role === 'manager' ? 'OWNER' : 'STAFF' } : {}),
            ...(payload.permissions !== undefined ? { permissions: payload.permissions } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
        }).where(and(eq(businessMembers.id, memberId), eq(businessMembers.businessId, business.id)));

        return c.json({ ok: true });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update member.' }, 400);
    }
});

organizationsRoute.delete('/members/current/:memberId', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Organization not found.' }, 404);
    }

    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'staff');

    const memberId = c.req.param('memberId');
    await db.update(businessMembers).set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(businessMembers.id, memberId), eq(businessMembers.businessId, business.id)));

    return c.json({ ok: true });
});

organizationsRoute.get('/templates/current', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Organization not found.' }, 404);
    }

    const rows = await db
        .select()
        .from(templates)
        .where(eq(templates.businessId, business.id));

    return c.json({
        ok: true,
        templates: rows.map((entry) => ({
            id: entry.id,
            templateKey: entry.type,
            name: entry.name,
            isPremium: false,
            isActive: entry.isActive,
            layoutConfig: entry.content,
        })),
    });
});

organizationsRoute.post('/templates/current', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) {
            return c.json({ ok: false, message: 'Organization not found.' }, 404);
        }

        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'templates');

        const payload = createTemplateSchema.parse(await c.req.json());
        const id = `tpl_${nanoid(16)}`;
        const now = new Date();

        await db.insert(templates).values({
            id,
            businessId: business.id,
            name: payload.name,
            type: payload.templateKey,
            content: payload.layoutConfig,
            isDefault: false,
            thumbnailUrl: null,
            isActive: payload.isActive,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create template.' }, 400);
    }
});

organizationsRoute.get('/signatures/current', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Organization not found.' }, 404);
    }

    const rows = await db
        .select()
        .from(signatures)
        .where(eq(signatures.businessId, business.id));

    return c.json({ ok: true, signatures: rows });
});

organizationsRoute.post('/signatures/current', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) {
            return c.json({ ok: false, message: 'Organization not found.' }, 404);
        }

        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'templates');

        const payload = createSignatureSchema.parse(await c.req.json());
        const id = `sig_${nanoid(16)}`;
        const now = new Date();

        if (payload.isDefault) {
            await db.update(signatures).set({ isDefault: false, updatedAt: now })
                .where(eq(signatures.businessId, business.id));
        }

        await db.insert(signatures).values({
            id,
            businessId: business.id,
            name: payload.name ?? null,
            signatureData: payload.signatureData ?? null,
            signatureUrl: payload.signatureUrl ?? null,
            isDefault: payload.isDefault,
            createdByUserId: authUser.id,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save signature.' }, 400);
    }
});

organizationsRoute.post('/signatures/current/:id/default', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Organization not found.' }, 404);
    }

    const subscription = await getActiveSubscription(db, business.id);
    assertSubscriptionWriteAllowed(subscription);
    assertModuleEnabled(business, 'templates');

    const id = c.req.param('id');
    const now = new Date();
    await db.update(signatures).set({ isDefault: false, updatedAt: now }).where(eq(signatures.businessId, business.id));
    await db.update(signatures).set({ isDefault: true, updatedAt: now })
        .where(and(eq(signatures.id, id), eq(signatures.businessId, business.id)));

    return c.json({ ok: true });
});

organizationsRoute.get('/print-profiles/current', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) {
        return c.json({ ok: false, message: 'Organization not found.' }, 404);
    }
    const denied = requireOrganizationCapability(c, 'settings.read');
    if (denied) return denied;

    const [row] = await db
        .select()
        .from(businessSettings)
        .where(and(
            eq(businessSettings.businessId, business.id),
            eq(businessSettings.section, 'INVOICE_PRINT'),
        ))
        .limit(1);

    const data = normalizeSettingsData('INVOICE_PRINT', (row?.dataJson ?? {}) as Record<string, unknown>);

    return c.json({
        ok: true,
        profiles: [
            {
                id: row?.id ?? null,
                section: 'INVOICE_PRINT',
                name: 'Current',
                data,
                updatedAt: row?.updatedAt ?? null,
            },
        ],
    });
});

organizationsRoute.post('/print-profiles/current', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) {
            return c.json({ ok: false, message: 'Organization not found.' }, 404);
        }
        const denied = requireOrganizationCapability(c, 'settings.write');
        if (denied) return denied;

        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'settings');

        const payload = z.object({ data: z.record(z.string(), z.unknown()) }).parse(await c.req.json());
        const normalized = normalizeSettingsData('INVOICE_PRINT', payload.data);

        const [existing] = await db.select().from(businessSettings)
            .where(and(
                eq(businessSettings.businessId, business.id),
                eq(businessSettings.section, 'INVOICE_PRINT'),
            ))
            .limit(1);

        if (existing) {
            const [updated] = await db.update(businessSettings).set({
                dataJson: normalized,
                updatedAt: new Date(),
            }).where(eq(businessSettings.id, existing.id)).returning();

            return c.json({ ok: true, id: updated?.id ?? existing.id, data: normalized });
        }

        const id = `prf_${nanoid(12)}`;
        await db.insert(businessSettings).values({
            id,
            businessId: business.id,
            section: 'INVOICE_PRINT',
            dataJson: normalized,
            updatedAt: new Date(),
        });

        return c.json({ ok: true, id, data: normalized });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update print profile.' }, 400);
    }
});

organizationsRoute.get('/invites', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await ensurePrimaryBusiness(db, authUser);
    const invites = await db
        .select()
        .from(staffInvites)
        .where(eq(staffInvites.businessId, business.id));

    return c.json({ ok: true, invites });
});

export default organizationsRoute;
