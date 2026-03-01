import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { adminAuditLogs, businesses } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import type { DrizzleClient } from '../db/client';
import {
    ensurePrimaryBusiness,
    getAccessibleBusiness,
    getActiveSubscription,
    getRequestedBusinessId,
    requireOrganizationCapability,
} from './helpers';
import { assertModuleEnabled, assertSubscriptionWriteAllowed } from '../services/subscriptionPolicy';

const operationsRoute = new Hono<AppEnv>();

const controlsSchema = z.object({
    makerCheckerEnabled: z.boolean().optional(),
    journalApprovalRequired: z.boolean().optional(),
    stockAdjustmentApprovalRequired: z.boolean().optional(),
    periodLockEnabled: z.boolean().optional(),
});

const lockPeriodSchema = z.object({
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    notes: z.string().optional(),
});

type PeriodStatus = 'OPEN' | 'LOCKED' | 'CLOSED';

type FinancialPeriod = {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: PeriodStatus;
    notes: string | null;
    lockedAt: string | null;
    closedAt: string | null;
    reopenedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

const parseDateInput = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const toIsoDate = (value: Date) => value.toISOString();

const getFinancialPeriods = (settings: Record<string, unknown>): FinancialPeriod[] => {
    const raw = settings.operationsPeriods;
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((entry): entry is FinancialPeriod => Boolean(entry) && typeof entry === 'object')
        .map((entry) => entry as FinancialPeriod);
};

const upsertFinancialPeriods = async (
    db: DrizzleClient,
    businessId: string,
    currentSettings: Record<string, unknown>,
    periods: FinancialPeriod[]
) => {
    await db.update(businesses).set({
        settings: {
            ...currentSettings,
            operationsPeriods: periods,
        },
        updatedAt: new Date(),
    }).where(eq(businesses.id, businessId));
};

operationsRoute.use('/*', requireAuth);

operationsRoute.get('/access-matrix', async (c) => {
    const denied = requireOrganizationCapability(c, 'operations.read');
    if (denied) return denied;

    return c.json({
        ok: true,
        matrix: {
            owner: { all: true, settings: true, operations: true },
            manager: {
                billing: true,
                inventory: true,
                parties: true,
                reports: true,
                accounts: true,
                expenses: true,
                cashBank: true,
                loans: true,
                settingsRead: true,
                operationsRead: true,
            },
            salesman: {
                billing: true,
                pos: true,
                parties: true,
                inventoryRead: true,
                reportsRead: true,
                expensesRead: true,
                cashBankRead: true,
                loansRead: true,
            },
        },
    });
});

operationsRoute.get('/controls', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'operations.read');
    if (denied) return denied;

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const settings = (business.settings ?? {}) as Record<string, unknown>;
    const controls = (settings.operationsControls ?? {}) as Record<string, unknown>;

    return c.json({
        ok: true,
        controls: {
            makerCheckerEnabled: Boolean(controls.makerCheckerEnabled ?? true),
            journalApprovalRequired: Boolean(controls.journalApprovalRequired ?? true),
            stockAdjustmentApprovalRequired: Boolean(controls.stockAdjustmentApprovalRequired ?? true),
            periodLockEnabled: Boolean(controls.periodLockEnabled ?? true),
        },
    });
});

operationsRoute.put('/controls', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationCapability(c, 'operations.write');
        if (denied) return denied;

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'settings');
        const payload = controlsSchema.parse(await c.req.json());

        const currentSettings = (business.settings ?? {}) as Record<string, unknown>;
        const nextSettings = {
            ...currentSettings,
            operationsControls: {
                makerCheckerEnabled: payload.makerCheckerEnabled ?? true,
                journalApprovalRequired: payload.journalApprovalRequired ?? true,
                stockAdjustmentApprovalRequired: payload.stockAdjustmentApprovalRequired ?? true,
                periodLockEnabled: payload.periodLockEnabled ?? true,
            },
        };

        await db.update(businesses).set({
            settings: nextSettings,
            updatedAt: new Date(),
        }).where(eq(businesses.id, business.id));

        return c.json({ ok: true, controls: nextSettings.operationsControls });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update controls.' }, 400);
    }
});

operationsRoute.get('/approvals', async (c) => {
    const denied = requireOrganizationCapability(c, 'operations.read');
    if (denied) return denied;
    return c.json({ ok: true, approvals: [] });
});

operationsRoute.post('/approvals/:id/approve', async (c) => {
    const denied = requireOrganizationCapability(c, 'operations.write');
    if (denied) return denied;
    return c.json({ ok: true });
});

operationsRoute.post('/approvals/:id/reject', async (c) => {
    const denied = requireOrganizationCapability(c, 'operations.write');
    if (denied) return denied;
    return c.json({ ok: true });
});

operationsRoute.get('/audit-logs', async (c) => {
    const denied = requireOrganizationCapability(c, 'operations.read');
    if (denied) return denied;

    const db = c.get('db');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 500);
    const rows = await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit);

    return c.json({
        ok: true,
        logs: rows.map((entry) => ({
            id: entry.id,
            module: 'admin',
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            actorUid: entry.adminEmail,
            actorRole: entry.adminRole,
            before: null,
            after: null,
            metadata: entry.metadataJson,
            createdAt: entry.createdAt,
        })),
    });
});

operationsRoute.get('/periods', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'operations.read');
    if (denied) return denied;

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const settings = (business.settings ?? {}) as Record<string, unknown>;
    const periods = getFinancialPeriods(settings)
        .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));

    return c.json({ ok: true, periods });
});

operationsRoute.post('/periods/lock', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationCapability(c, 'operations.write');
        if (denied) return denied;

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'settings');

        const payload = lockPeriodSchema.parse(await c.req.json());
        const start = parseDateInput(payload.periodStart) ?? new Date();
        const end = parseDateInput(payload.periodEnd) ?? start;
        if (start.getTime() > end.getTime()) {
            return c.json({ ok: false, message: 'periodStart must be <= periodEnd.' }, 400);
        }

        const settings = (business.settings ?? {}) as Record<string, unknown>;
        const current = getFinancialPeriods(settings);
        const now = new Date().toISOString();

        const id = `period_${nanoid(12)}`;
        const nextPeriod: FinancialPeriod = {
            id,
            periodStart: toIsoDate(start),
            periodEnd: toIsoDate(end),
            status: 'LOCKED',
            notes: payload.notes?.trim() ?? null,
            lockedAt: now,
            closedAt: null,
            reopenedAt: null,
            createdAt: now,
            updatedAt: now,
        };

        await upsertFinancialPeriods(db, business.id, settings, [nextPeriod, ...current]);
        return c.json({ ok: true, id, period: nextPeriod });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to lock period.' }, 400);
    }
});

operationsRoute.post('/periods/:id/close', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationCapability(c, 'operations.write');
        if (denied) return denied;

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'settings');

        const periodId = c.req.param('id');
        const settings = (business.settings ?? {}) as Record<string, unknown>;
        const current = getFinancialPeriods(settings);
        const now = new Date().toISOString();
        const idx = current.findIndex((entry) => entry.id === periodId);
        if (idx < 0) return c.json({ ok: false, message: 'Period not found.' }, 404);

        const updated = {
            ...current[idx],
            status: 'CLOSED' as const,
            closedAt: now,
            updatedAt: now,
        };
        const next = [...current];
        next[idx] = updated;

        await upsertFinancialPeriods(db, business.id, settings, next);
        return c.json({ ok: true, period: updated });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to close period.' }, 400);
    }
});

operationsRoute.post('/periods/:id/reopen', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationCapability(c, 'operations.write');
        if (denied) return denied;

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);
        const subscription = await getActiveSubscription(db, business.id);
        assertSubscriptionWriteAllowed(subscription);
        assertModuleEnabled(business, 'settings');

        const periodId = c.req.param('id');
        const settings = (business.settings ?? {}) as Record<string, unknown>;
        const current = getFinancialPeriods(settings);
        const now = new Date().toISOString();
        const idx = current.findIndex((entry) => entry.id === periodId);
        if (idx < 0) return c.json({ ok: false, message: 'Period not found.' }, 404);

        const updated = {
            ...current[idx],
            status: 'OPEN' as const,
            reopenedAt: now,
            updatedAt: now,
        };
        const next = [...current];
        next[idx] = updated;

        await upsertFinancialPeriods(db, business.id, settings, next);
        return c.json({ ok: true, period: updated });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to reopen period.' }, 400);
    }
});

export default operationsRoute;
