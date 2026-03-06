/**
 * useInvoices — shared invoice list query hook.
 *
 * Wraps React Query with search + type filter so BillingScreen,
 * HomeScreen dashboard, and any future screen share the same query key
 * and cache entry.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoiceApi } from '../api/endpoints';
import { PaymentStatus } from '../constants/enums';
import type { Invoice } from '../types/domain';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export type InvoiceQueryType =
    | 'TAX_INVOICE'
    | 'PURCHASE_BILL'
    | 'ESTIMATE'
    | 'SALE_ORDER'
    | 'PURCHASE_ORDER'
    | 'DELIVERY_CHALLAN'
    | 'SALE_RETURN'
    | 'PURCHASE_RETURN';

export type InvoiceDateRange = 'today' | 'week' | 'month' | 'all';
export type InvoiceStatusFilter = 'all' | 'paid' | 'overdue' | 'credit';

export interface UseInvoicesOptions {
    type?: InvoiceQueryType;
    search?: string;
    dateRange?: InvoiceDateRange;
    statusFilter?: InvoiceStatusFilter;
    limit?: number;
    enabled?: boolean;
}

export interface InvoicesSummary {
    total: number;
    paid: number;
    overdue: number;
    outstanding: number;
}

export function useInvoices(options: UseInvoicesOptions = {}) {
    const {
        type = 'TAX_INVOICE',
        search = '',
        dateRange = 'all',
        statusFilter = 'all',
        limit = 50,
        enabled = true,
    } = options;

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['invoices', type, dateRange, limit],
        queryFn: () => invoiceApi.list({ type, limit }),
        staleTime: 60_000,
        enabled,
    });

    const allInvoices: Invoice[] = useMemo(() => (data?.data as Invoice[] | undefined) ?? [], [data?.data]);

    const filteredInvoices = useMemo(() => {
        let result = allInvoices;

        // Text search
        if (search.trim()) {
            const needle = search.trim().toLowerCase();
            result = result.filter((inv) => {
                const byNo = inv.invoiceNumber.toLowerCase().includes(needle);
                const byParty = (inv.partySnapshot?.name ?? inv.party?.name ?? '').toLowerCase().includes(needle);
                return byNo || byParty;
            });
        }

        // Date range filter
        if (dateRange !== 'all') {
            const now = new Date();
            let from: Date;
            let to: Date;
            if (dateRange === 'today') { from = startOfDay(now); to = endOfDay(now); }
            else if (dateRange === 'week') { from = startOfWeek(now, { weekStartsOn: 1 }); to = endOfWeek(now, { weekStartsOn: 1 }); }
            else { from = startOfMonth(now); to = endOfMonth(now); }

            const fromStr = format(from, 'yyyy-MM-dd');
            const toStr = format(to, 'yyyy-MM-dd');
            result = result.filter((inv) => {
                const dateStr = inv.invoiceDate.slice(0, 10);
                return dateStr >= fromStr && dateStr <= toStr;
            });
        }

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter((inv) => {
                if (statusFilter === 'paid') return inv.paymentStatus === PaymentStatus.PAID;
                if (statusFilter === 'overdue') return inv.paymentStatus === PaymentStatus.OVERDUE;
                if (statusFilter === 'credit') return inv.paymentStatus !== PaymentStatus.PAID;
                return true;
            });
        }

        return result;
    }, [allInvoices, search, dateRange, statusFilter]);

    const summary: InvoicesSummary = useMemo(() => {
        let paid = 0;
        let overdue = 0;
        let outstanding = 0;
        for (const inv of filteredInvoices) {
            if (inv.paymentStatus === PaymentStatus.PAID) paid += 1;
            if (inv.paymentStatus === PaymentStatus.OVERDUE) overdue += 1;
            if (inv.paymentStatus !== PaymentStatus.PAID) {
                outstanding += Math.max(inv.totalInvoiceValue - (inv.paidAmount ?? 0), 0);
            }
        }
        return { total: filteredInvoices.length, paid, overdue, outstanding };
    }, [filteredInvoices]);

    return {
        invoices: filteredInvoices,
        allInvoices,
        summary,
        isLoading,
        isRefetching,
        refetch,
    };
}

export const formatInvoiceDate = (value: string): string => {
    try {
        return format(parseISO(value), 'dd MMM yyyy');
    } catch {
        return value.slice(0, 10);
    }
};
