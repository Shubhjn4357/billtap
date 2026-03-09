import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { loanQueryKeys } from '../state/domainQueryKeys';
import type { Loan, LoanTransaction } from '../types/domain';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { loanRepository } from '../repositories/loanRepository';

export type UseLoansOptions = {
    search?: string;
    limit?: number;
    enabled?: boolean;
    staleTime?: number;
};

const toAmount = (value: unknown) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

export const invalidateLoanQueries = async (
    queryClient: QueryClient,
    businessId?: string | null
) => {
    await queryClient.invalidateQueries({ queryKey: loanQueryKeys.all(businessId) });
};

export function useLoans(options: UseLoansOptions = {}) {
    const businessId = useBusinessQueryScope();
    const {
        search = '',
        limit,
        enabled = true,
        staleTime = 60_000,
    } = options;

    const query = useQuery({
        queryKey: loanQueryKeys.list(businessId),
        queryFn: () => loanRepository.list(),
        staleTime,
        enabled,
    });

    const allLoans = useMemo(
        () => ((query.data?.data ?? []) as Loan[]).filter((entry) => entry.isActive !== false),
        [query.data?.data]
    );
    const filteredLoans = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return allLoans;
        return allLoans.filter((entry) =>
            [
                entry.lenderBorrowerName,
                entry.loanType,
                entry.interestType,
                entry.notes,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(needle))
        );
    }, [allLoans, search]);

    const loans = useMemo(
        () => (typeof limit === 'number' ? filteredLoans.slice(0, limit) : filteredLoans),
        [filteredLoans, limit]
    );

    const stats = useMemo(() => {
        const totalBorrowed = allLoans
            .filter((entry) => entry.loanType !== 'GIVEN')
            .reduce((sum, entry) => sum + toAmount(entry.currentBalance), 0);
        const totalLent = allLoans
            .filter((entry) => entry.loanType === 'GIVEN')
            .reduce((sum, entry) => sum + toAmount(entry.currentBalance), 0);
        const dueLoans = allLoans.filter((entry) => entry.dueDate).length;
        return {
            totalBorrowed,
            totalLent,
            dueLoans,
            count: allLoans.length,
        };
    }, [allLoans]);

    return {
        ...query,
        loans,
        allLoans,
        stats,
    };
}

export function useLoanDetails(loanId?: string | null, options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = (options?.enabled ?? true) && Boolean(loanId);
    const staleTime = options?.staleTime ?? 30_000;
    const normalizedLoanId = loanId ?? 'unknown';

    const loanQuery = useQuery({
        queryKey: loanQueryKeys.detail(businessId, normalizedLoanId),
        queryFn: () => loanRepository.get(normalizedLoanId),
        enabled,
        staleTime,
    });

    const transactionQuery = useQuery({
        queryKey: loanQueryKeys.transactions(businessId, normalizedLoanId),
        queryFn: () => loanRepository.getTransactions(normalizedLoanId),
        enabled,
        staleTime,
    });

    const loan = loanQuery.data?.data ?? null;
    const transactions = useMemo(
        () => (transactionQuery.data?.data ?? loan?.transactions ?? []) as LoanTransaction[],
        [loan?.transactions, transactionQuery.data?.data]
    );

    return {
        loan,
        transactions,
        isLoading: loanQuery.isLoading,
        isRefetching: loanQuery.isRefetching || transactionQuery.isRefetching,
        refetch: async () => Promise.all([loanQuery.refetch(), transactionQuery.refetch()]),
    };
}
