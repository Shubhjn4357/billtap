import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateGodownQueries } from './useGodowns';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { godownRepository } from '../repositories/godownRepository';

type SaveGodownInput = Parameters<typeof godownRepository.create>[0];
type TransferGodownStockInput = Parameters<typeof godownRepository.transfer>[0];

export function useGodownMutations() {
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const saveMutation = useMutation({
        mutationFn: (payload: SaveGodownInput) => godownRepository.create(payload),
        onSuccess: async () => {
            await invalidateGodownQueries(queryClient, businessId);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => godownRepository.delete(id),
        onSuccess: async () => {
            await invalidateGodownQueries(queryClient, businessId);
        },
    });

    const transferMutation = useMutation({
        mutationFn: (payload: TransferGodownStockInput) => godownRepository.transfer(payload),
        onSuccess: async () => {
            await invalidateGodownQueries(queryClient, businessId);
        },
    });

    return {
        saveGodown: saveMutation.mutateAsync,
        deleteGodown: deleteMutation.mutateAsync,
        transferGodownStock: transferMutation.mutateAsync,
        isSavingGodown: saveMutation.isPending,
        isDeletingGodown: deleteMutation.isPending,
        isTransferringGodownStock: transferMutation.isPending,
    };
}
