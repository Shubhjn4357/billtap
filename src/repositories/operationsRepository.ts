import { api, isCloudWriteBlockedError, toApiError } from '../api/client';
import { isOfflineLikeError, offlineSyncService } from '../services/offlineSyncService';
import { getRuntimeOrganizationRole, getRuntimeUserId } from '../services/runtimeSession';
import { isOnline } from '../utils/network';
import type { ApiResponse } from '../types/api';
import type {
    FinancialPeriod,
    OperationApproval,
    OperationApprovalActionType,
    OperationApprovalStatus,
    OperationsAuditLog,
    OperationsControls,
} from '../types/domain';

const DEFAULT_OPERATIONS_CONTROLS: OperationsControls = {
    makerCheckerEnabled: true,
    journalApprovalRequired: true,
    stockAdjustmentApprovalRequired: true,
    periodLockEnabled: true,
};

const nowIso = () => new Date().toISOString();

const queueAndAttemptSync = async (
    mutation: Parameters<typeof offlineSyncService.enqueueMutation>[0],
    successMessage: string
) => {
    await offlineSyncService.enqueueMutation(mutation);
    void offlineSyncService.flushQueue();
    return {
        ok: true,
        message: successMessage,
        syncQueued: true,
    };
};

const shouldKeepLocalWriteOnError = (error: unknown) =>
    isOfflineLikeError(error) || isCloudWriteBlockedError(error);

const sortFinancialPeriods = (periods: FinancialPeriod[]) =>
    [...periods].sort((left, right) => String(right.periodStart ?? '').localeCompare(String(left.periodStart ?? '')));

const sortApprovals = (approvals: OperationApproval[]) =>
    [...approvals].sort((left, right) => String(right.requestedAt ?? '').localeCompare(String(left.requestedAt ?? '')));

const normalizeOperationsControls = (value: Partial<OperationsControls> | null | undefined): OperationsControls => ({
    makerCheckerEnabled: Boolean(value?.makerCheckerEnabled ?? DEFAULT_OPERATIONS_CONTROLS.makerCheckerEnabled),
    journalApprovalRequired: Boolean(value?.journalApprovalRequired ?? DEFAULT_OPERATIONS_CONTROLS.journalApprovalRequired),
    stockAdjustmentApprovalRequired: Boolean(value?.stockAdjustmentApprovalRequired ?? DEFAULT_OPERATIONS_CONTROLS.stockAdjustmentApprovalRequired),
    periodLockEnabled: Boolean(value?.periodLockEnabled ?? DEFAULT_OPERATIONS_CONTROLS.periodLockEnabled),
});

const getCachedOperationsControlsOrDefault = async (): Promise<OperationsControls> =>
    normalizeOperationsControls(await offlineSyncService.getCachedOperationsControls());

const buildLocalOperationApproval = (params: {
    id?: string;
    actionType: OperationApprovalActionType;
    payload?: Record<string, unknown>;
    module?: string;
}): OperationApproval => ({
    id: params.id ?? offlineSyncService.createLocalId('approval'),
    actionType: params.actionType,
    module: params.module ?? 'operations',
    status: 'PENDING',
    payload: params.payload ?? {},
    requestedByUserId: getRuntimeUserId(),
    requestedByRole: getRuntimeOrganizationRole(),
    requestedAt: nowIso(),
    reviewedByUserId: null,
    reviewedByRole: null,
    reviewedAt: null,
    reviewNote: null,
});

const buildLocalFinancialPeriod = (payload: {
    id?: string;
    periodStart?: string;
    periodEnd?: string;
    notes?: string;
}): FinancialPeriod => {
    const now = nowIso();
    const start = payload.periodStart ?? now;
    const end = payload.periodEnd ?? start;
    return {
        id: payload.id ?? offlineSyncService.createLocalId('period'),
        periodStart: start,
        periodEnd: end,
        status: 'LOCKED',
        notes: payload.notes?.trim() || null,
        lockedAt: now,
        closedAt: null,
        reopenedAt: null,
        createdAt: now,
        updatedAt: now,
    };
};

const applyApprovalSideEffectLocally = (params: {
    approval: OperationApproval;
    controls: OperationsControls;
    periods: FinancialPeriod[];
}): { controls: OperationsControls; periods: FinancialPeriod[] } => {
    const { approval } = params;
    if (approval.actionType === 'UPDATE_CONTROLS') {
        return {
            controls: normalizeOperationsControls({
                ...params.controls,
                ...approval.payload,
            }),
            periods: params.periods,
        };
    }

    if (approval.actionType === 'LOCK_PERIOD') {
        const nextPeriod = buildLocalFinancialPeriod({
            id: typeof approval.payload.id === 'string' ? approval.payload.id : undefined,
            periodStart: typeof approval.payload.periodStart === 'string' ? approval.payload.periodStart : undefined,
            periodEnd: typeof approval.payload.periodEnd === 'string' ? approval.payload.periodEnd : undefined,
            notes: typeof approval.payload.notes === 'string' ? approval.payload.notes : undefined,
        });
        return {
            controls: params.controls,
            periods: sortFinancialPeriods([
                nextPeriod,
                ...params.periods.filter((entry) => entry.id !== nextPeriod.id),
            ]),
        };
    }

    if (approval.actionType === 'CLOSE_PERIOD' || approval.actionType === 'REOPEN_PERIOD') {
        const periodId = typeof approval.payload.periodId === 'string' ? approval.payload.periodId : '';
        if (!periodId) {
            return {
                controls: params.controls,
                periods: params.periods,
            };
        }
        const nextStatus = approval.actionType === 'CLOSE_PERIOD' ? 'CLOSED' : 'OPEN';
        return {
            controls: params.controls,
            periods: sortFinancialPeriods(
                params.periods.map((entry) =>
                    entry.id === periodId
                        ? {
                            ...entry,
                            status: nextStatus,
                            closedAt: nextStatus === 'CLOSED' ? nowIso() : entry.closedAt,
                            reopenedAt: nextStatus === 'OPEN' ? nowIso() : entry.reopenedAt,
                            updatedAt: nowIso(),
                        }
                        : entry
                )
            ),
        };
    }

    return {
        controls: params.controls,
        periods: params.periods,
    };
};

const shouldRequireOperationsApproval = (controls: OperationsControls) =>
    Boolean(controls.makerCheckerEnabled) && getRuntimeOrganizationRole() !== 'owner';

const queueHasMutation = async (predicate: (entry: { type?: string; payload?: Record<string, unknown> }) => boolean) => {
    const queue = await offlineSyncService.getQueue();
    return queue.some((entry) => predicate(entry as { type?: string; payload?: Record<string, unknown> }));
};

const hasPendingOperationsPeriodCreate = async (id: string) =>
    queueHasMutation((entry) => entry.type === 'lock_operations_period' && entry.payload?.id === id);

const hasPendingOperationApprovalCreate = async (id: string) =>
    queueHasMutation((entry) => entry.type === 'create_operation_approval' && entry.payload?.approvalId === id);

export const operationsRepository = {
    getAccessMatrix: async () => {
        const res = await api.get<{ ok: boolean; matrix: Record<string, unknown> }>('/api/operations/access-matrix');
        return { ...res, data: res.matrix ?? {} } as ApiResponse<Record<string, unknown>>;
    },
    getControlsRemote: async () => {
        const res = await api.get<{ ok: boolean; controls: OperationsControls }>('/api/operations/controls');
        return { ...res, data: { controls: res.controls } } as ApiResponse<{ controls: OperationsControls }>;
    },
    updateControlsRemote: async (data: Partial<OperationsControls>) => {
        const res = await api.put<{
            ok: boolean;
            controls?: OperationsControls;
            approvalId?: string;
            status?: 'PENDING_APPROVAL';
        }>('/api/operations/controls', data);
        return {
            ...res,
            data: {
                controls: res.controls ?? null,
                approvalId: res.approvalId ?? null,
                status: res.status ?? null,
            },
        } as ApiResponse<{ controls: OperationsControls | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    getPeriodsRemote: async () => {
        const res = await api.get<{ ok: boolean; periods: FinancialPeriod[] }>('/api/operations/periods');
        return { ...res, data: { periods: res.periods ?? [] } } as ApiResponse<{ periods: FinancialPeriod[] }>;
    },
    lockPeriodRemote: async (data: { id?: string; periodStart?: string; periodEnd?: string; notes?: string }) => {
        const res = await api.post<{
            ok: boolean;
            id?: string;
            period?: FinancialPeriod;
            approvalId?: string;
            status?: 'PENDING_APPROVAL';
        }>('/api/operations/periods/lock', data);
        return {
            ...res,
            data: {
                id: res.id ?? null,
                period: res.period ?? null,
                approvalId: res.approvalId ?? null,
                status: res.status ?? null,
            },
        } as ApiResponse<{ id: string | null; period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    closePeriodRemote: async (id: string) => {
        const res = await api.post<{
            ok: boolean;
            period?: FinancialPeriod;
            approvalId?: string;
            status?: 'PENDING_APPROVAL';
        }>(`/api/operations/periods/${id}/close`, {});
        return {
            ...res,
            data: {
                period: res.period ?? null,
                approvalId: res.approvalId ?? null,
                status: res.status ?? null,
            },
        } as ApiResponse<{ period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    reopenPeriodRemote: async (id: string) => {
        const res = await api.post<{
            ok: boolean;
            period?: FinancialPeriod;
            approvalId?: string;
            status?: 'PENDING_APPROVAL';
        }>(`/api/operations/periods/${id}/reopen`, {});
        return {
            ...res,
            data: {
                period: res.period ?? null,
                approvalId: res.approvalId ?? null,
                status: res.status ?? null,
            },
        } as ApiResponse<{ period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    getAuditLogsRemote: async (limit = 50) => {
        const res = await api.get<{ ok: boolean; logs: OperationsAuditLog[] }>('/api/operations/audit-logs', { params: { limit } });
        return { ...res, data: { logs: res.logs ?? [] } } as ApiResponse<{ logs: OperationsAuditLog[] }>;
    },
    getApprovalsRemote: async (params?: { status?: OperationApprovalStatus }) => {
        const res = await api.get<{ ok: boolean; approvals: OperationApproval[] }>('/api/operations/approvals', { params });
        return { ...res, data: { approvals: res.approvals ?? [] } } as ApiResponse<{ approvals: OperationApproval[] }>;
    },
    createApprovalRemote: async (payload: { actionType: OperationApprovalActionType; module?: string; payload?: Record<string, unknown>; approvalId?: string }) => {
        const res = await api.post<{ ok: boolean; approvalId: string }>('/api/operations/approvals', payload);
        return { ...res, data: { approvalId: res.approvalId } } as ApiResponse<{ approvalId: string }>;
    },
    approveApprovalRemote: async (id: string) => {
        const res = await api.post<{ ok: boolean; approval: OperationApproval }>(`/api/operations/approvals/${id}/approve`, {});
        return { ...res, data: { approval: res.approval } } as ApiResponse<{ approval: OperationApproval }>;
    },
    rejectApprovalRemote: async (id: string, note?: string) => {
        const res = await api.post<{ ok: boolean; approval: OperationApproval }>(`/api/operations/approvals/${id}/reject`, { note });
        return { ...res, data: { approval: res.approval } } as ApiResponse<{ approval: OperationApproval }>;
    },
    getControls: async () => {
        try {
            const response = await operationsRepository.getControlsRemote();
            const controls = normalizeOperationsControls(response.data?.controls);
            await offlineSyncService.setCachedOperationsControls(controls);
            return { ...response, data: { controls } };
        } catch {
            return {
                ok: true,
                data: { controls: await getCachedOperationsControlsOrDefault() },
            } as ApiResponse<{ controls: OperationsControls }>;
        }
    },
    getPeriods: async () => {
        try {
            const response = await operationsRepository.getPeriodsRemote();
            const periods = sortFinancialPeriods((response.data?.periods ?? []) as FinancialPeriod[]);
            await offlineSyncService.setCachedOperationsPeriods(periods);
            return { ...response, data: { periods } };
        } catch {
            const periods = sortFinancialPeriods(await offlineSyncService.getCachedOperationsPeriods());
            return { ok: true, data: { periods } } as ApiResponse<{ periods: FinancialPeriod[] }>;
        }
    },
    getApprovals: async (params?: { status?: OperationApprovalStatus }) => {
        try {
            const response = await operationsRepository.getApprovalsRemote(params);
            const approvals = sortApprovals((response.data?.approvals ?? []) as OperationApproval[]);
            await offlineSyncService.setCachedOperationsApprovals(approvals);
            return { ...response, data: { approvals } };
        } catch {
            const requestedStatus = params?.status;
            const approvals = sortApprovals(await offlineSyncService.getCachedOperationsApprovals())
                .filter((entry) => (requestedStatus ? entry.status === requestedStatus : true));
            return { ok: true, data: { approvals } } as ApiResponse<{ approvals: OperationApproval[] }>;
        }
    },
    getAuditLogs: async (limit = 50) => {
        try {
            const response = await operationsRepository.getAuditLogsRemote(limit);
            const logs = (response.data?.logs ?? []) as OperationsAuditLog[];
            await offlineSyncService.setCachedOperationsAuditLogs(logs);
            return { ...response, data: { logs } };
        } catch {
            const logs = (await offlineSyncService.getCachedOperationsAuditLogs()).slice(0, limit);
            return { ok: true, data: { logs } } as ApiResponse<{ logs: OperationsAuditLog[] }>;
        }
    },
    createApproval: async (payload: { actionType: OperationApprovalActionType; module?: string; payload?: Record<string, unknown>; approvalId?: string }) => {
        const previousApprovals = await offlineSyncService.getCachedOperationsApprovals();
        const localApproval = buildLocalOperationApproval({
            id: payload.approvalId,
            actionType: payload.actionType,
            payload: payload.payload,
            module: payload.module,
        });
        await offlineSyncService.setCachedOperationsApprovals(
            sortApprovals([localApproval, ...previousApprovals.filter((entry) => entry.id !== localApproval.id)])
        );

        if (await isOnline()) {
            try {
                const response = await operationsRepository.createApprovalRemote({
                    ...payload,
                    approvalId: localApproval.id,
                });
                return {
                    ...response,
                    data: { approvalId: response.data?.approvalId ?? localApproval.id },
                };
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[operations] create approval failed', { payload, error: toApiError(error) });
                    await offlineSyncService.setCachedOperationsApprovals(previousApprovals);
                    throw error;
                }
                console.warn('[operations] keeping local approval request after cloud rejection', { payload, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            {
                type: 'create_operation_approval',
                payload: {
                    approvalId: localApproval.id,
                    actionType: localApproval.actionType,
                    module: localApproval.module,
                    payload: localApproval.payload,
                },
            },
            'Approval request saved locally. Sync pending.'
        );
        return {
            ok: true,
            data: { approvalId: localApproval.id },
            message: 'Approval request saved locally. Sync pending.',
        } as ApiResponse<{ approvalId: string }>;
    },
    updateControls: async (data: Partial<OperationsControls>) => {
        const previousControls = await getCachedOperationsControlsOrDefault();
        const nextControls = normalizeOperationsControls({ ...previousControls, ...data });

        if (shouldRequireOperationsApproval(previousControls)) {
            const approvalResponse = await operationsRepository.createApproval({
                actionType: 'UPDATE_CONTROLS',
                module: 'operations',
                payload: { ...nextControls },
            });
            return {
                ok: true,
                data: {
                    controls: null,
                    approvalId: approvalResponse.data?.approvalId ?? null,
                    status: 'PENDING_APPROVAL',
                },
                message: approvalResponse.message,
            } as ApiResponse<{ controls: OperationsControls | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
        }

        await offlineSyncService.setCachedOperationsControls(nextControls);
        if (await isOnline()) {
            try {
                const response = await operationsRepository.updateControlsRemote(nextControls);
                if (response.data?.status === 'PENDING_APPROVAL') {
                    const approval = buildLocalOperationApproval({
                        id: response.data?.approvalId ?? undefined,
                        actionType: 'UPDATE_CONTROLS',
                        payload: { ...nextControls },
                    });
                    await offlineSyncService.setCachedOperationsControls(previousControls);
                    await offlineSyncService.setCachedOperationsApprovals(
                        sortApprovals([
                            approval,
                            ...(await offlineSyncService.getCachedOperationsApprovals()).filter((entry) => entry.id !== approval.id),
                        ])
                    );
                } else {
                    await offlineSyncService.setCachedOperationsControls(
                        normalizeOperationsControls(response.data?.controls ?? nextControls)
                    );
                }
                return response;
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[operations] update controls failed', { payload: data, error: toApiError(error) });
                    await offlineSyncService.setCachedOperationsControls(previousControls);
                    throw error;
                }
                console.warn('[operations] keeping local controls update after cloud rejection', { payload: data, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            { type: 'set_operations_controls', payload: nextControls },
            'Operations controls saved locally. Sync pending.'
        );
        return {
            ok: true,
            data: { controls: nextControls, approvalId: null, status: null },
            message: 'Operations controls saved locally. Sync pending.',
        } as ApiResponse<{ controls: OperationsControls | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    lockPeriod: async (data: { id?: string; periodStart?: string; periodEnd?: string; notes?: string }) => {
        if (data.periodStart && data.periodEnd && String(data.periodStart) > String(data.periodEnd)) {
            throw new Error('periodStart must be <= periodEnd.');
        }
        const currentControls = await getCachedOperationsControlsOrDefault();
        const previousPeriods = await offlineSyncService.getCachedOperationsPeriods();
        const localPeriod = buildLocalFinancialPeriod(data);

        if (shouldRequireOperationsApproval(currentControls)) {
            const approvalResponse = await operationsRepository.createApproval({
                actionType: 'LOCK_PERIOD',
                module: 'operations',
                payload: {
                    id: localPeriod.id,
                    periodStart: localPeriod.periodStart,
                    periodEnd: localPeriod.periodEnd,
                    notes: localPeriod.notes,
                },
            });
            return {
                ok: true,
                data: { id: null, period: null, approvalId: approvalResponse.data?.approvalId ?? null, status: 'PENDING_APPROVAL' },
                message: approvalResponse.message,
            } as ApiResponse<{ id: string | null; period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
        }

        await offlineSyncService.setCachedOperationsPeriods(
            sortFinancialPeriods([localPeriod, ...previousPeriods.filter((entry) => entry.id !== localPeriod.id)])
        );

        if (await isOnline()) {
            try {
                const response = await operationsRepository.lockPeriodRemote({ ...data, id: localPeriod.id });
                if (response.data?.status === 'PENDING_APPROVAL') {
                    const approval = buildLocalOperationApproval({
                        id: response.data?.approvalId ?? undefined,
                        actionType: 'LOCK_PERIOD',
                        payload: {
                            id: localPeriod.id,
                            periodStart: localPeriod.periodStart,
                            periodEnd: localPeriod.periodEnd,
                            notes: localPeriod.notes,
                        },
                    });
                    await offlineSyncService.setCachedOperationsPeriods(previousPeriods);
                    await offlineSyncService.setCachedOperationsApprovals(
                        sortApprovals([
                            approval,
                            ...(await offlineSyncService.getCachedOperationsApprovals()).filter((entry) => entry.id !== approval.id),
                        ])
                    );
                } else if (response.data?.period) {
                    await offlineSyncService.setCachedOperationsPeriods(
                        sortFinancialPeriods([
                            response.data.period,
                            ...previousPeriods.filter((entry) => entry.id !== response.data.period?.id),
                        ])
                    );
                }
                return response;
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[operations] lock period failed', { payload: data, error: toApiError(error) });
                    await offlineSyncService.setCachedOperationsPeriods(previousPeriods);
                    throw error;
                }
                console.warn('[operations] keeping local lock period after cloud rejection', { payload: data, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            {
                type: 'lock_operations_period',
                payload: {
                    id: localPeriod.id,
                    periodStart: localPeriod.periodStart,
                    periodEnd: localPeriod.periodEnd,
                    ...(localPeriod.notes ? { notes: localPeriod.notes } : {}),
                },
            },
            'Financial period saved locally. Sync pending.'
        );
        return {
            ok: true,
            data: { id: localPeriod.id, period: localPeriod, approvalId: null, status: null },
            message: 'Financial period saved locally. Sync pending.',
        } as ApiResponse<{ id: string | null; period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    closePeriod: async (id: string) => {
        const currentControls = await getCachedOperationsControlsOrDefault();
        const previousPeriods = await offlineSyncService.getCachedOperationsPeriods();

        if (shouldRequireOperationsApproval(currentControls)) {
            const approvalResponse = await operationsRepository.createApproval({
                actionType: 'CLOSE_PERIOD',
                module: 'operations',
                payload: { periodId: id },
            });
            return {
                ok: true,
                data: { period: null, approvalId: approvalResponse.data?.approvalId ?? null, status: 'PENDING_APPROVAL' },
                message: approvalResponse.message,
            } as ApiResponse<{ period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
        }

        const nextPeriods = sortFinancialPeriods(previousPeriods.map((entry) =>
            entry.id === id ? { ...entry, status: 'CLOSED', closedAt: nowIso(), updatedAt: nowIso() } : entry
        ));
        await offlineSyncService.setCachedOperationsPeriods(nextPeriods);

        const shouldCallOnline = await isOnline() && !(await hasPendingOperationsPeriodCreate(id));
        if (shouldCallOnline) {
            try {
                const response = await operationsRepository.closePeriodRemote(id);
                if (response.data?.status === 'PENDING_APPROVAL') {
                    const approval = buildLocalOperationApproval({
                        id: response.data?.approvalId ?? undefined,
                        actionType: 'CLOSE_PERIOD',
                        payload: { periodId: id },
                    });
                    await offlineSyncService.setCachedOperationsPeriods(previousPeriods);
                    await offlineSyncService.setCachedOperationsApprovals(
                        sortApprovals([
                            approval,
                            ...(await offlineSyncService.getCachedOperationsApprovals()).filter((entry) => entry.id !== approval.id),
                        ])
                    );
                } else if (response.data?.period) {
                    await offlineSyncService.upsertCachedOperationsPeriod(response.data.period);
                }
                return response;
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[operations] close period failed', { id, error: toApiError(error) });
                    await offlineSyncService.setCachedOperationsPeriods(previousPeriods);
                    throw error;
                }
                console.warn('[operations] keeping local close period after cloud rejection', { id, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            { type: 'close_operations_period', payload: { periodId: id } },
            'Period close saved locally. Sync pending.'
        );
        const period = nextPeriods.find((entry) => entry.id === id) ?? null;
        return {
            ok: true,
            data: { period, approvalId: null, status: null },
            message: 'Period close saved locally. Sync pending.',
        } as ApiResponse<{ period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    reopenPeriod: async (id: string) => {
        const currentControls = await getCachedOperationsControlsOrDefault();
        const previousPeriods = await offlineSyncService.getCachedOperationsPeriods();

        if (shouldRequireOperationsApproval(currentControls)) {
            const approvalResponse = await operationsRepository.createApproval({
                actionType: 'REOPEN_PERIOD',
                module: 'operations',
                payload: { periodId: id },
            });
            return {
                ok: true,
                data: { period: null, approvalId: approvalResponse.data?.approvalId ?? null, status: 'PENDING_APPROVAL' },
                message: approvalResponse.message,
            } as ApiResponse<{ period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
        }

        const nextPeriods = sortFinancialPeriods(previousPeriods.map((entry) =>
            entry.id === id ? { ...entry, status: 'OPEN', reopenedAt: nowIso(), updatedAt: nowIso() } : entry
        ));
        await offlineSyncService.setCachedOperationsPeriods(nextPeriods);

        const shouldCallOnline = await isOnline() && !(await hasPendingOperationsPeriodCreate(id));
        if (shouldCallOnline) {
            try {
                const response = await operationsRepository.reopenPeriodRemote(id);
                if (response.data?.status === 'PENDING_APPROVAL') {
                    const approval = buildLocalOperationApproval({
                        id: response.data?.approvalId ?? undefined,
                        actionType: 'REOPEN_PERIOD',
                        payload: { periodId: id },
                    });
                    await offlineSyncService.setCachedOperationsPeriods(previousPeriods);
                    await offlineSyncService.setCachedOperationsApprovals(
                        sortApprovals([
                            approval,
                            ...(await offlineSyncService.getCachedOperationsApprovals()).filter((entry) => entry.id !== approval.id),
                        ])
                    );
                } else if (response.data?.period) {
                    await offlineSyncService.upsertCachedOperationsPeriod(response.data.period);
                }
                return response;
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[operations] reopen period failed', { id, error: toApiError(error) });
                    await offlineSyncService.setCachedOperationsPeriods(previousPeriods);
                    throw error;
                }
                console.warn('[operations] keeping local reopen period after cloud rejection', { id, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            { type: 'reopen_operations_period', payload: { periodId: id } },
            'Period reopen saved locally. Sync pending.'
        );
        const period = nextPeriods.find((entry) => entry.id === id) ?? null;
        return {
            ok: true,
            data: { period, approvalId: null, status: null },
            message: 'Period reopen saved locally. Sync pending.',
        } as ApiResponse<{ period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    approveApproval: async (id: string) => {
        const previousControls = await getCachedOperationsControlsOrDefault();
        const previousPeriods = await offlineSyncService.getCachedOperationsPeriods();
        const previousApprovals = await offlineSyncService.getCachedOperationsApprovals();
        const approval = previousApprovals.find((entry) => entry.id === id);
        if (!approval) {
            return operationsRepository.approveApprovalRemote(id);
        }

        const updatedApproval: OperationApproval = {
            ...approval,
            status: 'APPROVED',
            reviewedByUserId: getRuntimeUserId(),
            reviewedByRole: getRuntimeOrganizationRole(),
            reviewedAt: nowIso(),
            reviewNote: null,
        };
        const applied = applyApprovalSideEffectLocally({
            approval: updatedApproval,
            controls: previousControls,
            periods: previousPeriods,
        });
        await offlineSyncService.setCachedOperationsControls(applied.controls);
        await offlineSyncService.setCachedOperationsPeriods(applied.periods);
        await offlineSyncService.setCachedOperationsApprovals(
            sortApprovals(previousApprovals.map((entry) => (entry.id === id ? updatedApproval : entry)))
        );

        const shouldCallOnline = await isOnline() && !(await hasPendingOperationApprovalCreate(id));
        if (shouldCallOnline) {
            try {
                return await operationsRepository.approveApprovalRemote(id);
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[operations] approve approval failed', { id, error: toApiError(error) });
                    await offlineSyncService.setCachedOperationsControls(previousControls);
                    await offlineSyncService.setCachedOperationsPeriods(previousPeriods);
                    await offlineSyncService.setCachedOperationsApprovals(previousApprovals);
                    throw error;
                }
                console.warn('[operations] keeping local approval state after cloud rejection', { id, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            { type: 'approve_operation_approval', payload: { id } },
            'Approval saved locally. Sync pending.'
        );
        return {
            ok: true,
            data: { approval: updatedApproval },
            message: 'Approval saved locally. Sync pending.',
        } as ApiResponse<{ approval: OperationApproval }>;
    },
    rejectApproval: async (id: string, note?: string) => {
        const previousApprovals = await offlineSyncService.getCachedOperationsApprovals();
        const approval = previousApprovals.find((entry) => entry.id === id);
        if (!approval) {
            return operationsRepository.rejectApprovalRemote(id, note);
        }

        const updatedApproval: OperationApproval = {
            ...approval,
            status: 'REJECTED',
            reviewedByUserId: getRuntimeUserId(),
            reviewedByRole: getRuntimeOrganizationRole(),
            reviewedAt: nowIso(),
            reviewNote: note ?? null,
        };
        await offlineSyncService.setCachedOperationsApprovals(
            sortApprovals(previousApprovals.map((entry) => (entry.id === id ? updatedApproval : entry)))
        );

        const shouldCallOnline = await isOnline() && !(await hasPendingOperationApprovalCreate(id));
        if (shouldCallOnline) {
            try {
                return await operationsRepository.rejectApprovalRemote(id, note);
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[operations] reject approval failed', { id, note, error: toApiError(error) });
                    await offlineSyncService.setCachedOperationsApprovals(previousApprovals);
                    throw error;
                }
                console.warn('[operations] keeping local rejection state after cloud rejection', { id, note, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            { type: 'reject_operation_approval', payload: { id, ...(note ? { note } : {}) } },
            'Approval rejection saved locally. Sync pending.'
        );
        return {
            ok: true,
            data: { approval: updatedApproval },
            message: 'Approval rejection saved locally. Sync pending.',
        } as ApiResponse<{ approval: OperationApproval }>;
    },
};
