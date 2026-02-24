import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useOrganizationStore } from '../store';
import { billRepository, type DbTransaction } from '../repositories/billRepository';
import type { BillItem, TransactionType } from '../types';
import { billService, type StoredBill, type CachedBill } from '../api/billService';
import { calculateBillStats } from '../utils/billStats';
import { isNetworkLikeError } from '../utils/errorGuards';

const BILL_CACHE_TTL_MS = 30_000;

interface UseBillsOptions {
    limit?: number;
}

/**
 * Maps a DbTransaction row to a fully-typed CachedBill so all consumers
 * get paymentStatus, paidAmount, dueAmount, paymentMode, partyId, partyName
 * without any runtime casting.
 */
const mapTransactionToBill = (tx: DbTransaction): CachedBill => {
    let items: BillItem[] = [];
    try {
        items = tx.itemsSnapshot ? JSON.parse(tx.itemsSnapshot) as BillItem[] : [];
    } catch (error) {
        console.error('Failed to parse itemsSnapshot:', error);
        items = [];
    }
    return {
        id: tx.id,
        userId: tx.organizationId ?? '',
        billNumber: tx.billNumber ?? undefined,
        customerName: tx.partyName ?? undefined,
        customerPhone: tx.partyPhone ?? undefined,
        businessName: tx.businessName ?? undefined,
        businessAddress: tx.businessAddress ?? tx.billingAddress ?? undefined,
        gstNumber: tx.gstNumber ?? undefined,
        currency: tx.currency ?? 'INR',
        items,
        total: tx.totalAmount,
        createdAt: tx.billDate ?? tx.createdAt,
        taxAmount: tx.taxAmount ?? 0,
        type: tx.type as TransactionType,
        billMode: tx.billMode as 'GST' | 'ESTIMATE',
        // CachedBill runtime payment fields
        paymentStatus: (tx.paymentStatus as CachedBill['paymentStatus']) ?? 'PENDING',
        paidAmount: tx.paidAmount ?? 0,
        dueAmount: Math.max(0, tx.totalAmount - (tx.paidAmount ?? 0)),
        paymentMode: (tx.paymentMode as CachedBill['paymentMode']) ?? 'CASH',
        partyId: tx.partyId ?? undefined,
        partyName: tx.partyName ?? undefined,
    };
};

/**
 * useBills — returns CachedBill[] so all payment fields are accessible
 * without any cast at the call site.
 *
 * Recommendation from walkthrough: useBills now returns CachedBill[] directly,
 * removing the need for `bills as CachedBill[]` casts in DashboardScreen / ReportsScreen.
 */
const mapStoredBillToCachedBill = (bill: StoredBill): CachedBill => ({
    ...bill,
    items: bill.items.map(item => ({
        ...item,
        tax: item.tax ?? 0,
        total: item.total ?? (item.price * item.quantity),
    })),
    type: bill.type ?? 'SALE',
    paymentStatus: (bill as any).paymentStatus || (bill.total <= 0 ? 'PAID' : 'PENDING'),
    paymentMode: (bill as any).paymentMode || 'CASH',
});

export const useBills = (enabled = true, options: UseBillsOptions = {}) => {
    const organizationId = useOrganizationStore(s => s.selectedOrganizationId);
    const userId = useOrganizationStore(s => s.context.ownerUserId) || '';
    const limit = options.limit ?? 1000;

    const query = useQuery({
        queryKey: ['bills', organizationId, limit] as const,
        queryFn: async (): Promise<CachedBill[]> => {
            if (!organizationId || !enabled) return [];

            if (Platform.OS === 'web') {
                const bills = await billService.getUserBills(userId, limit);
                return bills.map(mapStoredBillToCachedBill);
            }

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
