import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { businessRepository } from '../repositories/businessRepository';
import type { Business } from '../types/domain';
import { organizationQueryKeys } from '../state/domainQueryKeys';

export const invalidateOrganizationQueries = async (queryClient: QueryClient) => {
    await queryClient.invalidateQueries({ queryKey: organizationQueryKeys.mine() });
};

export function useOrganizations(options?: { enabled?: boolean; staleTime?: number }) {
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: organizationQueryKeys.mine(),
        queryFn: () => businessRepository.list(),
        enabled,
        staleTime,
    });

    const organizations = useMemo(
        () => ((query.data?.data ?? []) as Business[]),
        [query.data?.data]
    );

    return {
        ...query,
        organizations,
    };
}
