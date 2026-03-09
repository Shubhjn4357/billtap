import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Invoice, Party } from '../types/domain';
import { invoiceRepository } from '../repositories/invoiceRepository';
import { partyRepository } from '../repositories/partyRepository';
import { partyQueryKeys } from '../state/domainQueryKeys';
import { useBusinessQueryScope } from './useBusinessQueryScope';

export function usePartyDetails(partyId?: string | null, options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = Boolean(partyId) && (options?.enabled ?? true);
    const staleTime = options?.staleTime ?? 30_000;
    const normalizedPartyId = partyId ?? 'unknown';

    const partyQuery = useQuery({
        queryKey: partyQueryKeys.detail(businessId, normalizedPartyId),
        queryFn: () => partyRepository.get(normalizedPartyId),
        enabled,
        staleTime,
    });

    const invoiceQuery = useQuery({
        queryKey: partyQueryKeys.invoices(businessId, normalizedPartyId),
        queryFn: () => invoiceRepository.list({ partyId: normalizedPartyId, limit: 20 }),
        enabled,
        staleTime,
    });

    const party = (partyQuery.data?.data ?? null) as Party | null;
    const invoices = useMemo(
        () => ((invoiceQuery.data?.data ?? []) as Invoice[]).filter((entry) => entry.partyId === normalizedPartyId),
        [invoiceQuery.data?.data, normalizedPartyId]
    );

    return {
        party,
        invoices,
        isLoading: partyQuery.isLoading,
        isRefetching: partyQuery.isRefetching || invoiceQuery.isRefetching,
        refetch: async () => Promise.all([partyQuery.refetch(), invoiceQuery.refetch()]),
    };
}
