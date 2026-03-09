import { useQuery } from '@tanstack/react-query';
import type { Invoice } from '../types/domain';
import { invoiceRepository } from '../repositories/invoiceRepository';
import { invoiceQueryKeys } from '../state/domainQueryKeys';
import { useBusinessQueryScope } from './useBusinessQueryScope';

export function useInvoiceDetail(invoiceId?: string | null, options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = Boolean(invoiceId) && (options?.enabled ?? true);
    const staleTime = options?.staleTime ?? 30_000;
    const normalizedInvoiceId = invoiceId ?? 'unknown';

    const query = useQuery({
        queryKey: invoiceQueryKeys.detail(businessId, normalizedInvoiceId),
        queryFn: () => invoiceRepository.get(normalizedInvoiceId),
        enabled,
        staleTime,
    });

    return {
        ...query,
        invoice: (query.data?.data ?? null) as Invoice | null,
    };
}
