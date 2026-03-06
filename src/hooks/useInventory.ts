/**
 * useInventory — shared item catalog query hook.
 *
 * Wraps React Query with search + category + stock-health filter + sort.
 * Used by InventoryScreen, DocumentCreateScreen add-item flow, and POS.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { itemApi } from '../api/endpoints';
import type { Item } from '../types/domain';

export type StockHealthFilter = 'all' | 'in' | 'low' | 'out';
export type InventorySortKey = 'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'price_asc' | 'price_desc';

export interface UseInventoryOptions {
    search?: string;
    category?: string | null;
    unit?: string | null;
    stockHealth?: StockHealthFilter;
    sortBy?: InventorySortKey;
    limit?: number;
    enabled?: boolean;
}

export const getStockHealth = (item: Item): StockHealthFilter => {
    if (!item.trackStock) return 'in';
    if (item.stock <= 0) return 'out';
    if (item.stock <= item.reorderLevel) return 'low';
    return 'in';
};

export function useInventory(options: UseInventoryOptions = {}) {
    const {
        search = '',
        category = null,
        unit = null,
        stockHealth = 'all',
        sortBy = 'name_asc',
        limit = 300,
        enabled = true,
    } = options;

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['items', search],
        queryFn: () => itemApi.list({ q: search || undefined, limit }),
        staleTime: 30_000,
        enabled,
    });

    const allItems: Item[] = useMemo(() => data?.items ?? [], [data?.items]);

    // Derive unique categories and units for filter UI
    const categories = useMemo(
        () => [...new Set(allItems.map((i) => i.category).filter(Boolean))] as string[],
        [allItems]
    );
    const units = useMemo(
        () => [...new Set(allItems.map((i) => i.unit).filter(Boolean))] as string[],
        [allItems]
    );

    const filteredItems = useMemo(() => {
        let result = allItems;

        if (category) {
            result = result.filter((i) => i.category === category);
        }
        if (unit) {
            result = result.filter((i) => i.unit === unit);
        }
        if (stockHealth !== 'all') {
            result = result.filter((i) => getStockHealth(i) === stockHealth);
        }

        // Sort
        result = [...result].sort((a, b) => {
            switch (sortBy) {
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'name_desc': return b.name.localeCompare(a.name);
                case 'stock_asc': return (a.stock ?? 0) - (b.stock ?? 0);
                case 'stock_desc': return (b.stock ?? 0) - (a.stock ?? 0);
                case 'price_asc': return (a.salePrice ?? 0) - (b.salePrice ?? 0);
                case 'price_desc': return (b.salePrice ?? 0) - (a.salePrice ?? 0);
                default: return 0;
            }
        });

        return result;
    }, [allItems, category, unit, stockHealth, sortBy]);

    const stats = useMemo(() => {
        let inStock = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let stockValue = 0;
        for (const item of allItems) {
            const health = getStockHealth(item);
            if (health === 'in') inStock += 1;
            if (health === 'low') lowStock += 1;
            if (health === 'out') outOfStock += 1;
            stockValue += Number(item.salePrice ?? 0) * Number(item.stock ?? 0);
        }
        return { inStock, lowStock, outOfStock, stockValue, total: allItems.length };
    }, [allItems]);

    return {
        items: filteredItems,
        allItems,
        categories,
        units,
        stats,
        isLoading,
        isRefetching,
        refetch,
    };
}
