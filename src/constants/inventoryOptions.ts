import type { InventorySortKey, StockHealthFilter } from '../hooks/useInventory';

export const INVENTORY_SORT_OPTIONS: { key: InventorySortKey; label: string }[] = [
    { key: 'name_asc', label: 'Name A-Z' },
    { key: 'name_desc', label: 'Name Z-A' },
    { key: 'stock_desc', label: 'Stock High-Low' },
    { key: 'stock_asc', label: 'Stock Low-High' },
    { key: 'price_desc', label: 'Price High-Low' },
    { key: 'price_asc', label: 'Price Low-High' },
];

export const INVENTORY_STOCK_FILTER_OPTIONS: { key: StockHealthFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'in', label: 'In Stock' },
    { key: 'low', label: 'Low Stock' },
    { key: 'out', label: 'Out of Stock' },
];
