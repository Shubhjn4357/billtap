import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { ExpenseCategory } from '../constants/enums';
import type { Expense } from '../types/domain';
import { expenseQueryKeys } from '../state/domainQueryKeys';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { expenseRepository } from '../repositories/expenseRepository';

export type ExpenseCategoryFilter = 'ALL' | ExpenseCategory;

export type UseExpensesOptions = {
    search?: string;
    category?: ExpenseCategoryFilter;
    limit?: number;
    enabled?: boolean;
    staleTime?: number;
    recycleBin?: boolean;
};

export const invalidateExpenseQueries = async (
    queryClient: QueryClient,
    businessId?: string | null
) => {
    await queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all(businessId) });
};

export function useExpenses(options: UseExpensesOptions = {}) {
    const businessId = useBusinessQueryScope();
    const {
        search = '',
        category = 'ALL',
        limit = 150,
        enabled = true,
        staleTime = 60_000,
        recycleBin = false,
    } = options;

    const query = useQuery({
        queryKey: recycleBin
            ? expenseQueryKeys.recycleBin(businessId, { limit })
            : expenseQueryKeys.list(businessId, { category, limit }),
        queryFn: () => recycleBin
            ? expenseRepository.recycleBin({ limit })
            : expenseRepository.list({
                category: category === 'ALL' ? undefined : category,
                limit,
            }),
        staleTime,
        enabled,
    });

    const allExpenses = useMemo(
        () =>
            ((query.data?.data ?? []) as Expense[]).filter((entry) =>
                recycleBin ? entry.isDeleted === true : entry.isDeleted !== true
            ),
        [query.data?.data, recycleBin]
    );

    const expenses = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return allExpenses;
        return allExpenses.filter((entry) =>
            [
                entry.category,
                entry.description,
                entry.paymentMode,
                entry.partyName,
                entry.partyId,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(needle))
        );
    }, [allExpenses, search]);

    const stats = useMemo(() => {
        const total = allExpenses.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
        const average = allExpenses.length > 0 ? total / allExpenses.length : 0;
        const categoriesUsed = new Set(allExpenses.map((entry) => entry.category).filter(Boolean)).size;
        return {
            total,
            average,
            categoriesUsed,
            count: allExpenses.length,
        };
    }, [allExpenses]);

    return {
        ...query,
        expenses,
        allExpenses,
        stats,
    };
}
