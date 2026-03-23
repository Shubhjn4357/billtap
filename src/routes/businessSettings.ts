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
import { toApiErrorPayload } from '../services/apiError';

const businessSettingsRoute = new Hono<AppEnv>();

businessSettingsRoute.use('/*', requireAuth);

const HIDDEN_SETTINGS_SECTIONS = new Set<string>();

const isBusinessSettingsStorageError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const normalized = message.toLowerCase();
    return normalized.includes('business_settings')
        && (
            normalized.includes('failed query')
            || normalized.includes('does not exist')
            || normalized.includes('relation')
            || normalized.includes('column')
            || normalized.includes('settings_section')
        );
};

businessSettingsRoute.get('/schema', async (c) => {
    const denied = requireOrganizationCapability(c, 'settings.read');
    if (denied) return denied;
    const visibleSections = SETTINGS_SECTIONS.filter((section) => !HIDDEN_SETTINGS_SECTIONS.has(section));
    const visibleSchema = Object.fromEntries(
        Object.entries(SETTINGS_SCHEMA).filter(([section]) => !HIDDEN_SETTINGS_SECTIONS.has(section))
    );
    return c.json({
        ok: true,
        sections: visibleSections,
        schema: visibleSchema,
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

    try {
        const rows = await db.select().from(businessSettings).where(eq(businessSettings.businessId, business.id));
        const settingsMap = rows.reduce<Record<string, Record<string, unknown>>>((acc, row) => {
            if (HIDDEN_SETTINGS_SECTIONS.has(row.section)) return acc;
            acc[row.section] = row.dataJson as Record<string, unknown>;
            return acc;
        }, {});

        return c.json({ ok: true, data: settingsMap });
    } catch (error) {
        if (isBusinessSettingsStorageError(error)) {
            console.error('[settings] storage unavailable; returning empty settings map', error);
            return c.json({ ok: true, data: {}, degraded: true });
        }
        throw error;
    }
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

    try {
        const [row] = await db.select().from(businessSettings)
            .where(and(eq(businessSettings.businessId, business.id), eq(businessSettings.section, section)));

        const normalized = normalizeSettingsData(section, (row?.dataJson ?? {}) as Record<string, unknown>);
        return c.json({ ok: true, data: normalized, section });
    } catch (error) {
        if (isBusinessSettingsStorageError(error)) {
            console.error(`[settings] storage unavailable for section ${section}; returning defaults`, error);
            return c.json({
                ok: true,
                data: normalizeSettingsData(section, {}),
                section,
                degraded: true,
            });
        }
        throw error;
    }
});

// Upsert settings section (merges with existing)
businessSettingsRoute.put('/:section', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const section = c.req.param('section').toUpperCase();
    if (!isValidSettingsSection(section)) return c.json({ ok: false, message: 'Invalid settings section' }, 400);
    let parsedData: Record<string, unknown> = {};

    try {
        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c));
        if (!business) return c.json({ ok: false, message: 'Business not found.' }, 404);
        const denied = requireOrganizationCapability(c, 'settings.write');
        if (denied) return denied;

        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'settings');

        const body = z.object({ data: z.record(z.string(), z.unknown()) }).parse(await c.req.json());
        parsedData = body.data;
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

        return c.json({ ok: true, data: result?.dataJson ?? parsedData, section });
    } catch (err) {
        if (isBusinessSettingsStorageError(err)) {
            console.error(`[settings] storage unavailable for PUT ${section}; accepting as no-op`, err);
            return c.json({
                ok: true,
                data: normalizeSettingsData(section, parsedData),
                section,
                degraded: true,
            });
        }
        const mapped = toApiErrorPayload(err, {
            code: 'SETTINGS_SAVE_FAILED',
            message: 'Failed to save settings.',
            status: 400,
        });
        return c.json(
            { ok: false, message: mapped.error.message, error: mapped.error },
            mapped.status as 400 | 401 | 403 | 404 | 409 | 422 | 500
        );
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
        if (isBusinessSettingsStorageError(err)) {
            console.error(`[settings] storage unavailable for DELETE ${section}; accepting as no-op`, err);
            return c.json({ ok: true, message: 'Settings reset', section, degraded: true });
        }
        const mapped = toApiErrorPayload(err, {
            code: 'SETTINGS_RESET_FAILED',
            message: 'Failed to reset settings.',
            status: 400,
        });
        return c.json(
            { ok: false, message: mapped.error.message, error: mapped.error },
            mapped.status as 400 | 401 | 403 | 404 | 409 | 422 | 500
        );
    }
});

export default businessSettingsRoute;
