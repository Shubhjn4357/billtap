import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billService, type StoredBill } from '../api/billService';
import { calculateBillStats } from '../utils/billStats';
import { useAuth } from './useAuth';
import { isNetworkLikeError } from '../utils/errorGuards';

const BILL_CACHE_TTL_MS = 30_000;

interface UseBillsOptions {
    limit?: number;
}

export const useBills = (enabled = true, options: UseBillsOptions = {}) => {
    const { user } = useAuth();
    const userId = user?.uid ?? null;
    const limit = options.limit ?? 1000;

    const query = useQuery({
        queryKey: ['bills', userId, limit] as const,
        queryFn: async (): Promise<StoredBill[]> => {
            if (!userId || !enabled) return [];
            return await billService.getUserBills(userId, limit);
        },
        enabled: Boolean(userId) && enabled,
        staleTime: BILL_CACHE_TTL_MS,
        placeholderData: (previous) => previous,
    });
    const { refetch: refetchBills } = query;

    const bills = useMemo(() => query.data ?? [], [query.data]);
    const error = query.error && !isNetworkLikeError(query.error)
        ? (query.error instanceof Error ? query.error.message : 'Failed to load bills.')
        : null;

    const fetchBills = useCallback(async () => {
        await refetchBills();
    }, [refetchBills]);

    const stats = useMemo(() => calculateBillStats(bills), [bills]);

    return {
        bills,
        loading: query.isFetching && bills.length === 0,
        error,
        fetchBills,
        stats,
    };
};
