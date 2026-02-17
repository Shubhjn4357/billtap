import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { marketingService } from '../api/marketingService';
import type { MarketingOffer } from '../types';
import { useAuth } from './useAuth';
import { isNetworkLikeError } from '../utils/errorGuards';

const OFFERS_CACHE_TTL_MS = 60_000;

export const useOffers = () => {
    const { user } = useAuth();
    const userKey = user?.uid ?? 'guest';
    const subscriptionStatus = user?.subscriptionStatus ?? 'inactive';

    const query = useQuery({
        queryKey: ['offers', userKey, subscriptionStatus] as const,
        queryFn: async (): Promise<MarketingOffer[]> => {
            return await marketingService.getActiveOffersForUser(user ?? null);
        },
        staleTime: OFFERS_CACHE_TTL_MS,
    });

    const offers = useMemo(() => query.data ?? [], [query.data]);
    const error = query.error && !isNetworkLikeError(query.error)
        ? (query.error instanceof Error ? query.error.message : 'Failed to load offers.')
        : null;

    const fetchOffers = useCallback(async () => {
        await query.refetch();
    }, [query]);

    const primaryOffer = useMemo(() => offers[0] ?? null, [offers]);

    return {
        offers,
        primaryOffer,
        loading: query.isFetching && offers.length === 0,
        error,
        fetchOffers,
    };
};
