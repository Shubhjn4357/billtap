import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subscriptionRepository } from '../repositories/subscriptionRepository';
import type { Offer, Plan } from '../types/domain';
import { subscriptionQueryKeys } from '../state/domainQueryKeys';

export function useActiveOffers(options?: { enabled?: boolean; staleTime?: number }) {
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: subscriptionQueryKeys.offers(),
        queryFn: () => subscriptionRepository.getOfferList(),
        enabled,
        staleTime,
    });

    const offers = useMemo(() => (query.data?.data ?? []) as Offer[], [query.data?.data]);

    return {
        ...query,
        offers,
    };
}

export function useSubscriptionPlans(options?: { enabled?: boolean; staleTime?: number }) {
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: subscriptionQueryKeys.plans(),
        queryFn: () => subscriptionRepository.getPlans(),
        enabled,
        staleTime,
    });

    const plans = useMemo(() => (query.data?.data ?? []) as Plan[], [query.data?.data]);

    return {
        ...query,
        plans,
    };
}
