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
    id: z.string().trim().min(1).optional(),
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

type OperationApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type OperationApproval = {
    id: string;
    actionType: 'UPDATE_CONTROLS' | 'LOCK_PERIOD' | 'CLOSE_PERIOD' | 'REOPEN_PERIOD' | 'CUSTOM';
    module: string;
    status: OperationApprovalStatus;
    payload: Record<string, unknown>;
    requestedByUserId: string | null;
    requestedByRole: string | null;
    requestedAt: string;
    reviewedByUserId: string | null;
    reviewedByRole: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
};

const parseDateInput = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const toIsoDate = (value: Date) => value.toISOString();

const normalizeControls = (settings: Record<string, unknown>) => {
    const controls = (settings.operationsControls ?? {}) as Record<string, unknown>;
    return {
        makerCheckerEnabled: Boolean(controls.makerCheckerEnabled ?? true),
        journalApprovalRequired: Boolean(controls.journalApprovalRequired ?? true),
        stockAdjustmentApprovalRequired: Boolean(controls.stockAdjustmentApprovalRequired ?? true),
        periodLockEnabled: Boolean(controls.periodLockEnabled ?? true),
    };
};

const getFinancialPeriods = (settings: Record<string, unknown>): FinancialPeriod[] => {
    const raw = settings.operationsPeriods;
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((entry): entry is FinancialPeriod => Boolean(entry) && typeof entry === 'object')
        .map((entry) => entry as FinancialPeriod);
};

const getApprovals = (settings: Record<string, unknown>): OperationApproval[] => {
    const raw = settings.operationsApprovals;
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((entry): entry is OperationApproval => Boolean(entry) && typeof entry === 'object')
        .map((entry) => entry as OperationApproval)
        .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
};

const upsertApprovals = async (
    db: DrizzleClient,
    businessId: string,
    currentSettings: Record<string, unknown>,
    approvals: OperationApproval[]
) => {
    await db.update(businesses).set({
        settings: {
            ...currentSettings,
            operationsApprovals: approvals,
        },
        updatedAt: new Date(),
    }).where(eq(businesses.id, businessId));
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

const appendApproval = async (
    db: DrizzleClient,
    businessId: string,
    currentSettings: Record<string, unknown>,
    approval: OperationApproval
) => {
    const currentApprovals = getApprovals(currentSettings);
    await upsertApprovals(db, businessId, currentSettings, [approval, ...currentApprovals]);
};

const applyApprovalSideEffect = async (params: {
    db: DrizzleClient;
    businessId: string;
    currentSettings: Record<string, unknown>;
    approval: OperationApproval;
}) => {
    const { db, businessId, currentSettings, approval } = params;
    const now = new Date().toISOString();

    if (approval.actionType === 'UPDATE_CONTROLS') {
        const payload = approval.payload;
        const nextControls = {
            makerCheckerEnabled: Boolean(payload.makerCheckerEnabled ?? true),
            journalApprovalRequired: Boolean(payload.journalApprovalRequired ?? true),
            stockAdjustmentApprovalRequired: Boolean(payload.stockAdjustmentApprovalRequired ?? true),
            periodLockEnabled: Boolean(payload.periodLockEnabled ?? true),
        };
        await db.update(businesses).set({
            settings: {
                ...currentSettings,
                operationsControls: nextControls,
            },
            updatedAt: new Date(),
        }).where(eq(businesses.id, businessId));
        return;
    }

    if (approval.actionType === 'LOCK_PERIOD') {
        const payload = approval.payload;
        const start = parseDateInput(typeof payload.periodStart === 'string' ? payload.periodStart : undefined) ?? new Date();
        const end = parseDateInput(typeof payload.periodEnd === 'string' ? payload.periodEnd : undefined) ?? start;
        const periods = getFinancialPeriods(currentSettings);
        const nextPeriod: FinancialPeriod = {
            id:
                typeof payload.id === 'string' && payload.id.trim().length > 0
                    ? payload.id.trim()
                    : `period_${nanoid(12)}`,
            periodStart: toIsoDate(start),
            periodEnd: toIsoDate(end),
            status: 'LOCKED',
            notes: typeof payload.notes === 'string' ? payload.notes : null,
            lockedAt: now,
            closedAt: null,
            reopenedAt: null,
            createdAt: now,
            updatedAt: now,
        };
        await upsertFinancialPeriods(db, businessId, currentSettings, [nextPeriod, ...periods]);
        return;
    }

    if (approval.actionType === 'CLOSE_PERIOD' || approval.actionType === 'REOPEN_PERIOD') {
        const periodId = typeof approval.payload.periodId === 'string' ? approval.payload.periodId : '';
        if (!periodId) return;
        const periods = getFinancialPeriods(currentSettings);
        const idx = periods.findIndex((entry) => entry.id === periodId);
        if (idx < 0) return;
        const targetStatus: PeriodStatus = approval.actionType === 'CLOSE_PERIOD' ? 'CLOSED' : 'OPEN';
        const updated = {
            ...periods[idx],
            status: targetStatus,
            ...(targetStatus === 'CLOSED' ? { closedAt: now } : { reopenedAt: now }),
            updatedAt: now,
        };
        const next = [...periods];
        next[idx] = updated;
        await upsertFinancialPeriods(db, businessId, currentSettings, next);
    }
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
    return c.json({
        ok: true,
        controls: normalizeControls(settings),
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
        const currentControls = normalizeControls(currentSettings);
        const nextControls = {
            makerCheckerEnabled: payload.makerCheckerEnabled ?? currentControls.makerCheckerEnabled,
            journalApprovalRequired: payload.journalApprovalRequired ?? currentControls.journalApprovalRequired,
            stockAdjustmentApprovalRequired: payload.stockAdjustmentApprovalRequired ?? currentControls.stockAdjustmentApprovalRequired,
            periodLockEnabled: payload.periodLockEnabled ?? currentControls.periodLockEnabled,
        };
        const requiresApproval = Boolean(currentControls.makerCheckerEnabled)
            && c.get('organizationRole') !== 'owner';

        if (requiresApproval) {
            const approval: OperationApproval = {
                id: `opr_apr_${nanoid(12)}`,
                actionType: 'UPDATE_CONTROLS',
                module: 'operations',
                status: 'PENDING',
                payload: nextControls as Record<string, unknown>,
                requestedByUserId: authUser.id,
                requestedByRole: c.get('organizationRole') ?? null,
                requestedAt: new Date().toISOString(),
                reviewedByUserId: null,
                reviewedByRole: null,
                reviewedAt: null,
                reviewNote: null,
            };
            await appendApproval(db, business.id, currentSettings, approval);
            return c.json({ ok: true, approvalId: approval.id, status: 'PENDING_APPROVAL' });
        }

        await db.update(businesses).set({
            settings: {
                ...currentSettings,
                operationsControls: nextControls,
            },
            updatedAt: new Date(),
        }).where(eq(businesses.id, business.id));

        return c.json({ ok: true, controls: nextControls });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update controls.' }, 400);
    }
});

operationsRoute.get('/approvals', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    const denied = requireOrganizationCapability(c, 'operations.read');
    if (denied) return denied;

    const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
        ?? await ensurePrimaryBusiness(db, authUser);
    const settings = (business.settings ?? {}) as Record<string, unknown>;
    const statusFilter = c.req.query('status')?.toUpperCase();
    const approvals = getApprovals(settings).filter((entry) =>
        statusFilter ? entry.status === statusFilter : true
    );

    return c.json({ ok: true, approvals });
});

operationsRoute.post('/approvals', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationCapability(c, 'operations.write');
        if (denied) return denied;

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);
        const payload = z.object({
            actionType: z.enum(['UPDATE_CONTROLS', 'LOCK_PERIOD', 'CLOSE_PERIOD', 'REOPEN_PERIOD', 'CUSTOM']),
            module: z.string().trim().default('operations'),
            payload: z.record(z.string(), z.unknown()).default({}),
            approvalId: z.string().trim().min(1).optional(),
        }).parse(await c.req.json());

        const settings = (business.settings ?? {}) as Record<string, unknown>;
        const approval: OperationApproval = {
            id: payload.approvalId?.trim() || `opr_apr_${nanoid(12)}`,
            actionType: payload.actionType,
            module: payload.module,
            status: 'PENDING',
            payload: payload.payload,
            requestedByUserId: authUser.id,
            requestedByRole: c.get('organizationRole') ?? null,
            requestedAt: new Date().toISOString(),
            reviewedByUserId: null,
            reviewedByRole: null,
            reviewedAt: null,
            reviewNote: null,
        };

        await appendApproval(db, business.id, settings, approval);
        return c.json({ ok: true, approvalId: approval.id });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create approval.' }, 400);
    }
});

operationsRoute.post('/approvals/:id/approve', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationCapability(c, 'operations.write');
        if (denied) return denied;

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);
        const settings = (business.settings ?? {}) as Record<string, unknown>;
        const approvalId = c.req.param('id');
        const approvals = getApprovals(settings);
        const index = approvals.findIndex((entry) => entry.id === approvalId);
        if (index < 0) return c.json({ ok: false, message: 'Approval not found.' }, 404);

        const current = approvals[index];
        if (current.status !== 'PENDING') {
            return c.json({ ok: false, message: 'Approval is already finalized.' }, 400);
        }

        await applyApprovalSideEffect({
            db,
            businessId: business.id,
            currentSettings: settings,
            approval: current,
        });

        const refreshedBusinessRows = await db.select().from(businesses).where(eq(businesses.id, business.id)).limit(1);
        const refreshedSettings = (refreshedBusinessRows[0]?.settings ?? settings) as Record<string, unknown>;

        const updated: OperationApproval = {
            ...current,
            status: 'APPROVED',
            reviewedByUserId: authUser.id,
            reviewedByRole: c.get('organizationRole') ?? null,
            reviewedAt: new Date().toISOString(),
            reviewNote: null,
        };
        const nextApprovals = [...approvals];
        nextApprovals[index] = updated;
        await upsertApprovals(db, business.id, refreshedSettings, nextApprovals);

        return c.json({ ok: true, approval: updated });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to approve request.' }, 400);
    }
});

operationsRoute.post('/approvals/:id/reject', async (c) => {
    try {
        const db = c.get('db');
        const authUser = c.get('authUser');
        if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        const denied = requireOrganizationCapability(c, 'operations.write');
        if (denied) return denied;

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);
        const settings = (business.settings ?? {}) as Record<string, unknown>;
        const approvalId = c.req.param('id');
        const notePayload = z.object({ note: z.string().trim().optional() }).safeParse(await c.req.json().catch(() => ({})));
        const reviewNote = notePayload.success ? (notePayload.data.note ?? null) : null;

        const approvals = getApprovals(settings);
        const index = approvals.findIndex((entry) => entry.id === approvalId);
        if (index < 0) return c.json({ ok: false, message: 'Approval not found.' }, 404);
        if (approvals[index].status !== 'PENDING') {
            return c.json({ ok: false, message: 'Approval is already finalized.' }, 400);
        }

        const updated: OperationApproval = {
            ...approvals[index],
            status: 'REJECTED',
            reviewedByUserId: authUser.id,
            reviewedByRole: c.get('organizationRole') ?? null,
            reviewedAt: new Date().toISOString(),
            reviewNote,
        };
        const next = [...approvals];
        next[index] = updated;
        await upsertApprovals(db, business.id, settings, next);

        return c.json({ ok: true, approval: updated });
    } catch (error) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to reject request.' }, 400);
    }
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
        const controls = normalizeControls(settings);
        const requiresApproval = Boolean(controls.makerCheckerEnabled)
            && c.get('organizationRole') !== 'owner';

        if (requiresApproval) {
            const approval: OperationApproval = {
                id: `opr_apr_${nanoid(12)}`,
                actionType: 'LOCK_PERIOD',
                module: 'operations',
                status: 'PENDING',
                payload: payload,
                requestedByUserId: authUser.id,
                requestedByRole: c.get('organizationRole') ?? null,
                requestedAt: new Date().toISOString(),
                reviewedByUserId: null,
                reviewedByRole: null,
                reviewedAt: null,
                reviewNote: null,
            };
            await appendApproval(db, business.id, settings, approval);
            return c.json({ ok: true, approvalId: approval.id, status: 'PENDING_APPROVAL' });
        }

        const current = getFinancialPeriods(settings);
        const now = new Date().toISOString();

        const id = payload.id?.trim() || `period_${nanoid(12)}`;
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
        const controls = normalizeControls(settings);
        const requiresApproval = Boolean(controls.makerCheckerEnabled)
            && c.get('organizationRole') !== 'owner';
        if (requiresApproval) {
            const approval: OperationApproval = {
                id: `opr_apr_${nanoid(12)}`,
                actionType: 'CLOSE_PERIOD',
                module: 'operations',
                status: 'PENDING',
                payload: { periodId },
                requestedByUserId: authUser.id,
                requestedByRole: c.get('organizationRole') ?? null,
                requestedAt: new Date().toISOString(),
                reviewedByUserId: null,
                reviewedByRole: null,
                reviewedAt: null,
                reviewNote: null,
            };
            await appendApproval(db, business.id, settings, approval);
            return c.json({ ok: true, approvalId: approval.id, status: 'PENDING_APPROVAL' });
        }
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
        const controls = normalizeControls(settings);
        const requiresApproval = Boolean(controls.makerCheckerEnabled)
            && c.get('organizationRole') !== 'owner';
        if (requiresApproval) {
            const approval: OperationApproval = {
                id: `opr_apr_${nanoid(12)}`,
                actionType: 'REOPEN_PERIOD',
                module: 'operations',
                status: 'PENDING',
                payload: { periodId },
                requestedByUserId: authUser.id,
                requestedByRole: c.get('organizationRole') ?? null,
                requestedAt: new Date().toISOString(),
                reviewedByUserId: null,
                reviewedByRole: null,
                reviewedAt: null,
                reviewNote: null,
            };
            await appendApproval(db, business.id, settings, approval);
            return c.json({ ok: true, approvalId: approval.id, status: 'PENDING_APPROVAL' });
        }
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
