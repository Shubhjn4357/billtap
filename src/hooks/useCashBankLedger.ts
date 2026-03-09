import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cashBankRepository } from '../repositories/cashBankRepository';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { cashBankQueryKeys } from '../state/domainQueryKeys';

export type CashBankLedgerEntry = {
    id?: string;
    voucherId?: string;
    voucherType?: string;
    voucherNumber?: string;
    date?: string;
    narration?: string | null;
    debit?: number;
    credit?: number;
    runningBalance?: number;
};

export function useCashBankLedger(accountId?: string | null, options?: { limit?: number; enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = Boolean(accountId) && (options?.enabled ?? true);
    const limit = options?.limit ?? 200;
    const staleTime = options?.staleTime ?? 30_000;

    const query = useQuery({
        queryKey: accountId ? cashBankQueryKeys.ledger(businessId, accountId) : [...cashBankQueryKeys.all(businessId), 'ledger', 'missing'],
        queryFn: () => cashBankRepository.getLedger(accountId!, { limit }),
        enabled,
        staleTime,
    });

    const entries = useMemo(
        () => (query.data?.data?.entries ?? []) as CashBankLedgerEntry[],
        [query.data?.data?.entries]
    );

    return {
        ...query,
        entries,
        currentBalance: Number(query.data?.data?.currentBalance ?? 0),
        accountName: query.data?.data?.accountName ?? null,
        accountKind: query.data?.data?.accountKind ?? null,
    };
}
