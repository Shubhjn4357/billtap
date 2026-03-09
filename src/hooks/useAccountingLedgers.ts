import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingRepository } from '../repositories/accountingRepository';
import { reportQueryKeys } from '../state/domainQueryKeys';
import { useBusinessQueryScope } from './useBusinessQueryScope';

export interface AccountingLedgerRow {
    id: string;
    code: string;
    name: string;
    type: string;
    isSystem: boolean;
    isDefault: boolean;
    isActive: boolean;
    debitTotal: number;
    creditTotal: number;
    balance: number;
}

export function useAccountingLedgers(options?: {
    includeInactive?: boolean;
    limit?: number;
    enabled?: boolean;
    staleTime?: number;
}) {
    const businessId = useBusinessQueryScope();
    const includeInactive = options?.includeInactive ?? false;
    const limit = options?.limit;
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: reportQueryKeys.ledgers(businessId, { includeInactive }),
        queryFn: () => accountingRepository.getLedgers({ includeInactive }),
        staleTime,
        enabled,
    });

    const allRows = useMemo(
        () => ((query.data?.data?.data ?? []) as AccountingLedgerRow[]),
        [query.data?.data?.data]
    );
    const rows = useMemo(
        () => (typeof limit === 'number' ? allRows.slice(0, limit) : allRows),
        [allRows, limit]
    );

    return {
        ...query,
        rows,
        allRows,
        totals: query.data?.data?.totals ?? { debit: 0, credit: 0 },
    };
}
