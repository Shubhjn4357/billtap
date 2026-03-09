import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { Account } from '../types/domain';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { cashBankQueryKeys } from '../state/domainQueryKeys';
import { cashBankRepository } from '../repositories/cashBankRepository';

export type CashBankAccount = Account & { kind?: string };

export const getCashBankKindLabel = (account: CashBankAccount): string => {
    const kind = String(account.kind ?? '').toUpperCase();
    if (kind) return kind;
    const name = account.name.toLowerCase();
    if (name.includes('cash')) return 'CASH';
    if (name.includes('bank')) return 'BANK';
    if (name.includes('cheque')) return 'CHEQUE';
    return 'ACCOUNT';
};

export const invalidateCashBankQueries = async (
    queryClient: QueryClient,
    businessId?: string | null
) => {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: cashBankQueryKeys.balances(businessId) }),
        queryClient.invalidateQueries({ queryKey: cashBankQueryKeys.summary(businessId) }),
    ]);
};

export function useCashBankAccounts(options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 30_000;

    const query = useQuery({
        queryKey: cashBankQueryKeys.balances(businessId),
        queryFn: () => cashBankRepository.getBalances(),
        staleTime,
        enabled,
    });

    const accounts = useMemo(() => (query.data?.data ?? []) as CashBankAccount[], [query.data?.data]);
    const totalBalance = useMemo(
        () => accounts.reduce((sum, account) => sum + Number(account.balance ?? 0), 0),
        [accounts]
    );
    const stats = useMemo(() => ({
        total: accounts.length,
        cash: accounts.filter((entry) => getCashBankKindLabel(entry) === 'CASH').length,
        bank: accounts.filter((entry) => getCashBankKindLabel(entry) === 'BANK').length,
        cheque: accounts.filter((entry) => getCashBankKindLabel(entry) === 'CHEQUE').length,
    }), [accounts]);

    return {
        ...query,
        accounts,
        totalBalance,
        stats,
    };
}
