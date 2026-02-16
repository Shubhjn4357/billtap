import { Hono } from 'hono';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { withTransaction } from '../db/transaction';
import { accountingPeriods, approvalRequests, auditLogs } from '../db/schema';
import type { AppEnv } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import {
    ensurePeriodUnlockedForDate,
    getBusinessControls,
    getRoleAccessMatrix,
    hasModulePermission,
    listApprovalRequests,
    setBusinessControls,
    writeAuditLog,
    type ModuleKey,
} from '../operations/controls';
import { applyStockAdjustmentInTx, createJournalEntryInTx } from '../operations/executors';

const operationsRoute = new Hono<AppEnv>();

const parseDateParam = (value: string | undefined): Date | undefined => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
};

const isOwnerOrAdmin = (role: string | null | undefined): boolean => role === 'owner' || role === 'admin';

const journalApprovalPayloadSchema = z.object({
    entryDate: z.coerce.date().optional(),
    batchNumber: z.string().optional(),
    referenceType: z.string().optional(),
    referenceId: z.string().optional(),
    narration: z.string().optional(),
    currency: z.string().optional(),
    lines: z.array(z.object({
        accountId: z.string().min(1),
        partyId: z.string().optional(),
        debit: z.number().nonnegative().default(0),
        credit: z.number().nonnegative().default(0),
        hsn: z.string().optional(),
        gstRate: z.number().nonnegative().optional(),
        taxType: z.enum(['CGST', 'SGST', 'IGST', 'CESS']).optional(),
    })).min(2),
});

const stockApprovalPayloadSchema = z.object({
    itemId: z.string().min(1),
    type: z.enum(['IN', 'OUT']),
    quantity: z.number().positive(),
    reason: z.string().optional(),
});

operationsRoute.get('/access-matrix', requireAuth, async (c) => {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const matrix = getRoleAccessMatrix(authUser);
    return c.json({
        ok: true,
        role: authUser.role ?? 'owner',
        matrix,
        moduleAccess: {
            inventory: {
                canView: hasModulePermission(authUser, 'inventory', 'view'),
                canCreate: hasModulePermission(authUser, 'inventory', 'create'),
                canUpdate: hasModulePermission(authUser, 'inventory', 'update'),
                canDelete: hasModulePermission(authUser, 'inventory', 'delete'),
                canApprove: hasModulePermission(authUser, 'inventory', 'approve'),
            },
            billing: {
                canView: hasModulePermission(authUser, 'billing', 'view'),
                canCreate: hasModulePermission(authUser, 'billing', 'create'),
                canUpdate: hasModulePermission(authUser, 'billing', 'update'),
                canDelete: hasModulePermission(authUser, 'billing', 'delete'),
                canExport: hasModulePermission(authUser, 'billing', 'export'),
            },
            accounting: {
                canView: hasModulePermission(authUser, 'accounting', 'view'),
                canCreate: hasModulePermission(authUser, 'accounting', 'create'),
                canApprove: hasModulePermission(authUser, 'accounting', 'approve'),
                canClose: hasModulePermission(authUser, 'accounting', 'close'),
            },
            admin: {
                canView: hasModulePermission(authUser, 'admin', 'view'),
                canManage: hasModulePermission(authUser, 'admin', 'update'),
            },
        },
    });
});

operationsRoute.get('/controls', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const db = c.get('db');
    const controls = await getBusinessControls(db, effectiveUserId);
    return c.json({ ok: true, controls });
});

operationsRoute.put('/controls', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!isOwnerOrAdmin(authUser.role)) {
        return c.json({ ok: false, message: 'Owner/admin access required.' }, 403);
    }

    const body = await c.req.json();
    const payload = z.object({
        makerCheckerEnabled: z.boolean().optional(),
        journalApprovalRequired: z.boolean().optional(),
        stockAdjustmentApprovalRequired: z.boolean().optional(),
        periodLockEnabled: z.boolean().optional(),
    }).parse(body);

    const db = c.get('db');
    const before = await getBusinessControls(db, effectiveUserId);
    const controls = await setBusinessControls(db, effectiveUserId, payload);
    await writeAuditLog(db, {
        userId: effectiveUserId,
        actorUid: authUser.uid,
        actorRole: authUser.role,
        module: 'admin',
        action: 'controls.updated',
        entityType: 'business_controls',
        entityId: effectiveUserId,
        before,
        after: controls,
    });

    return c.json({ ok: true, controls });
});

operationsRoute.get('/approvals', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const status = c.req.query('status') as 'pending' | 'approved' | 'rejected' | undefined;
    const module = c.req.query('module') as ModuleKey | undefined;
    const limit = Number(c.req.query('limit') || 100);
    const db = c.get('db');

    const rows = await listApprovalRequests(db, effectiveUserId, {
        status,
        module,
        requestedBy: authUser.role === 'staff' ? authUser.uid : undefined,
        limit,
    });

    return c.json({ ok: true, approvals: rows });
});

operationsRoute.post('/approvals/:id/approve', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!isOwnerOrAdmin(authUser.role)) {
            return c.json({ ok: false, message: 'Owner/admin access required.' }, 403);
        }

        const id = c.req.param('id');
        const body = await c.req.json();
        const payload = z.object({
            note: z.string().optional(),
        }).parse(body);

        const db = c.get('db');
        const result = await withTransaction(db, async (tx) => {
            const rows = await tx
                .select()
                .from(approvalRequests)
                .where(and(eq(approvalRequests.id, id), eq(approvalRequests.userId, effectiveUserId)))
                .limit(1);
            const request = rows[0];

            if (!request) throw new Error('Approval request not found.');
            if (request.status !== 'pending') throw new Error(`Approval request is already ${request.status}.`);
            if (request.requestedBy === authUser.uid) throw new Error('Maker-checker violation: requester cannot self-approve.');

            const controls = await getBusinessControls(tx, effectiveUserId);
            let approvalResult: Record<string, unknown>;

            if (request.requestType === 'JOURNAL_ENTRY') {
                const requestPayload = journalApprovalPayloadSchema.parse(request.payload);
                const effectiveDate = requestPayload.entryDate ?? new Date();
                if (controls.periodLockEnabled) {
                    await ensurePeriodUnlockedForDate(tx, effectiveUserId, effectiveDate);
                }
                const entryId = await createJournalEntryInTx(tx, effectiveUserId, requestPayload, new Date());
                approvalResult = { entryId };
                await writeAuditLog(tx, {
                    userId: effectiveUserId,
                    actorUid: authUser.uid,
                    actorRole: authUser.role,
                    module: 'accounting',
                    action: 'journal.created',
                    entityType: 'journal_entry',
                    entityId: entryId,
                    metadata: {
                        sourceApproval: request.id,
                    },
                });
            } else if (request.requestType === 'STOCK_ADJUSTMENT') {
                const requestPayload = stockApprovalPayloadSchema.parse(request.payload);
                if (controls.periodLockEnabled) {
                    await ensurePeriodUnlockedForDate(tx, effectiveUserId, new Date());
                }
                const stockResult = await applyStockAdjustmentInTx(tx, effectiveUserId, requestPayload, new Date());
                approvalResult = stockResult;
                await writeAuditLog(tx, {
                    userId: effectiveUserId,
                    actorUid: authUser.uid,
                    actorRole: authUser.role,
                    module: 'inventory',
                    action: 'stock.adjusted',
                    entityType: 'item',
                    entityId: stockResult.itemId,
                    before: { stock: stockResult.previousStock },
                    after: { stock: stockResult.newStock },
                    metadata: {
                        sourceApproval: request.id,
                        adjustmentType: requestPayload.type,
                        quantity: requestPayload.quantity,
                    },
                });
            } else {
                throw new Error(`Unsupported approval request type: ${request.requestType}`);
            }

            await tx
                .update(approvalRequests)
                .set({
                    status: 'approved',
                    reviewedBy: authUser.uid,
                    reviewedAt: new Date(),
                    reviewNote: payload.note ?? null,
                    updatedAt: new Date(),
                })
                .where(eq(approvalRequests.id, id));

            await writeAuditLog(tx, {
                userId: effectiveUserId,
                actorUid: authUser.uid,
                actorRole: authUser.role,
                module: request.module as ModuleKey,
                action: 'approval.approved',
                entityType: 'approval_request',
                entityId: request.id,
                before: { status: 'pending' },
                after: { status: 'approved', requestType: request.requestType },
                metadata: {
                    reviewedBy: authUser.uid,
                },
            });

            return approvalResult;
        });

        return c.json({ ok: true, id, status: 'approved', result });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to approve request.' }, 400);
    }
});

operationsRoute.post('/approvals/:id/reject', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!isOwnerOrAdmin(authUser.role)) {
            return c.json({ ok: false, message: 'Owner/admin access required.' }, 403);
        }

        const id = c.req.param('id');
        const body = await c.req.json();
        const payload = z.object({
            note: z.string().optional(),
        }).parse(body);

        const db = c.get('db');
        const updated = await db
            .update(approvalRequests)
            .set({
                status: 'rejected',
                reviewedBy: authUser.uid,
                reviewedAt: new Date(),
                reviewNote: payload.note ?? null,
                updatedAt: new Date(),
            })
            .where(and(eq(approvalRequests.id, id), eq(approvalRequests.userId, effectiveUserId), eq(approvalRequests.status, 'pending')))
            .returning({ id: approvalRequests.id, module: approvalRequests.module });

        if (!updated[0]) {
            return c.json({ ok: false, message: 'Pending approval request not found.' }, 404);
        }

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: updated[0].module as ModuleKey,
            action: 'approval.rejected',
            entityType: 'approval_request',
            entityId: id,
            before: { status: 'pending' },
            after: { status: 'rejected' },
        });

        return c.json({ ok: true, id, status: 'rejected' });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to reject request.' }, 400);
    }
});

operationsRoute.get('/audit-logs', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const module = c.req.query('module') as ModuleKey | undefined;
    const action = c.req.query('action');
    const actorUid = c.req.query('actorUid');
    const start = parseDateParam(c.req.query('start'));
    const end = parseDateParam(c.req.query('end'));
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 1000);

    const conditions = [eq(auditLogs.userId, effectiveUserId)];
    if (module) conditions.push(eq(auditLogs.module, module));
    if (action) conditions.push(eq(auditLogs.action, action));
    if (actorUid) conditions.push(eq(auditLogs.actorUid, actorUid));
    if (start) conditions.push(gte(auditLogs.createdAt, start));
    if (end) conditions.push(lte(auditLogs.createdAt, end));

    if (authUser.role === 'staff') {
        conditions.push(eq(auditLogs.actorUid, authUser.uid));
    }

    const db = c.get('db');
    const rows = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);

    return c.json({ ok: true, logs: rows });
});

operationsRoute.get('/periods', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);

    const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), 500);
    const db = c.get('db');
    const rows = await db
        .select()
        .from(accountingPeriods)
        .where(eq(accountingPeriods.userId, effectiveUserId))
        .orderBy(desc(accountingPeriods.periodStart))
        .limit(limit);

    return c.json({ ok: true, periods: rows });
});

operationsRoute.post('/periods/lock', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!isOwnerOrAdmin(authUser.role)) {
            return c.json({ ok: false, message: 'Owner/admin access required.' }, 403);
        }

        const body = await c.req.json();
        const payload = z.object({
            periodStart: z.coerce.date(),
            periodEnd: z.coerce.date(),
            notes: z.string().optional(),
        }).parse(body);

        if (payload.periodStart.getTime() > payload.periodEnd.getTime()) {
            return c.json({ ok: false, message: 'periodStart must be before periodEnd.' }, 400);
        }

        const db = c.get('db');
        const overlaps = await db
            .select({ id: accountingPeriods.id })
            .from(accountingPeriods)
            .where(
                and(
                    eq(accountingPeriods.userId, effectiveUserId),
                    lte(accountingPeriods.periodStart, payload.periodEnd),
                    gte(accountingPeriods.periodEnd, payload.periodStart),
                    eq(accountingPeriods.status, 'locked')
                )
            )
            .limit(1);

        if (overlaps[0]) {
            return c.json({ ok: false, message: 'Overlapping locked period already exists.' }, 409);
        }

        const id = nanoid();
        const now = new Date();
        await db.insert(accountingPeriods).values({
            id,
            userId: effectiveUserId,
            periodStart: payload.periodStart,
            periodEnd: payload.periodEnd,
            status: 'locked',
            lockedBy: authUser.uid,
            lockedAt: now,
            closedBy: null,
            closedAt: null,
            notes: payload.notes ?? null,
            createdAt: now,
            updatedAt: now,
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'accounting',
            action: 'period.locked',
            entityType: 'accounting_period',
            entityId: id,
            after: {
                periodStart: payload.periodStart.toISOString(),
                periodEnd: payload.periodEnd.toISOString(),
                status: 'locked',
            },
        });

        return c.json({ ok: true, id, status: 'locked' });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to lock period.' }, 400);
    }
});

operationsRoute.post('/periods/:id/close', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!isOwnerOrAdmin(authUser.role)) {
        return c.json({ ok: false, message: 'Owner/admin access required.' }, 403);
    }

    const id = c.req.param('id');
    const now = new Date();
    const db = c.get('db');
    const updated = await db
        .update(accountingPeriods)
        .set({
            status: 'closed',
            closedBy: authUser.uid,
            closedAt: now,
            updatedAt: now,
        })
        .where(and(eq(accountingPeriods.id, id), eq(accountingPeriods.userId, effectiveUserId)))
        .returning({ id: accountingPeriods.id });

    if (!updated[0]) return c.json({ ok: false, message: 'Accounting period not found.' }, 404);

    await writeAuditLog(db, {
        userId: effectiveUserId,
        actorUid: authUser.uid,
        actorRole: authUser.role,
        module: 'accounting',
        action: 'period.closed',
        entityType: 'accounting_period',
        entityId: id,
        after: { status: 'closed' },
    });

    return c.json({ ok: true, id, status: 'closed' });
});

operationsRoute.post('/periods/:id/reopen', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!isOwnerOrAdmin(authUser.role)) {
        return c.json({ ok: false, message: 'Owner/admin access required.' }, 403);
    }

    const id = c.req.param('id');
    const now = new Date();
    const db = c.get('db');
    const updated = await db
        .update(accountingPeriods)
        .set({
            status: 'open',
            updatedAt: now,
        })
        .where(and(eq(accountingPeriods.id, id), eq(accountingPeriods.userId, effectiveUserId)))
        .returning({ id: accountingPeriods.id });

    if (!updated[0]) return c.json({ ok: false, message: 'Accounting period not found.' }, 404);

    await writeAuditLog(db, {
        userId: effectiveUserId,
        actorUid: authUser.uid,
        actorRole: authUser.role,
        module: 'accounting',
        action: 'period.reopened',
        entityType: 'accounting_period',
        entityId: id,
        after: { status: 'open' },
    });

    return c.json({ ok: true, id, status: 'open' });
});

export default operationsRoute;
