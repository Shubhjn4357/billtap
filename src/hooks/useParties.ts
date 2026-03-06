/**
 * useParties — shared party list query hook.
 *
 * Wraps React Query with search + type filter. Used by party-select,
 * ledgers, and the home dashboard receivables summary.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { partyApi } from '../api/endpoints';
import type { Party } from '../types/domain';
import { PartyType } from '../constants/enums';

export type PartyTypeFilter = 'ALL' | 'CUSTOMER' | 'SUPPLIER';

export interface UsePartiesOptions {
    search?: string;
    type?: PartyTypeFilter;
    limit?: number;
    enabled?: boolean;
}

export function useParties(options: UsePartiesOptions = {}) {
    const {
        search = '',
        type = 'ALL',
        limit = 200,
        enabled = true,
    } = options;

    const apiType = type === 'ALL' ? undefined : type;

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['parties', type, limit],
        queryFn: () => partyApi.list({ type: apiType, limit }),
        staleTime: 60_000,
        enabled,
    });

    const allParties: Party[] = useMemo(() => data?.data ?? [], [data?.data]);

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
