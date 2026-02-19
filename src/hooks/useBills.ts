import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type StoredBill } from '../api/billService';
import { billRepository } from '../repositories/billRepository';
import { useOrganizationStore } from '../store';
import { calculateBillStats } from '../utils/billStats';
import { isNetworkLikeError } from '../utils/errorGuards';
import type { DbTransaction } from '../types/db';

const BILL_CACHE_TTL_MS = 30_000;

interface UseBillsOptions {
    limit?: number;
}

const mapTransactionToBill = (tx: DbTransaction): StoredBill => {
    let items: any[] = [];
    try {
        items = tx.itemsSnapshot ? JSON.parse(tx.itemsSnapshot) : [];
    } catch {
        items = [];
    }

    return {
        id: tx.id,
        userId: tx.organizationId ?? '', // Mapping organizationId to userId for compatibility
        billNumber: tx.billNumber ?? undefined,
        customerName: tx.partyName ?? undefined,
        customerPhone: undefined,
        businessName: undefined,
        businessAddress: undefined,
        gstNumber: undefined,
        currency: tx.currency ?? 'INR',
        items,
        total: tx.totalAmount,
        createdAt: tx.billDate ?? tx.createdAt,
        taxAmount: tx.taxAmount ?? 0,
        type: tx.type as any,
        billMode: tx.billMode as any,
    };
};

export const useBills = (enabled = true, options: UseBillsOptions = {}) => {
    const organizationId = useOrganizationStore(s => s.selectedOrganizationId);
    const limit = options.limit ?? 1000;

    const query = useQuery({
        queryKey: ['bills', organizationId, limit] as const,
        queryFn: async (): Promise<StoredBill[]> => {
            if (!organizationId || !enabled) return [];
            const transactions = await billRepository.getAll(organizationId);
            return transactions.slice(0, limit).map(mapTransactionToBill);
        },
        enabled: Boolean(organizationId) && enabled,
        staleTime: BILL_CACHE_TTL_MS,
        placeholderData: (previous) => previous,
    });
    const { refetch: refetchBills } = query;

    const bills = useMemo(() => query.data ?? [], [query.data]);
    const error = query.error && !isNetworkLikeError(query.error)
        ? (query.error instanceof Error ? query.error.message : 'Failed to load bills.')
        : null;

    const fetchBills = useCallback(async () => {
        await refetchBills();
    }, [refetchBills]);

    const stats = useMemo(() => calculateBillStats(bills), [bills]);

    return {
        bills,
        loading: query.isFetching && bills.length === 0,
        error,
        fetchBills,
        stats,
    };
};
