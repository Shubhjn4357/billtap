import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { itemService } from '../api/itemService';
import { useStockStore } from '../store';
import type { Item } from '../types';
import { useAuth } from './useAuth';
import { useDebouncedValue } from './useDebouncedValue';
import { isNetworkLikeError } from '../utils/errorGuards';

type NewStockItem = Omit<Item, 'id' | 'userId' | 'updatedAt' | 'nameLowercase'>;
type StockItemUpdate = Partial<Omit<Item, 'id' | 'userId' | 'updatedAt'>>;

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'Something went wrong. Please try again.';
};

const sortItemsByName = (data: Item[]) => {
    return [...data]
        .filter((item) => item.isActive !== false)
        .sort((a, b) => a.nameLowercase.localeCompare(b.nameLowercase));
};

export const useStock = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const {
        items,
        setItems,
        addItem: addToStore,
        updateItem: updateInStore,
        deleteItem: deleteFromStore,
    } = useStockStore();

    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQueryState] = useState('');
    const [searchPending, startSearchTransition] = useTransition();
    const debouncedSearchQuery = useDebouncedValue(searchQuery, 220);
    const queryKey = useMemo(() => ['stock-items', user?.uid ?? 'guest'] as const, [user?.uid]);

    const stockQuery = useQuery({
        queryKey,
        queryFn: async (): Promise<Item[]> => {
            if (!user) return [];
            return sortItemsByName(await itemService.getUserItems(user.uid));
        },
        enabled: Boolean(user),
        staleTime: 20_000,
    });

    useEffect(() => {
        if (!user) {
            setItems([]);
            setError(null);
            return;
        }

        if (stockQuery.data) {
            setItems(sortItemsByName(stockQuery.data));
            setError(null);
        }
    }, [setItems, stockQuery.data, user]);

    useEffect(() => {
        if (!stockQuery.error) return;
        if (isNetworkLikeError(stockQuery.error)) {
            setError(null);
            return;
        }
        setError(getErrorMessage(stockQuery.error));
    }, [stockQuery.error]);

    const invalidateStock = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    const setSearchQuery = useCallback((value: string) => {
        startSearchTransition(() => {
            setSearchQueryState(value);
        });
    }, [startSearchTransition]);

    const fetchItems = useCallback(async () => {
        if (!user) {
            setItems([]);
            setError(null);
            return;
        }

        const result = await stockQuery.refetch();
        if (result.data) {
            setItems(sortItemsByName(result.data));
        }

        if (result.error && !isNetworkLikeError(result.error)) {
            setError(getErrorMessage(result.error));
        }
    }, [setItems, stockQuery, user]);

    const normalizedSearch = debouncedSearchQuery.trim().toLowerCase();
    const filteredItems = useMemo(() => {
        if (!normalizedSearch) {
            return items;
        }

        return items.filter((item) =>
            item.nameLowercase.includes(normalizedSearch) ||
            (item.barcode && item.barcode.includes(debouncedSearchQuery.trim()))
        );
    }, [items, normalizedSearch, debouncedSearchQuery]);

    const addItem = async (item: NewStockItem) => {
        if (!user) throw new Error('You must be logged in to add items.');

        setActionLoading(true);
        setError(null);
        try {
            const payload = {
                ...item,
                userId: user.uid,
                nameLowercase: item.name.trim().toLowerCase(),
                updatedAt: new Date(),
            };

            const id = await itemService.addItem(payload);
            addToStore({ id, ...payload });
            invalidateStock();
        } catch (err: unknown) {
            if (!isNetworkLikeError(err)) {
                const message = getErrorMessage(err);
                setError(message);
                throw new Error(message);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const updateItem = async (id: string, updates: StockItemUpdate) => {
        if (!user) throw new Error('You must be logged in to update items.');

        setActionLoading(true);
        setError(null);
        try {
            const originalItem = items.find((entry) => entry.id === id);
            const nextName = typeof updates.name === 'string' ? updates.name.trim() : originalItem?.name || '';

            updateInStore(id, {
                ...updates,
                name: nextName,
                nameLowercase: nextName.toLowerCase(),
                updatedAt: new Date(),
            });

            await itemService.updateItem(id, updates);
            invalidateStock();
        } catch (err: unknown) {
            if (!isNetworkLikeError(err)) {
                const message = getErrorMessage(err);
                setError(message);
                await fetchItems();
                throw new Error(message);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const deleteItem = async (id: string) => {
        if (!user) throw new Error('You must be logged in to delete items.');

        setActionLoading(true);
        setError(null);
        try {
            deleteFromStore(id);
            await itemService.deleteItem(id);
            invalidateStock();
        } catch (err: unknown) {
            if (!isNetworkLikeError(err)) {
                const message = getErrorMessage(err);
                setError(message);
                await fetchItems();
                throw new Error(message);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const adjustStock = async (id: string, qty: number, type: 'IN' | 'OUT', reason?: string) => {
        if (!user) throw new Error('You must be logged in to update stock.');

        setActionLoading(true);
        setError(null);
        try {
            const current = items.find((entry) => entry.id === id);
            if (current) {
                const nextStock = type === 'IN' ? current.stock + qty : current.stock - qty;
                updateInStore(id, { stock: nextStock });
            }

            await itemService.updateStock(id, qty, type, reason);
            invalidateStock();
        } catch (err: unknown) {
            if (!isNetworkLikeError(err)) {
                const message = getErrorMessage(err);
                setError(message);
                await fetchItems();
                throw new Error(message);
            }
        } finally {
            setActionLoading(false);
        }
    };

    return {
        items: filteredItems,
        allItems: items,
        loading: actionLoading || (stockQuery.isFetching && items.length === 0),
        error,
        searchPending,
        searchQuery,
        setSearchQuery,
        fetchItems,
        addItem,
        updateItem,
        deleteItem,
        adjustStock,
    };
};
