import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { adminAuditLogs, businesses } from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import { ensurePrimaryBusiness, getAccessibleBusiness, getRequestedBusinessId } from './helpers';

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

operationsRoute.use('/*', requireAuth);

operationsRoute.get('/access-matrix', async (c) => {
    return c.json({
        ok: true,
        matrix: {
            owner: { all: true },
            manager: { inventory: true, billing: true, reports: true },
            salesman: { billing: true, parties: true },
        },
    });
});

operationsRoute.get('/controls', async (c) => {
    const db = c.get('db');
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

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

        const business = await getAccessibleBusiness(db, authUser.id, getRequestedBusinessId(c))
            ?? await ensurePrimaryBusiness(db, authUser);
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
    return c.json({ ok: true, approvals: [] });
});

operationsRoute.post('/approvals/:id/approve', async (c) => {
    return c.json({ ok: true });
});

operationsRoute.post('/approvals/:id/reject', async (c) => {
    return c.json({ ok: true });
});

operationsRoute.get('/audit-logs', async (c) => {
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
    return c.json({ ok: true, periods: [] });
});

operationsRoute.post('/periods/lock', async (c) => {
    lockPeriodSchema.parse(await c.req.json());
    return c.json({ ok: true, id: `period_${nanoid(10)}` });
});

operationsRoute.post('/periods/:id/close', async (c) => {
    return c.json({ ok: true });
});

operationsRoute.post('/periods/:id/reopen', async (c) => {
    return c.json({ ok: true });
});

export default operationsRoute;
