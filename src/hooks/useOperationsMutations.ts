import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { OperationsControls } from '../types/domain';
import { invalidateOperationsQueries } from './useOperations';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { operationsRepository } from '../repositories/operationsRepository';

export function useOperationsMutations() {
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const updateControlsMutation = useMutation({
        mutationFn: (payload: Partial<OperationsControls>) => operationsRepository.updateControls(payload),
        onSuccess: async () => {
            await invalidateOperationsQueries(queryClient, businessId);
        },
    });

    const lockPeriodMutation = useMutation({
        mutationFn: (payload: { periodStart?: string; periodEnd?: string; notes?: string }) =>
            operationsRepository.lockPeriod(payload),
        onSuccess: async () => {
            await invalidateOperationsQueries(queryClient, businessId);
        },
    });

    const closePeriodMutation = useMutation({
        mutationFn: (id: string) => operationsRepository.closePeriod(id),
        onSuccess: async () => {
            await invalidateOperationsQueries(queryClient, businessId);
        },
    });

    const reopenPeriodMutation = useMutation({
        mutationFn: (id: string) => operationsRepository.reopenPeriod(id),
        onSuccess: async () => {
            await invalidateOperationsQueries(queryClient, businessId);
        },
    });

    const approveApprovalMutation = useMutation({
        mutationFn: (id: string) => operationsRepository.approveApproval(id),
        onSuccess: async () => {
            await invalidateOperationsQueries(queryClient, businessId);
        },
    });

    const rejectApprovalMutation = useMutation({
        mutationFn: (payload: { id: string; note?: string }) =>
            operationsRepository.rejectApproval(payload.id, payload.note),
        onSuccess: async () => {
            await invalidateOperationsQueries(queryClient, businessId);
        },
    });

    return {
        updateControls: updateControlsMutation.mutateAsync,
        lockPeriod: lockPeriodMutation.mutateAsync,
        closePeriod: closePeriodMutation.mutateAsync,
        reopenPeriod: reopenPeriodMutation.mutateAsync,
        approveApproval: approveApprovalMutation.mutateAsync,
        rejectApproval: rejectApprovalMutation.mutateAsync,
        isSavingControls: updateControlsMutation.isPending,
        isLockingPeriod: lockPeriodMutation.isPending,
        isClosingPeriod: closePeriodMutation.isPending,
        isReopeningPeriod: reopenPeriodMutation.isPending,
        isApprovingApproval: approveApprovalMutation.isPending,
        isRejectingApproval: rejectApprovalMutation.isPending,
    };
}
