import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { cashBankRepository } from '../repositories/cashBankRepository';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { invalidateCashBankQueries } from './useCashBankAccounts';
import { invalidateAccountingAccountQueries } from './useAccountingAccounts';
import { reportQueryKeys } from '../state/domainQueryKeys';

const invalidateCashBankViews = async (queryClient: QueryClient, businessId?: string | null) => {
    await Promise.all([
        invalidateCashBankQueries(queryClient, businessId),
        invalidateAccountingAccountQueries(queryClient, businessId),
        queryClient.invalidateQueries({ queryKey: reportQueryKeys.all(businessId) }),
    ]);
};

export function useCashBankMutations() {
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const depositMutation = useMutation({
        mutationFn: (payload: Parameters<typeof cashBankRepository.deposit>[0]) => cashBankRepository.deposit(payload),
        onSuccess: async () => {
            await invalidateCashBankViews(queryClient, businessId);
        },
    });

    const withdrawMutation = useMutation({
        mutationFn: (payload: Parameters<typeof cashBankRepository.withdraw>[0]) => cashBankRepository.withdraw(payload),
        onSuccess: async () => {
            await invalidateCashBankViews(queryClient, businessId);
        },
    });

    const transferMutation = useMutation({
        mutationFn: (payload: Parameters<typeof cashBankRepository.transfer>[0]) => cashBankRepository.transfer(payload),
        onSuccess: async () => {
            await invalidateCashBankViews(queryClient, businessId);
        },
    });

    return {
        deposit: depositMutation.mutateAsync,
        withdraw: withdrawMutation.mutateAsync,
        transfer: transferMutation.mutateAsync,
        isDepositing: depositMutation.isPending,
        isWithdrawing: withdrawMutation.isPending,
        isTransferring: transferMutation.isPending,
    };
}
