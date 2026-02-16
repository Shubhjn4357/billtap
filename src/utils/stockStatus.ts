import type { Item } from '../types';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export type StockHealth = 'in' | 'low' | 'out';

export const resolveLowStockThreshold = (item: Pick<Item, 'minimumStock'>): number => {
    const threshold = Number(item.minimumStock ?? DEFAULT_LOW_STOCK_THRESHOLD);
    if (!Number.isFinite(threshold) || threshold <= 0) {
        return DEFAULT_LOW_STOCK_THRESHOLD;
    }

    return Math.floor(threshold);
};

export const getStockHealth = (item: Pick<Item, 'stock' | 'minimumStock'>): StockHealth => {
    if (item.stock <= 0) {
        return 'out';
    }

    return item.stock <= resolveLowStockThreshold(item) ? 'low' : 'in';
};

export const isLowStock = (item: Pick<Item, 'stock' | 'minimumStock'>): boolean => {
    return getStockHealth(item) === 'low';
};
