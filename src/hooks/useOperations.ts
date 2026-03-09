import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { operationsRepository } from '../repositories/operationsRepository';
import type {
    FinancialPeriod,
    OperationApproval,
    OperationApprovalStatus,
    OperationsAuditLog,
    OperationsControls,
} from '../types/domain';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { operationsQueryKeys } from '../state/domainQueryKeys';

const defaultControls: OperationsControls = {
    makerCheckerEnabled: true,
    journalApprovalRequired: true,
    stockAdjustmentApprovalRequired: true,
    periodLockEnabled: true,
};

export const invalidateOperationsQueries = async (
    queryClient: QueryClient,
    businessId?: string | null
) => {
    await queryClient.invalidateQueries({ queryKey: operationsQueryKeys.all(businessId) });
};

export function useOperationsOverview(options?: {
    approvalStatus?: OperationApprovalStatus;
    enabled?: boolean;
    staleTime?: number;
}) {
    const businessId = useBusinessQueryScope();
    const approvalStatus = options?.approvalStatus;
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 30_000;

    const controlsQuery = useQuery({
        queryKey: operationsQueryKeys.controls(businessId),
        queryFn: () => operationsRepository.getControls(),
        enabled,
        staleTime,
    });

    const periodsQuery = useQuery({
        queryKey: operationsQueryKeys.periods(businessId),
        queryFn: () => operationsRepository.getPeriods(),
        enabled,
        staleTime,
    });

    const approvalsQuery = useQuery({
        queryKey: operationsQueryKeys.approvals(businessId, { status: approvalStatus ?? null }),
        queryFn: () => operationsRepository.getApprovals(approvalStatus ? { status: approvalStatus } : undefined),
        enabled,
        staleTime: Math.min(staleTime, 20_000),
    });

    const controls = (controlsQuery.data?.data?.controls ?? defaultControls) as OperationsControls;
    const periods = useMemo(
        () => ((periodsQuery.data?.data?.periods ?? []) as FinancialPeriod[]),
        [periodsQuery.data?.data?.periods]
    );
    const approvals = useMemo(
        () => ((approvalsQuery.data?.data?.approvals ?? []) as OperationApproval[]),
        [approvalsQuery.data?.data?.approvals]
    );
    const pendingApprovals = useMemo(
        () => approvals.filter((entry) => entry.status === 'PENDING'),
        [approvals]
    );

    return {
        controls,
        periods,
        approvals,
        pendingApprovals,
        isLoading: controlsQuery.isLoading || periodsQuery.isLoading || approvalsQuery.isLoading,
        isRefetching: controlsQuery.isRefetching || periodsQuery.isRefetching || approvalsQuery.isRefetching,
        refetch: async () => Promise.all([controlsQuery.refetch(), periodsQuery.refetch(), approvalsQuery.refetch()]),
    };
}

export function useOperationsAuditLogs(limit = 50, options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 30_000;

    const query = useQuery({
        queryKey: operationsQueryKeys.auditLogs(businessId, { limit }),
        queryFn: () => operationsRepository.getAuditLogs(limit),
        enabled,
        staleTime,
    });

    const logs = useMemo(
        () => ((query.data?.data?.logs ?? []) as OperationsAuditLog[]),
        [query.data?.data?.logs]
    );

    return {
        ...query,
        logs,
    };
}
