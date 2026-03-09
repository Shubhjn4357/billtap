/**
 * useLedgers — shared ledger list query hook.
 *
 * Wraps React Query with search + type filter + sort.
 * Derives grouped ledgers for section-header list rendering.
 */

import { useMemo } from 'react';
import { LEDGER_TYPE_LABELS, type LedgerSortKey, type LedgerTypeFilter } from '../constants/reportOptions';
import { useAccountingLedgers } from './useAccountingLedgers';

export interface LedgerRow {
    id: string;
    code: string;
    name: string;
    type: string;
    debitTotal: number;
    creditTotal: number;
    balance: number;
    isActive: boolean;
    isSystem: boolean;
    isDefault: boolean;
}

export interface LedgerGroup {
    type: LedgerTypeFilter;
    label: string;
    rows: LedgerRow[];
    totalBalance: number;
}

export interface UseLedgersOptions {
    search?: string;
    typeFilter?: LedgerTypeFilter;
    sortBy?: LedgerSortKey;
    includeInactive?: boolean;
    enabled?: boolean;
}

export function useLedgers(options: UseLedgersOptions = {}) {
    const {
        search = '',
        typeFilter = 'ALL',
        sortBy = 'name_asc',
        includeInactive = false,
        enabled = true,
    } = options;

    const { allRows, isLoading, isRefetching, refetch } = useAccountingLedgers({
        includeInactive,
        enabled,
        staleTime: 60_000,
    });

    const filteredRows = useMemo(() => {
        let result = allRows;

        if (typeFilter !== 'ALL') {
            result = result.filter((r) => r.type.toUpperCase() === typeFilter);
        }

        if (search.trim()) {
            const needle = search.trim().toLowerCase();
            result = result.filter((r) =>
                `${r.name} ${r.code} ${r.type}`.toLowerCase().includes(needle)
            );
        }

        return [...result].sort((a, b) => {
            switch (sortBy) {
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'balance_asc': return (a.balance ?? 0) - (b.balance ?? 0);
                case 'balance_desc': return (b.balance ?? 0) - (a.balance ?? 0);
                default: return 0;
            }
        });
    }, [allRows, typeFilter, search, sortBy]);

    // Group by type for section-header rendering
    const groups = useMemo<LedgerGroup[]>(() => {
        const typeOrder: LedgerTypeFilter[] = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'];
        const map = new Map<LedgerTypeFilter, LedgerRow[]>();

        for (const row of filteredRows) {
            const key = (row.type.toUpperCase() as LedgerTypeFilter) in LEDGER_TYPE_LABELS
                ? (row.type.toUpperCase() as LedgerTypeFilter)
                : 'ASSET';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(row);
        }

        return typeOrder
            .filter((t) => map.has(t))
            .map((t) => ({
                type: t,
                label: LEDGER_TYPE_LABELS[t],
                rows: map.get(t)!,
                totalBalance: map.get(t)!.reduce((sum, r) => sum + (r.balance ?? 0), 0),
            }));
    }, [filteredRows]);

    const totals = useMemo(() => ({
        totalDebit: allRows.reduce((s, r) => s + (r.debitTotal ?? 0), 0),
        totalCredit: allRows.reduce((s, r) => s + (r.creditTotal ?? 0), 0),
        count: filteredRows.length,
        allCount: allRows.length,
    }), [allRows, filteredRows]);

    return {
        rows: filteredRows,
        groups,
        totals,
        allRows,
        typeLabels: LEDGER_TYPE_LABELS,
        isLoading,
        isRefetching,
        refetch,
    };
}
