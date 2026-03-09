/**
 * useParties — shared party list query hook.
 *
 * Wraps React Query with search + type filter. Used by party-select,
 * ledgers, and the home dashboard receivables summary.
 */

import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { Party } from '../types/domain';
import { PartyType } from '../constants/enums';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { partyQueryKeys } from '../state/domainQueryKeys';
import { partyRepository } from '../repositories/partyRepository';

export type PartyTypeFilter = 'ALL' | 'CUSTOMER' | 'SUPPLIER';

export interface UsePartiesOptions {
    search?: string;
    type?: PartyTypeFilter;
    limit?: number;
    enabled?: boolean;
    staleTime?: number;
}

export interface UsePartyRecycleBinOptions {
    limit?: number;
    enabled?: boolean;
    staleTime?: number;
}

export const invalidatePartyQueries = async (
    queryClient: QueryClient,
    businessId?: string | null
) => {
    await queryClient.invalidateQueries({ queryKey: partyQueryKeys.all(businessId) });
};

export function useParties(options: UsePartiesOptions = {}) {
    const {
        search = '',
        type = 'ALL',
        limit = 200,
        enabled = true,
        staleTime = 60_000,
    } = options;
    const businessId = useBusinessQueryScope();

    const apiType = type === 'ALL' ? undefined : type;

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: partyQueryKeys.list(businessId, { type, limit }),
        queryFn: () => partyRepository.list({ type: apiType, limit }),
        staleTime,
        enabled,
    });

    const allParties: Party[] = useMemo(
        () => ((data?.data ?? []) as Party[]).filter((party) => party.isActive !== false),
        [data?.data]
    );

    const filteredParties = useMemo(() => {
        if (!search.trim()) return allParties;
        const needle = search.trim().toLowerCase();
        return allParties.filter(
            (p) =>
                p.name.toLowerCase().includes(needle) ||
                (p.phone ?? '').includes(needle) ||
                (p.gstin ?? '').toLowerCase().includes(needle)
        );
    }, [allParties, search]);

    const stats = useMemo(() => {
        const customers = allParties.filter((p) => p.type === PartyType.CUSTOMER);
        const suppliers = allParties.filter((p) => p.type === PartyType.SUPPLIER);
        const totalReceivable = customers.reduce((sum, p) => sum + (p.openingBalance ?? 0), 0);
        const totalPayable = suppliers.reduce((sum, p) => sum + (p.openingBalance ?? 0), 0);
        return {
            totalCustomers: customers.length,
            totalSuppliers: suppliers.length,
            totalReceivable,
            totalPayable,
        };
    }, [allParties]);

    return {
        parties: filteredParties,
        allParties,
        stats,
        isLoading,
        isRefetching,
        refetch,
    };
}

export function usePartyRecycleBin(options: UsePartyRecycleBinOptions = {}) {
    const {
        limit = 250,
        enabled = true,
        staleTime = 15_000,
    } = options;
    const businessId = useBusinessQueryScope();

    const query = useQuery({
        queryKey: partyQueryKeys.recycleBin(businessId, { limit }),
        queryFn: () => partyRepository.recycleBin({ limit }),
        staleTime,
        enabled,
    });

    const parties = useMemo(
        () => (query.data?.data ?? []) as Party[],
        [query.data?.data]
    );

    return {
        ...query,
        parties,
    };
}
