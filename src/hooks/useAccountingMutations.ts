import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { accountingRepository } from '../repositories/accountingRepository';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { invalidateAccountingAccountQueries } from './useAccountingAccounts';
import { invalidateCashBankQueries } from './useCashBankAccounts';
import { reportQueryKeys } from '../state/domainQueryKeys';

type SaveAccountingAccountInput = {
    id?: string;
    code: string;
    name: string;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
    parentId?: string | null;
};

const invalidateAccountingViews = async (queryClient: QueryClient, businessId?: string | null) => {
    await Promise.all([
        invalidateAccountingAccountQueries(queryClient, businessId),
        invalidateCashBankQueries(queryClient, businessId),
        queryClient.invalidateQueries({ queryKey: reportQueryKeys.all(businessId) }),
    ]);
};

export function useAccountingAccountMutations() {
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const saveMutation = useMutation({
        mutationFn: async (payload: SaveAccountingAccountInput) => {
            if (payload.id) {
                return accountingRepository.updateAccount(payload.id, {
                    code: payload.code,
                    name: payload.name,
                    ...(payload.parentId !== undefined ? { parentId: payload.parentId } : {}),
                });
            }
            return accountingRepository.createAccount({
                code: payload.code,
                name: payload.name,
                type: payload.type,
                ...(payload.parentId !== undefined ? { parentId: payload.parentId } : {}),
            });
        },
        onSuccess: async () => {
            await invalidateAccountingViews(queryClient, businessId);
        },
    });

    const deactivateMutation = useMutation({
        mutationFn: (accountId: string) => accountingRepository.deactivateAccount(accountId),
        onSuccess: async () => {
            await invalidateAccountingViews(queryClient, businessId);
        },
    });

    return {
        saveAccount: saveMutation.mutateAsync,
        deactivateAccount: deactivateMutation.mutateAsync,
        isSavingAccount: saveMutation.isPending,
        isDeactivatingAccount: deactivateMutation.isPending,
    };
}

export function useTrialBalance(options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: reportQueryKeys.trialBalance(businessId),
        queryFn: () => accountingRepository.getTrialBalance(),
        enabled,
        staleTime,
    });

    return {
        ...query,
        rows: query.data?.data?.rows ?? [],
        totals: query.data?.data?.totals ?? { debit: 0, credit: 0, isBalanced: true },
    };
}

export function useAccountingLedgerDetail(
    accountId?: string | null,
    options?: { limit?: number; enabled?: boolean; staleTime?: number }
) {
    const businessId = useBusinessQueryScope();
    const limit = options?.limit ?? 300;
    const enabled = Boolean(accountId) && (options?.enabled ?? true);
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: reportQueryKeys.ledgerDetail(businessId, accountId ?? 'unknown', { limit }),
        queryFn: () => accountingRepository.getLedger(accountId!, { limit }),
        enabled,
        staleTime,
    });

    return {
        ...query,
        account: query.data?.data?.account ?? null,
        entries: query.data?.data?.entries ?? [],
        currentBalance: Number(query.data?.data?.currentBalance ?? 0),
    };
}
