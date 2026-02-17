import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billService, type StoredBill } from '../api/billService';
import { calculateBillStats } from '../utils/billStats';
import { useAuth } from './useAuth';
import { isNetworkLikeError } from '../utils/errorGuards';

const BILL_CACHE_TTL_MS = 30_000;

export const useBills = (enabled = true) => {
    const { user } = useAuth();
    const userId = user?.uid ?? null;

    const query = useQuery({
        queryKey: ['bills', userId, enabled] as const,
        queryFn: async (): Promise<StoredBill[]> => {
            if (!userId || !enabled) return [];
            return await billService.getUserBills(userId, 1000);
        },
        enabled: Boolean(userId) && enabled,
        staleTime: BILL_CACHE_TTL_MS,
    });

    const bills = useMemo(() => query.data ?? [], [query.data]);
    const error = query.error && !isNetworkLikeError(query.error)
        ? (query.error instanceof Error ? query.error.message : 'Failed to load bills.')
        : null;

    const fetchBills = useCallback(async () => {
        await query.refetch();
    }, [query]);

    const stats = useMemo(() => calculateBillStats(bills), [bills]);

    return {
        bills,
        loading: query.isFetching && bills.length === 0,
        error,
        fetchBills,
        stats,
    };
};
