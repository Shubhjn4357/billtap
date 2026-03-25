import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { businesses, businessSettings } from '../db/schema';
import { withTransaction } from '../db/transaction';
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

type SettingsAuditLog = {
    id: string;
    module: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    actorUid: string | null;
    actorRole: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    metadata: Record<string, unknown>;
    createdAt: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

const getBusinessAuditLogs = (settings: Record<string, unknown>): SettingsAuditLog[] => {
    const raw = settings.operationsAuditLogs;
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((entry): entry is SettingsAuditLog => Boolean(entry) && typeof entry === 'object')
        .map((entry) => entry as SettingsAuditLog)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

const trimAuditLogs = (logs: SettingsAuditLog[]) => logs.slice(0, 500);

const createSettingsAuditLog = (params: {
    businessId: string;
    section: string;
    action: 'SETTINGS_SECTION_UPDATED' | 'SETTINGS_SECTION_RESET';
    actorUid: string | null;
    actorRole: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
}) => ({
    id: `setlog_${nanoid(12)}`,
    module: 'settings',
    action: params.action,
    entityType: 'business_settings',
    entityId: `${params.businessId}:${params.section}`,
    actorUid: params.actorUid,
    actorRole: params.actorRole,
    before: params.before ?? null,
    after: params.after ?? null,
    metadata: {
        section: params.section,
        businessId: params.businessId,
    },
    createdAt: new Date().toISOString(),
}) satisfies SettingsAuditLog;

const appendSettingsAuditLog = async (
    db: AppEnv['Variables']['db'],
    businessId: string,
    currentSettings: Record<string, unknown>,
    entry: SettingsAuditLog
) => {
    await db.update(businesses).set({
        settings: {
            ...currentSettings,
            operationsAuditLogs: trimAuditLogs([entry, ...getBusinessAuditLogs(currentSettings)]),
        },
        updatedAt: new Date(),
    }).where(eq(businesses.id, businessId));
};

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
        const savedData = await withTransaction(db, async (tx) => {
            const now = new Date();
            const [currentBusiness] = await tx.select().from(businesses)
                .where(eq(businesses.id, business.id))
                .limit(1);
            const currentBusinessSettings = asRecord(currentBusiness?.settings ?? business.settings);

            const [existing] = await tx.select().from(businessSettings)
                .where(and(eq(businessSettings.businessId, business.id), eq(businessSettings.section, section)));

            const previousData = normalizeSettingsData(section, asRecord(existing?.dataJson));
            let nextData: Record<string, unknown>;

            if (existing) {
                const merged = { ...asRecord(existing.dataJson), ...body.data };
                nextData = normalizeSettingsData(section, merged);
                await tx.update(businessSettings)
                    .set({
                        dataJson: nextData,
                        updatedAt: now,
                    })
                    .where(and(eq(businessSettings.businessId, business.id), eq(businessSettings.section, section)));
            } else {
                nextData = normalizeSettingsData(section, body.data);
                await tx.insert(businessSettings).values({
                    id: `bset_${nanoid(16)}`,
                    businessId: business.id,
                    section,
                    dataJson: nextData,
                    updatedAt: now,
                });
            }

            await appendSettingsAuditLog(
                tx,
                business.id,
                currentBusinessSettings,
                createSettingsAuditLog({
                    businessId: business.id,
                    section,
                    action: 'SETTINGS_SECTION_UPDATED',
                    actorUid: authUser.id,
                    actorRole: c.get('organizationRole') ?? null,
                    before: previousData,
                    after: nextData,
                })
            );

            return nextData;
        });

        return c.json({ ok: true, data: savedData, section });
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

        await withTransaction(db, async (tx) => {
            const now = new Date();
            const [currentBusiness] = await tx.select().from(businesses)
                .where(eq(businesses.id, business.id))
                .limit(1);
            const currentBusinessSettings = asRecord(currentBusiness?.settings ?? business.settings);

            const [existing] = await tx.select().from(businessSettings)
                .where(and(eq(businessSettings.businessId, business.id), eq(businessSettings.section, section)));

            const previousData = normalizeSettingsData(section, asRecord(existing?.dataJson));
            const resetData = normalizeSettingsData(section, {});

            await tx.update(businessSettings)
                .set({ dataJson: {}, updatedAt: now })
                .where(and(eq(businessSettings.businessId, business.id), eq(businessSettings.section, section)));

            await appendSettingsAuditLog(
                tx,
                business.id,
                currentBusinessSettings,
                createSettingsAuditLog({
                    businessId: business.id,
                    section,
                    action: 'SETTINGS_SECTION_RESET',
                    actorUid: authUser.id,
                    actorRole: c.get('organizationRole') ?? null,
                    before: previousData,
                    after: resetData,
                })
            );
        });

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
