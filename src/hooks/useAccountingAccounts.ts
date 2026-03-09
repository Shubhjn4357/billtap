import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { accountingRepository } from '../repositories/accountingRepository';
import type { Account } from '../types/domain';
import { accountingQueryKeys } from '../state/domainQueryKeys';
import { useBusinessQueryScope } from './useBusinessQueryScope';

export const invalidateAccountingAccountQueries = async (
    queryClient: QueryClient,
    businessId?: string | null
) => {
    await queryClient.invalidateQueries({ queryKey: accountingQueryKeys.all(businessId) });
};

export function useAccountingAccounts(options?: {
    type?: string;
    includeInactive?: boolean;
    enabled?: boolean;
    staleTime?: number;
}) {
    const businessId = useBusinessQueryScope();
    const type = options?.type;
    const includeInactive = options?.includeInactive ?? false;
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 30_000;

    const query = useQuery({
        queryKey: accountingQueryKeys.accounts(businessId, { type: type ?? null, includeInactive }),
        queryFn: () => accountingRepository.getAccounts({ ...(type ? { type } : {}), includeInactive }),
        enabled,
        staleTime,
    });

    const allAccounts = useMemo<Account[]>(
        () =>
            (query.data?.data?.accounts ?? []).map((entry) => ({
                id: entry.id,
                businessId: 'unknown',
                name: entry.name,
                code: entry.code,
                type: entry.type as Account['type'],
                parentAccountId: entry.parentId,
                isDefault: Boolean(entry.isDefault),
                isSystem: Boolean(entry.isSystem),
                isActive: Boolean(entry.isActive),
                balance: Number(entry.balance ?? 0),
            })),
        [query.data?.data?.accounts]
    );
    const accounts = useMemo(
        () => (includeInactive ? allAccounts : allAccounts.filter((entry) => entry.isActive !== false)),
        [allAccounts, includeInactive]
    );

    return {
        ...query,
        accounts,
        allAccounts,
    };
}

export function useAccountingAccountDetails(accountId?: string | null, options?: {
    includeInactive?: boolean;
    enabled?: boolean;
    staleTime?: number;
}) {
    const query = useAccountingAccounts({
        includeInactive: options?.includeInactive ?? true,
        enabled: Boolean(accountId) && (options?.enabled ?? true),
        staleTime: options?.staleTime,
    });

    const account = useMemo(
        () => query.allAccounts.find((entry) => entry.id === accountId) ?? null,
        [accountId, query.allAccounts]
    );

    return {
        ...query,
        account,
    };
}
