import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateLoanQueries } from './useLoans';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { loanRepository } from '../repositories/loanRepository';

type SaveLoanInput = Parameters<typeof loanRepository.create>[0];
type AddLoanTransactionInput = {
    loanId: string;
    payload: Parameters<typeof loanRepository.addTransaction>[1];
};

export function useLoanMutations() {
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const saveMutation = useMutation({
        mutationFn: (payload: SaveLoanInput) => loanRepository.create(payload),
        onSuccess: async () => {
            await invalidateLoanQueries(queryClient, businessId);
        },
    });

    const addTransactionMutation = useMutation({
        mutationFn: ({ loanId, payload }: AddLoanTransactionInput) => loanRepository.addTransaction(loanId, payload),
        onSuccess: async () => {
            await invalidateLoanQueries(queryClient, businessId);
        },
    });

    return {
        saveLoan: saveMutation.mutateAsync,
        addLoanTransaction: addTransactionMutation.mutateAsync,
        isSavingLoan: saveMutation.isPending,
        isSavingLoanTransaction: addTransactionMutation.isPending,
    };
}
