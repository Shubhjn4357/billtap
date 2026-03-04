import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { businessSettings } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    getAccessibleBusiness,
    getActiveSubscription,
    getRequestedBusinessId,
    requireOrganizationCapability,
} from './helpers';
import { nanoid } from 'nanoid';
import {
    isValidSettingsSection,
    normalizeSettingsData,
    SETTINGS_SCHEMA,
    SETTINGS_SECTIONS,
} from '../constants/settingsSchema';
import { assertModuleEnabled, assertSubscriptionWriteAllowed } from '../services/subscriptionPolicy';

const businessSettingsRoute = new Hono<AppEnv>();

businessSettingsRoute.use('/*', requireAuth);

businessSettingsRoute.get('/schema', async (c) => {
    const denied = requireOrganizationCapability(c, 'settings.read');
    if (denied) return denied;
    return c.json({
        ok: true,
        sections: SETTINGS_SECTIONS,
        schema: SETTINGS_SCHEMA,
    });
});

// Get all settings
businessSettingsRoute.get('/', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'settings.read');
    if (denied) return denied;

    const rows = await db.select().from(businessSettings).where(eq(businessSettings.businessId, business.id));
    const settingsMap = rows.reduce<Record<string, Record<string, unknown>>>((acc, row) => {
        acc[row.section] = row.dataJson as Record<string, unknown>;
        return acc;
    }, {});

    return c.json({ ok: true, data: settingsMap });
});

// Get specific section
businessSettingsRoute.get('/:section', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
    if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
    const denied = requireOrganizationCapability(c, 'settings.read');
    if (denied) return denied;

    const section = c.req.param('section').toUpperCase();
    if (!isValidSettingsSection(section)) return c.json({ ok: false, message: 'Invalid settings section' }, 400);

    const [row] = await db.select().from(businessSettings)
        .where(and(eq(businessSettings.businessId, business.id), eq(businessSettings.section, section)));

    const normalized = normalizeSettingsData(section, (row?.dataJson ?? {}) as Record<string, unknown>);
    return c.json({ ok: true, data: normalized, section });
});

// Upsert settings section (merges with existing)
businessSettingsRoute.put('/:section', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const section = c.req.param('section').toUpperCase();
    if (!isValidSettingsSection(section)) return c.json({ ok: false, message: 'Invalid settings section' }, 400);

    try {
        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const denied = requireOrganizationCapability(c, 'settings.write');
        if (denied) return denied;

        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'settings');

        const body = z.object({ data: z.record(z.string(), z.unknown()) }).parse(await c.req.json());
        const now = new Date();

        const [existing] = await db.select().from(businessSettings)
            .where(and(eq(businessSettings.businessId, business.id), eq(businessSettings.section, section)));

        let result;
        if (existing) {
            const merged = { ...(existing.dataJson as Record<string, unknown>), ...body.data };
            [result] = await db.update(businessSettings)
                .set({
                    dataJson: normalizeSettingsData(section, merged),
                    updatedAt: now,
                })
                .where(and(eq(businessSettings.businessId, business.id), eq(businessSettings.section, section)))
                .returning();
        } else {
            const normalized = normalizeSettingsData(section, body.data);
            [result] = await db.insert(businessSettings).values({
                id: `bset_${nanoid(16)}`,
                businessId: business.id,
                section,
                dataJson: normalized,
                updatedAt: now,
            }).returning();
        }

        return c.json({ ok: true, data: result?.dataJson ?? body.data, section });
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Failed to save settings.' }, 400);
    }
});

// Reset section
businessSettingsRoute.delete('/:section', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const section = c.req.param('section').toUpperCase();
    if (!isValidSettingsSection(section)) return c.json({ ok: false, message: 'Invalid settings section' }, 400);

    try {
        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const denied = requireOrganizationCapability(c, 'settings.write');
        if (denied) return denied;

        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'settings');

        await db.update(businessSettings)
            .set({ dataJson: {}, updatedAt: new Date() })
            .where(and(eq(businessSettings.businessId, business.id), eq(businessSettings.section, section)));

        return c.json({ ok: true, message: 'Settings reset' });
    } catch (err) {
        return c.json({ ok: false, message: err instanceof Error ? err.message : 'Failed to reset settings.' }, 400);
    }
});

export default businessSettingsRoute;
