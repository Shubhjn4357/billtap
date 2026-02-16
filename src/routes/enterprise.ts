import { Hono } from 'hono';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { withTransaction } from '../db/transaction';
import {
    branchTransfers,
    branches,
    costCenters,
    inventoryMovements,
    items,
    projects,
    transactions,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    ensurePeriodUnlockedForDate,
    getBusinessControls,
    hasModulePermission,
    writeAuditLog,
} from '../operations/controls';
import { withOrganizationContext } from '../middleware/permissions';

const enterpriseRoute = new Hono<AppEnv>();

const parseDateQuery = (value?: string | null): Date | undefined => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
};

const roundAmount = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

enterpriseRoute.get('/branches', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'admin', 'view') && !hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Branch access denied.' }, 403);
    }

    const db = c.get('db');
    const rows = await db
        .select()
        .from(branches)
        .where(eq(branches.userId, effectiveUserId))
        .orderBy(desc(branches.isPrimary), asc(branches.name));

    return c.json({ ok: true, branches: rows });
});

enterpriseRoute.post('/branches', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'admin', 'create')) {
            return c.json({ ok: false, message: 'Branch create access denied.' }, 403);
        }

        const payload = z.object({
            name: z.string().min(1).max(120),
            code: z.string().min(1).max(32),
            address: z.string().optional(),
            isPrimary: z.boolean().default(false),
            isActive: z.boolean().default(true),
        }).parse(await c.req.json());

        const db = c.get('db');
        const now = new Date();
        const id = nanoid();

        if (payload.isPrimary) {
            await db
                .update(branches)
                .set({ isPrimary: false, updatedAt: now })
                .where(eq(branches.userId, effectiveUserId));
        }

        await db.insert(branches).values({
            id,
            userId: effectiveUserId,
            name: payload.name.trim(),
            code: payload.code.trim().toUpperCase(),
            address: payload.address?.trim() || null,
            isPrimary: payload.isPrimary,
            isActive: payload.isActive,
            createdAt: now,
            updatedAt: now,
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'admin',
            action: 'enterprise.branch_created',
            entityType: 'branch',
            entityId: id,
            after: {
                code: payload.code,
                isPrimary: payload.isPrimary,
            },
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create branch.' }, 400);
    }
});

enterpriseRoute.patch('/branches/:id', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'admin', 'update')) {
            return c.json({ ok: false, message: 'Branch update access denied.' }, 403);
        }

        const id = c.req.param('id');
        const payload = z.object({
            name: z.string().min(1).max(120).optional(),
            code: z.string().min(1).max(32).optional(),
            address: z.string().optional(),
            isPrimary: z.boolean().optional(),
            isActive: z.boolean().optional(),
        }).parse(await c.req.json());

        const db = c.get('db');
        const now = new Date();
        if (payload.isPrimary === true) {
            await db
                .update(branches)
                .set({ isPrimary: false, updatedAt: now })
                .where(eq(branches.userId, effectiveUserId));
        }

        const updatePayload: Partial<typeof branches.$inferInsert> = {
            updatedAt: now,
        };
        if (payload.name !== undefined) updatePayload.name = payload.name.trim();
        if (payload.code !== undefined) updatePayload.code = payload.code.trim().toUpperCase();
        if (payload.address !== undefined) updatePayload.address = payload.address?.trim() || null;
        if (payload.isPrimary !== undefined) updatePayload.isPrimary = payload.isPrimary;
        if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

        const updated = await db
            .update(branches)
            .set(updatePayload)
            .where(and(eq(branches.id, id), eq(branches.userId, effectiveUserId)))
            .returning({ id: branches.id });

        if (!updated[0]) return c.json({ ok: false, message: 'Branch not found.' }, 404);
        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update branch.' }, 400);
    }
});

enterpriseRoute.get('/cost-centers', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Cost center access denied.' }, 403);
    }

    const db = c.get('db');
    const rows = await db
        .select()
        .from(costCenters)
        .where(eq(costCenters.userId, effectiveUserId))
        .orderBy(asc(costCenters.code));

    return c.json({ ok: true, costCenters: rows });
});

enterpriseRoute.post('/cost-centers', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'create')) {
            return c.json({ ok: false, message: 'Cost center create access denied.' }, 403);
        }

        const payload = z.object({
            code: z.string().min(1).max(32),
            name: z.string().min(1).max(120),
            isActive: z.boolean().default(true),
        }).parse(await c.req.json());

        const id = nanoid();
        const now = new Date();
        const db = c.get('db');
        await db.insert(costCenters).values({
            id,
            userId: effectiveUserId,
            code: payload.code.trim().toUpperCase(),
            name: payload.name.trim(),
            isActive: payload.isActive,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create cost center.' }, 400);
    }
});

enterpriseRoute.patch('/cost-centers/:id', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'update')) {
            return c.json({ ok: false, message: 'Cost center update access denied.' }, 403);
        }

        const id = c.req.param('id');
        const payload = z.object({
            code: z.string().min(1).max(32).optional(),
            name: z.string().min(1).max(120).optional(),
            isActive: z.boolean().optional(),
        }).parse(await c.req.json());

        const updatePayload: Partial<typeof costCenters.$inferInsert> = {
            updatedAt: new Date(),
        };
        if (payload.code !== undefined) updatePayload.code = payload.code.trim().toUpperCase();
        if (payload.name !== undefined) updatePayload.name = payload.name.trim();
        if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

        const db = c.get('db');
        const updated = await db
            .update(costCenters)
            .set(updatePayload)
            .where(and(eq(costCenters.id, id), eq(costCenters.userId, effectiveUserId)))
            .returning({ id: costCenters.id });

        if (!updated[0]) return c.json({ ok: false, message: 'Cost center not found.' }, 404);
        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update cost center.' }, 400);
    }
});

enterpriseRoute.get('/projects', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Project access denied.' }, 403);
    }

    const db = c.get('db');
    const rows = await db
        .select()
        .from(projects)
        .where(eq(projects.userId, effectiveUserId))
        .orderBy(asc(projects.code));

    return c.json({ ok: true, projects: rows });
});

enterpriseRoute.post('/projects', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'create')) {
            return c.json({ ok: false, message: 'Project create access denied.' }, 403);
        }

        const payload = z.object({
            code: z.string().min(1).max(32),
            name: z.string().min(1).max(120),
            isActive: z.boolean().default(true),
        }).parse(await c.req.json());

        const db = c.get('db');
        const now = new Date();
        const id = nanoid();
        await db.insert(projects).values({
            id,
            userId: effectiveUserId,
            code: payload.code.trim().toUpperCase(),
            name: payload.name.trim(),
            isActive: payload.isActive,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create project.' }, 400);
    }
});

enterpriseRoute.patch('/projects/:id', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'update')) {
            return c.json({ ok: false, message: 'Project update access denied.' }, 403);
        }

        const id = c.req.param('id');
        const payload = z.object({
            code: z.string().min(1).max(32).optional(),
            name: z.string().min(1).max(120).optional(),
            isActive: z.boolean().optional(),
        }).parse(await c.req.json());

        const updatePayload: Partial<typeof projects.$inferInsert> = {
            updatedAt: new Date(),
        };
        if (payload.code !== undefined) updatePayload.code = payload.code.trim().toUpperCase();
        if (payload.name !== undefined) updatePayload.name = payload.name.trim();
        if (payload.isActive !== undefined) updatePayload.isActive = payload.isActive;

        const db = c.get('db');
        const updated = await db
            .update(projects)
            .set(updatePayload)
            .where(and(eq(projects.id, id), eq(projects.userId, effectiveUserId)))
            .returning({ id: projects.id });

        if (!updated[0]) return c.json({ ok: false, message: 'Project not found.' }, 404);
        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update project.' }, 400);
    }
});

enterpriseRoute.get('/branch-transfers', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'inventory', 'view')) {
        return c.json({ ok: false, message: 'Branch transfer access denied.' }, 403);
    }

    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 2000);
    const db = c.get('db');
    const rows = await db
        .select()
        .from(branchTransfers)
        .where(eq(branchTransfers.userId, effectiveUserId))
        .orderBy(desc(branchTransfers.transferDate))
        .limit(limit);

    return c.json({ ok: true, transfers: rows });
});

enterpriseRoute.post('/branch-transfers', requireAuth, withOrganizationContext, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const organizationId = c.get('organizationId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !organizationId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'inventory', 'create')) {
            return c.json({ ok: false, message: 'Branch transfer create access denied.' }, 403);
        }

        const payload = z.object({
            fromBranchId: z.string().min(1),
            toBranchId: z.string().min(1),
            itemId: z.string().min(1),
            quantity: z.number().positive(),
            unitCost: z.number().nonnegative().default(0),
            transferDate: z.coerce.date().optional(),
            referenceNote: z.string().optional(),
        }).parse(await c.req.json());

        if (payload.fromBranchId === payload.toBranchId) {
            return c.json({ ok: false, message: 'fromBranchId and toBranchId must be different.' }, 400);
        }

        const db = c.get('db');
        const transferDate = payload.transferDate ?? new Date();
        const controls = await getBusinessControls(db, effectiveUserId);
        if (controls.periodLockEnabled) {
            await ensurePeriodUnlockedForDate(db, effectiveUserId, transferDate);
        }

        const now = new Date();
        const transferId = nanoid();

        const result = await withTransaction(db, async (tx) => {
            const sourceRows = await tx
                .select()
                .from(items)
                .where(and(
                    eq(items.id, payload.itemId),
                    eq(items.userId, effectiveUserId),
                    eq(items.organizationId, organizationId),
                    eq(items.branchId, payload.fromBranchId)
                ))
                .limit(1);
            const sourceItem = sourceRows[0];
            if (!sourceItem) {
                throw new Error('Source item not found for the selected branch.');
            }
            if (Number(sourceItem.stock ?? 0) < payload.quantity) {
                throw new Error(`Insufficient stock in source branch. Available: ${sourceItem.stock}`);
            }

            const updatedSourceRows = await tx
                .update(items)
                .set({
                    stock: Number(sourceItem.stock ?? 0) - payload.quantity,
                    updatedAt: now,
                })
                .where(and(
                    eq(items.id, sourceItem.id),
                    eq(items.userId, effectiveUserId),
                    eq(items.organizationId, organizationId)
                ))
                .returning({ id: items.id, stock: items.stock });
            const sourceAfter = Number(updatedSourceRows[0]?.stock ?? 0);

            const destinationRows = await tx
                .select()
                .from(items)
                .where(and(
                    eq(items.userId, effectiveUserId),
                    eq(items.organizationId, organizationId),
                    eq(items.branchId, payload.toBranchId),
                    eq(items.nameLowercase, sourceItem.nameLowercase)
                ))
                .limit(1);

            let destinationItem = destinationRows[0];
            if (!destinationItem) {
                const destinationItemId = nanoid();
                await tx.insert(items).values({
                    id: destinationItemId,
                    userId: effectiveUserId,
                    organizationId,
                    branchId: payload.toBranchId,
                    name: sourceItem.name,
                    nameLowercase: sourceItem.nameLowercase,
                    price: sourceItem.price,
                    purchasePrice: sourceItem.purchasePrice,
                    mrp: sourceItem.mrp,
                    hsn: sourceItem.hsn,
                    gstPercentage: sourceItem.gstPercentage,
                    stock: 0,
                    minimumStock: sourceItem.minimumStock,
                    openingStock: 0,
                    unit: sourceItem.unit,
                    category: sourceItem.category,
                    subcategory: sourceItem.subcategory,
                    location: sourceItem.location,
                    barcode: sourceItem.barcode,
                    expiresAt: sourceItem.expiresAt,
                    autoDeleteAt: sourceItem.autoDeleteAt,
                    autoDeleteEnabled: sourceItem.autoDeleteEnabled,
                    isActive: sourceItem.isActive,
                    createdAt: now,
                    updatedAt: now,
                });

                const createdDestinationRows = await tx
                    .select()
                    .from(items)
                    .where(and(
                        eq(items.id, destinationItemId),
                        eq(items.userId, effectiveUserId),
                        eq(items.organizationId, organizationId)
                    ))
                    .limit(1);
                destinationItem = createdDestinationRows[0];
            }

            if (!destinationItem) {
                throw new Error('Failed to prepare destination item for transfer.');
            }

            const updatedDestinationRows = await tx
                .update(items)
                .set({
                    stock: Number(destinationItem.stock ?? 0) + payload.quantity,
                    updatedAt: now,
                })
                .where(and(
                    eq(items.id, destinationItem.id),
                    eq(items.userId, effectiveUserId),
                    eq(items.organizationId, organizationId)
                ))
                .returning({ id: items.id, stock: items.stock });
            const destinationAfter = Number(updatedDestinationRows[0]?.stock ?? 0);

            await tx.insert(branchTransfers).values({
                id: transferId,
                userId: effectiveUserId,
                fromBranchId: payload.fromBranchId,
                toBranchId: payload.toBranchId,
                itemId: sourceItem.id,
                quantity: payload.quantity,
                unitCost: payload.unitCost,
                transferDate,
                status: 'completed',
                referenceNote: payload.referenceNote ?? null,
                createdBy: authUser.uid,
                createdAt: now,
                updatedAt: now,
            });

            await tx.insert(inventoryMovements).values([
                {
                    id: nanoid(),
                    userId: effectiveUserId,
                    branchId: payload.fromBranchId,
                    itemId: sourceItem.id,
                    transactionId: transferId,
                    movementType: 'TRANSFER_OUT',
                    quantity: payload.quantity,
                    balanceAfter: sourceAfter,
                    unitCost: payload.unitCost,
                    createdAt: now,
                },
                {
                    id: nanoid(),
                    userId: effectiveUserId,
                    branchId: payload.toBranchId,
                    itemId: destinationItem.id,
                    transactionId: transferId,
                    movementType: 'TRANSFER_IN',
                    quantity: payload.quantity,
                    balanceAfter: destinationAfter,
                    unitCost: payload.unitCost,
                    createdAt: now,
                },
            ]);

            return {
                sourceItemId: sourceItem.id,
                destinationItemId: destinationItem.id,
                sourceAfter,
                destinationAfter,
            };
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'inventory',
            action: 'enterprise.branch_transfer_created',
            entityType: 'branch_transfer',
            entityId: transferId,
            after: {
                fromBranchId: payload.fromBranchId,
                toBranchId: payload.toBranchId,
                itemId: payload.itemId,
                quantity: payload.quantity,
                estimatedValue: roundAmount(payload.quantity * payload.unitCost),
            },
        });

        return c.json({
            ok: true,
            id: transferId,
            accountingImpact: {
                estimatedValue: roundAmount(payload.quantity * payload.unitCost),
                note: 'Inventory moved between branches. Stock ledgers updated for both branches.',
            },
            stock: result,
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create branch transfer.' }, 400);
    }
});

enterpriseRoute.get('/reports/consolidated', requireAuth, withOrganizationContext, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const organizationId = c.get('organizationId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !organizationId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Consolidated report access denied.' }, 403);
    }

    const start = parseDateQuery(c.req.query('start'));
    const end = parseDateQuery(c.req.query('end'));
    const db = c.get('db');

    const branchRows = await db
        .select()
        .from(branches)
        .where(eq(branches.userId, effectiveUserId))
        .orderBy(asc(branches.name));

    const transactionConditions = [eq(transactions.userId, effectiveUserId), eq(transactions.organizationId, organizationId)];
    if (start) transactionConditions.push(gte(transactions.billDate, start));
    if (end) transactionConditions.push(lte(transactions.billDate, end));

    const transactionRows = await db
        .select({
            branchId: transactions.branchId,
            type: transactions.type,
            totalAmount: transactions.totalAmount,
            paidAmount: transactions.paidAmount,
        })
        .from(transactions)
        .where(and(...transactionConditions));

    const itemRows = await db
        .select({
            branchId: items.branchId,
            stock: items.stock,
            purchasePrice: items.purchasePrice,
            isActive: items.isActive,
        })
        .from(items)
        .where(and(eq(items.userId, effectiveUserId), eq(items.organizationId, organizationId)));

    const summaryMap = new Map<string, {
        branchId: string | null;
        sales: number;
        purchases: number;
        receipts: number;
        stockValue: number;
        itemCount: number;
    }>();

    for (const branch of branchRows) {
        summaryMap.set(branch.id, {
            branchId: branch.id,
            sales: 0,
            purchases: 0,
            receipts: 0,
            stockValue: 0,
            itemCount: 0,
        });
    }
    summaryMap.set('__unassigned__', {
        branchId: null,
        sales: 0,
        purchases: 0,
        receipts: 0,
        stockValue: 0,
        itemCount: 0,
    });

    for (const row of transactionRows) {
        const key = row.branchId ?? '__unassigned__';
        const current = summaryMap.get(key) ?? {
            branchId: row.branchId,
            sales: 0,
            purchases: 0,
            receipts: 0,
            stockValue: 0,
            itemCount: 0,
        };
        const amount = Number(row.totalAmount ?? 0);
        const paid = Number(row.paidAmount ?? 0);
        if (row.type === 'SALE') {
            current.sales += amount;
            current.receipts += paid;
        } else {
            current.purchases += amount;
        }
        summaryMap.set(key, current);
    }

    for (const row of itemRows) {
        if (row.isActive === false) continue;
        const key = row.branchId ?? '__unassigned__';
        const current = summaryMap.get(key) ?? {
            branchId: row.branchId,
            sales: 0,
            purchases: 0,
            receipts: 0,
            stockValue: 0,
            itemCount: 0,
        };
        current.itemCount += 1;
        current.stockValue += Number(row.stock ?? 0) * Number(row.purchasePrice ?? 0);
        summaryMap.set(key, current);
    }

    const branchNameById = new Map(branchRows.map((branch) => [branch.id, branch.name]));
    const rows = [...summaryMap.values()].map((row) => ({
        branchId: row.branchId,
        branchName: row.branchId ? (branchNameById.get(row.branchId) ?? row.branchId) : 'Unassigned',
        sales: roundAmount(row.sales),
        purchases: roundAmount(row.purchases),
        receipts: roundAmount(row.receipts),
        stockValue: roundAmount(row.stockValue),
        itemCount: row.itemCount,
        netContribution: roundAmount(row.sales - row.purchases),
    })).sort((a, b) => b.sales - a.sales);

    return c.json({
        ok: true,
        period: { start, end },
        rows,
        totals: {
            sales: roundAmount(rows.reduce((sum, row) => sum + row.sales, 0)),
            purchases: roundAmount(rows.reduce((sum, row) => sum + row.purchases, 0)),
            receipts: roundAmount(rows.reduce((sum, row) => sum + row.receipts, 0)),
            stockValue: roundAmount(rows.reduce((sum, row) => sum + row.stockValue, 0)),
        },
    });
});

enterpriseRoute.get('/reports/branches/:id', requireAuth, withOrganizationContext, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const organizationId = c.get('organizationId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !organizationId) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Branch report access denied.' }, 403);
    }

    const branchId = c.req.param('id');
    const start = parseDateQuery(c.req.query('start'));
    const end = parseDateQuery(c.req.query('end'));

    const db = c.get('db');
    const [branch] = await db
        .select()
        .from(branches)
        .where(and(eq(branches.id, branchId), eq(branches.userId, effectiveUserId)))
        .limit(1);
    if (!branch) return c.json({ ok: false, message: 'Branch not found.' }, 404);

    const transactionConditions = [
        eq(transactions.userId, effectiveUserId),
        eq(transactions.organizationId, organizationId),
        eq(transactions.branchId, branchId),
    ];
    if (start) transactionConditions.push(gte(transactions.billDate, start));
    if (end) transactionConditions.push(lte(transactions.billDate, end));

    const transactionRows = await db
        .select()
        .from(transactions)
        .where(and(...transactionConditions))
        .orderBy(desc(transactions.billDate));

    const itemRows = await db
        .select()
        .from(items)
        .where(and(
            eq(items.userId, effectiveUserId),
            eq(items.organizationId, organizationId),
            eq(items.branchId, branchId)
        ));

    const totals = transactionRows.reduce((acc, row) => {
        const totalAmount = Number(row.totalAmount ?? 0);
        const paidAmount = Number(row.paidAmount ?? 0);
        if (row.type === 'SALE') {
            acc.sales += totalAmount;
            acc.receipts += paidAmount;
        } else {
            acc.purchases += totalAmount;
            acc.payments += paidAmount;
        }
        return acc;
    }, {
        sales: 0,
        purchases: 0,
        receipts: 0,
        payments: 0,
    });

    const stockValue = itemRows
        .filter((row) => row.isActive !== false)
        .reduce((sum, row) => sum + (Number(row.stock ?? 0) * Number(row.purchasePrice ?? 0)), 0);

    return c.json({
        ok: true,
        period: { start, end },
        branch: {
            id: branch.id,
            name: branch.name,
            code: branch.code,
            isPrimary: branch.isPrimary,
        },
        totals: {
            sales: roundAmount(totals.sales),
            purchases: roundAmount(totals.purchases),
            receipts: roundAmount(totals.receipts),
            payments: roundAmount(totals.payments),
            stockValue: roundAmount(stockValue),
            netContribution: roundAmount(totals.sales - totals.purchases),
        },
        counts: {
            transactions: transactionRows.length,
            items: itemRows.filter((row) => row.isActive !== false).length,
        },
    });
});

export default enterpriseRoute;
