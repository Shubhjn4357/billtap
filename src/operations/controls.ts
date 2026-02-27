import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DrizzleClient } from '../db/client';
import {
    accountingPeriods,
    approvalRequests,
    auditLogs,
    businessControls,
    type ApprovalRequestRow,
    type UserRow,
} from '../db/schema';

export type ModuleKey = 'inventory' | 'billing' | 'accounting' | 'admin';
export type PermissionKey = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'close' | 'export';
export type RoleKey = 'owner' | 'staff' | 'admin';
export type ApprovalRequestType = 'JOURNAL_ENTRY' | 'STOCK_ADJUSTMENT';

export type AccessMatrix = Record<ModuleKey, Record<PermissionKey, boolean>>;

const cloneMatrix = (matrix: AccessMatrix): AccessMatrix => JSON.parse(JSON.stringify(matrix)) as AccessMatrix;

const OWNER_MATRIX: AccessMatrix = {
    inventory: { view: true, create: true, update: true, delete: true, approve: true, close: true, export: true },
    billing: { view: true, create: true, update: true, delete: true, approve: true, close: true, export: true },
    accounting: { view: true, create: true, update: true, delete: true, approve: true, close: true, export: true },
    admin: { view: false, create: false, update: false, delete: false, approve: false, close: false, export: false },
};

const STAFF_MATRIX: AccessMatrix = {
    inventory: { view: true, create: true, update: true, delete: false, approve: false, close: false, export: false },
    billing: { view: true, create: true, update: true, delete: false, approve: false, close: false, export: false },
    accounting: { view: true, create: false, update: false, delete: false, approve: false, close: false, export: false },
    admin: { view: false, create: false, update: false, delete: false, approve: false, close: false, export: false },
};

const ADMIN_MATRIX: AccessMatrix = {
    inventory: { view: true, create: true, update: true, delete: true, approve: true, close: true, export: true },
    billing: { view: true, create: true, update: true, delete: true, approve: true, close: true, export: true },
    accounting: { view: true, create: true, update: true, delete: true, approve: true, close: true, export: true },
    admin: { view: true, create: true, update: true, delete: true, approve: true, close: true, export: true },
};

const MATRIX_BY_ROLE: Record<RoleKey, AccessMatrix> = {
    owner: OWNER_MATRIX,
    staff: STAFF_MATRIX,
    admin: ADMIN_MATRIX,
};

const roleFromUser = (authUser?: Pick<UserRow, 'role'> | null): RoleKey => {
    if (authUser?.role === 'admin') return 'admin';
    if (authUser?.role === 'staff') return 'staff';
    return 'owner';
};

export const getRoleAccessMatrix = (authUser?: Pick<UserRow, 'role'> | null): AccessMatrix => {
    const role = roleFromUser(authUser);
    return cloneMatrix(MATRIX_BY_ROLE[role]);
};

export const hasModulePermission = (
    authUser: Pick<UserRow, 'role'> | null | undefined,
    module: ModuleKey,
    permission: PermissionKey
): boolean => {
    const matrix = MATRIX_BY_ROLE[roleFromUser(authUser)];
    return Boolean(matrix[module]?.[permission]);
};

export type BusinessControlSettings = {
    makerCheckerEnabled: boolean;
    journalApprovalRequired: boolean;
    stockAdjustmentApprovalRequired: boolean;
    periodLockEnabled: boolean;
};

const DEFAULT_CONTROLS: BusinessControlSettings = {
    makerCheckerEnabled: true,
    journalApprovalRequired: true,
    stockAdjustmentApprovalRequired: true,
    periodLockEnabled: true,
};

const extractErrorCode = (error: unknown): string => {
    if (!error || typeof error !== 'object') return '';
    if ('code' in error && typeof (error as { code?: unknown }).code === 'string') {
        return (error as { code: string }).code;
    }
    return '';
};

const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (!error || typeof error !== 'object') return '';
    if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
        return (error as { message: string }).message;
    }
    return '';
};

const isMissingRelationError = (error: unknown, relationName: string): boolean => {
    const code = extractErrorCode(error);
    if (code === '42P01') return true;
    return new RegExp(relationName, 'i').test(extractErrorMessage(error));
};

const throwOperationsSchemaError = (): never => {
    throw new Error('Operations control tables are missing. Run latest database migrations and retry.');
};

export const getBusinessControls = async (db: DrizzleClient, userId: string): Promise<BusinessControlSettings> => {
    try {
        const rows = await db
            .select()
            .from(businessControls)
            .where(eq(businessControls.userId, userId))
            .limit(1);
        const row = rows[0];

        if (!row) {
            return { ...DEFAULT_CONTROLS };
        }

        return {
            makerCheckerEnabled: Boolean(row.makerCheckerEnabled),
            journalApprovalRequired: Boolean(row.journalApprovalRequired),
            stockAdjustmentApprovalRequired: Boolean(row.stockAdjustmentApprovalRequired),
            periodLockEnabled: Boolean(row.periodLockEnabled),
        };
    } catch (error: unknown) {
        if (isMissingRelationError(error, 'business_controls')) {
            return { ...DEFAULT_CONTROLS };
        }
        throw error;
    }
};

export const setBusinessControls = async (
    db: DrizzleClient,
    userId: string,
    payload: Partial<BusinessControlSettings>
): Promise<BusinessControlSettings> => {
    const current = await getBusinessControls(db, userId);
    const next: BusinessControlSettings = {
        makerCheckerEnabled: payload.makerCheckerEnabled ?? current.makerCheckerEnabled,
        journalApprovalRequired: payload.journalApprovalRequired ?? current.journalApprovalRequired,
        stockAdjustmentApprovalRequired: payload.stockAdjustmentApprovalRequired ?? current.stockAdjustmentApprovalRequired,
        periodLockEnabled: payload.periodLockEnabled ?? current.periodLockEnabled,
    };
    const now = new Date();

    try {
        await db
            .insert(businessControls)
            .values({
                userId,
                makerCheckerEnabled: next.makerCheckerEnabled,
                journalApprovalRequired: next.journalApprovalRequired,
                stockAdjustmentApprovalRequired: next.stockAdjustmentApprovalRequired,
                periodLockEnabled: next.periodLockEnabled,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: businessControls.userId,
                set: {
                    makerCheckerEnabled: next.makerCheckerEnabled,
                    journalApprovalRequired: next.journalApprovalRequired,
                    stockAdjustmentApprovalRequired: next.stockAdjustmentApprovalRequired,
                    periodLockEnabled: next.periodLockEnabled,
                    updatedAt: now,
                },
            });
    } catch (error: unknown) {
        if (isMissingRelationError(error, 'business_controls')) {
            throwOperationsSchemaError();
        }
        throw error;
    }

    return next;
};

export const ensurePeriodUnlockedForDate = async (
    db: DrizzleClient,
    userId: string,
    effectiveDate: Date
): Promise<void> => {
    let rows: Array<typeof accountingPeriods.$inferSelect> = [];
    try {
        rows = await db
            .select()
            .from(accountingPeriods)
            .where(
                and(
                    eq(accountingPeriods.userId, userId),
                    lte(accountingPeriods.periodStart, effectiveDate),
                    gte(accountingPeriods.periodEnd, effectiveDate),
                    inArray(accountingPeriods.status, ['locked', 'closed'])
                )
            )
            .orderBy(desc(accountingPeriods.periodStart))
            .limit(1);
    } catch (error: unknown) {
        if (isMissingRelationError(error, 'accounting_periods')) {
            throwOperationsSchemaError();
        }
        throw error;
    }

    const blocked = rows[0];
    if (!blocked) return;

    const start = blocked.periodStart.toISOString().slice(0, 10);
    const end = blocked.periodEnd.toISOString().slice(0, 10);
    throw new Error(`Accounting period ${start} to ${end} is ${blocked.status}. Posting is disabled.`);
};

export const shouldRequireApproval = (
    authUser: Pick<UserRow, 'role'>,
    controls: BusinessControlSettings,
    requestType: ApprovalRequestType
): boolean => {
    if (authUser.role !== 'staff') return false;
    if (!controls.makerCheckerEnabled) return false;
    if (requestType === 'JOURNAL_ENTRY') return controls.journalApprovalRequired;
    return controls.stockAdjustmentApprovalRequired;
};

export const createApprovalRequest = async (
    db: DrizzleClient,
    payload: {
        userId: string;
        module: ModuleKey;
        requestType: ApprovalRequestType;
        requestedBy: string;
        requestedByRole?: string | null;
        body: Record<string, unknown>;
        reason?: string | null;
    }
): Promise<string | null> => {
    const id = nanoid();
    const now = new Date();
    try {
        await db.insert(approvalRequests).values({
            id,
            userId: payload.userId,
            module: payload.module,
            requestType: payload.requestType,
            requestedBy: payload.requestedBy,
            requestedByRole: payload.requestedByRole ?? null,
            status: 'pending',
            payload: payload.body,
            reason: payload.reason ?? null,
            reviewedBy: null,
            reviewedAt: null,
            reviewNote: null,
            createdAt: now,
            updatedAt: now,
        });
    } catch (error: unknown) {
        if (isMissingRelationError(error, 'approval_requests')) {
            throwOperationsSchemaError();
        }
        throw error;
    }

    return id;
};

export const listApprovalRequests = async (
    db: DrizzleClient,
    userId: string,
    options: {
        status?: 'pending' | 'approved' | 'rejected';
        module?: ModuleKey;
        requestedBy?: string;
        limit?: number;
    } = {}
): Promise<ApprovalRequestRow[]> => {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const conditions = [eq(approvalRequests.userId, userId)];
    if (options.status) conditions.push(eq(approvalRequests.status, options.status));
    if (options.module) conditions.push(eq(approvalRequests.module, options.module));
    if (options.requestedBy) conditions.push(eq(approvalRequests.requestedBy, options.requestedBy));

    try {
        return await db
            .select()
            .from(approvalRequests)
            .where(and(...conditions))
            .orderBy(desc(approvalRequests.createdAt))
            .limit(limit);
    } catch (error: unknown) {
        if (isMissingRelationError(error, 'approval_requests')) {
            throwOperationsSchemaError();
        }
        throw error;
    }
};

export const writeAuditLog = async (
    db: DrizzleClient,
    payload: {
        userId: string;
        actorUid: string;
        actorRole?: string | null;
        module: ModuleKey;
        action: string;
        entityType?: string | null;
        entityId?: string | null;
        before?: Record<string, unknown> | null;
        after?: Record<string, unknown> | null;
        metadata?: Record<string, string | number | boolean | null> | null;
    }
): Promise<void> => {
    try {
        await db.insert(auditLogs).values({
            id: nanoid(),
            userId: payload.userId,
            actorUid: payload.actorUid,
            actorRole: payload.actorRole ?? null,
            module: payload.module,
            action: payload.action,
            entityType: payload.entityType ?? null,
            entityId: payload.entityId ?? null,
            before: payload.before ?? null,
            after: payload.after ?? null,
            metadata: payload.metadata ?? null,
            createdAt: new Date(),
        });
    } catch (error: unknown) {
        if (!isMissingRelationError(error, 'audit_logs')) {
            throw error;
        }
    }
};
