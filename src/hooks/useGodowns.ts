import { useQuery, type QueryClient } from '@tanstack/react-query';
import { godownQueryKeys } from '../state/domainQueryKeys';
import { godownRepository } from '../repositories/godownRepository';
import { useBusinessQueryScope } from './useBusinessQueryScope';

export const invalidateGodownQueries = async (
    queryClient: QueryClient,
    businessId?: string | null
) => {
    await queryClient.invalidateQueries({ queryKey: godownQueryKeys.all(businessId) });
};

export function useGodowns(options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: godownQueryKeys.list(businessId),
        queryFn: () => godownRepository.list(),
        enabled,
        staleTime,
    });

    return {
        ...query,
        godowns: query.data?.data ?? [],
    };
}

export function useGodownStock(godownId?: string | null, options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const normalizedGodownId = godownId ?? 'unknown';
    const enabled = (options?.enabled ?? true) && Boolean(godownId);
    const staleTime = options?.staleTime ?? 30_000;

    const query = useQuery({
        queryKey: godownQueryKeys.stock(businessId, normalizedGodownId),
        queryFn: () => godownRepository.getStock(normalizedGodownId),
        enabled,
        staleTime,
    });

    return {
        ...query,
        stock: query.data?.data ?? [],
    };
}
