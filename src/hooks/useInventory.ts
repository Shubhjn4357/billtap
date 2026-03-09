/**
 * useInventory — shared item catalog query hook.
 *
 * Wraps React Query with search + category + stock-health filter + sort.
 * Used by InventoryScreen, DocumentCreateScreen add-item flow, and POS.
 */

import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { Item } from '../types/domain';
import { itemQueryKeys } from '../state/domainQueryKeys';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { itemRepository } from '../repositories/itemRepository';

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

export interface UseItemCatalogOptions {
    search?: string;
    limit?: number;
    enabled?: boolean;
    staleTime?: number;
}

export interface UseItemRecycleBinOptions {
    limit?: number;
    enabled?: boolean;
    staleTime?: number;
}

export const getStockHealth = (item: Item): StockHealthFilter => {
    if (!item.trackStock) return 'in';
    if (item.stock <= 0) return 'out';
    if (item.stock <= item.reorderLevel) return 'low';
    return 'in';
};

export const invalidateItemQueries = async (
    queryClient: QueryClient,
    businessId?: string | null
) => {
    await queryClient.invalidateQueries({ queryKey: itemQueryKeys.all(businessId) });
};

export function useItemCatalog(options: UseItemCatalogOptions = {}) {
    const businessId = useBusinessQueryScope();
    const {
        search = '',
        limit = 300,
        enabled = true,
        staleTime = 30_000,
    } = options;

    const query = useQuery({
        queryKey: itemQueryKeys.list(businessId, { limit }),
        queryFn: () => itemRepository.list({ limit }),
        staleTime,
        enabled,
    });

    const allItems: Item[] = useMemo(
        () => ((query.data?.items ?? []) as Item[]).filter((item) => item.isActive !== false),
        [query.data?.items]
    );
    const items = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return allItems;
        return allItems.filter((item) =>
            [
                item.name,
                item.barcode,
                item.sku,
                item.category,
                item.hsnCode,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(needle))
        );
    }, [allItems, search]);

    return {
        ...query,
        items,
        allItems,
    };
}

export function useItemDetails(itemId?: string | null, options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = (options?.enabled ?? true) && Boolean(itemId);
    const staleTime = options?.staleTime ?? 30_000;
    const normalizedItemId = itemId ?? 'unknown';

    const query = useQuery({
        queryKey: itemQueryKeys.detail(businessId, normalizedItemId),
        queryFn: () => itemRepository.get(normalizedItemId),
        enabled,
        staleTime,
    });

    return {
        ...query,
        item: query.data?.item ?? null,
    };
}

export function useItemRecycleBin(options: UseItemRecycleBinOptions = {}) {
    const businessId = useBusinessQueryScope();
    const {
        limit = 250,
        enabled = true,
        staleTime = 15_000,
    } = options;

    const query = useQuery({
        queryKey: itemQueryKeys.recycleBin(businessId, { limit }),
        queryFn: () => itemRepository.recycleBin({ limit }),
        staleTime,
        enabled,
    });

    const items = useMemo(
        () => (query.data?.items ?? []) as Item[],
        [query.data?.items]
    );

    return {
        ...query,
        items,
    };
}

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

    const catalog = useItemCatalog({
        search,
        limit,
        enabled,
        staleTime: 30_000,
    });
    const allItems = catalog.allItems;

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
        let result = catalog.items;

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
    }, [catalog.items, category, unit, stockHealth, sortBy]);

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
        isLoading: catalog.isLoading,
        isRefetching: catalog.isRefetching,
        refetch: catalog.refetch,
    };
}
