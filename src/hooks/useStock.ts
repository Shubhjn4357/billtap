
import { useCallback, useEffect, useMemo, useState } from 'react';
import { itemService } from '../api/itemService';
import { useStockStore } from '../store';
import type { Item } from '../types';
import { useAuth } from './useAuth';
import { useDebouncedValue } from './useDebouncedValue';

type NewStockItem = Omit<Item, 'id' | 'userId' | 'updatedAt' | 'nameLowercase'>;
type StockItemUpdate = Partial<Omit<Item, 'id' | 'userId' | 'updatedAt'>>;

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'Something went wrong. Please try again.';
};

const sortItemsByName = (data: Item[]) => {
    return [...data].sort((a, b) => a.nameLowercase.localeCompare(b.nameLowercase));
};

export const useStock = () => {
    const { user } = useAuth();
    const { items, setItems, addItem: addToStore, updateItem: updateInStore, deleteItem: deleteFromStore } = useStockStore();

    // We keep local loading/error for the fetch operation specifically, 
    // though store also has them, we might want to separate "syncing" from "display".
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebouncedValue(searchQuery, 220);

    const fetchItems = useCallback(async () => {
        if (!user) {
            setItems([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await itemService.getUserItems(user.uid);
            setItems(sortItemsByName(data));
        } catch (error: unknown) {
            console.error('Fetch items error:', error);
            setError(getErrorMessage(error));
            // If offline, we just keep existing items in store (persisted)
        } finally {
            setLoading(false);
        }
    }, [user, setItems]);

    useEffect(() => {
        if (user) {
            // Initial fetch on mount if user exists
            // We could also check if items are empty to avoid refetching if we trust persistence
            // For now, let's fetch to sync.
            void fetchItems();
        } else {
            setItems([]);
        }
    }, [user, fetchItems, setItems]);

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

        setLoading(true);
        setError(null);
        try {
            const payload = {
                ...item,
                userId: user.uid,
                nameLowercase: item.name.trim().toLowerCase(),
                updatedAt: new Date(),
            };

            // Optimistic update could go here, but waiting for ID from server is safer for now
            const id = await itemService.addItem(payload);

            const newItem = { id, ...payload };
            addToStore(newItem);

            // Re-sort handled by store? No, store appends. 
            // We should probably re-sort or insert in order.
            // For now, simple append is fine, sort happens on render/selector.

        } catch (error: unknown) {
            const message = getErrorMessage(error);
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    };

    const updateItem = async (id: string, updates: StockItemUpdate) => {
        if (!user) throw new Error('You must be logged in to update items.');

        setLoading(true);
        setError(null);
        try {
            // Optimistic update
            const originalItem = items.find(i => i.id === id);
            const nextName = typeof updates.name === 'string' ? updates.name.trim() : originalItem?.name || '';

            updateInStore(id, {
                ...updates,
                name: nextName,
                nameLowercase: nextName.toLowerCase(), 
                updatedAt: new Date()
            });

            await itemService.updateItem(id, updates);
        } catch (error: unknown) {
            // Revert changes? (Would need complex revert logic)
            // For now just error
            const message = getErrorMessage(error);
            setError(message);
            // In a real app, we would reload items here to ensure consistency
            void fetchItems(); 
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    };

    const deleteItem = async (id: string) => {
        if (!user) throw new Error('You must be logged in to delete items.');

        setLoading(true);
        setError(null);
        try {
            updateInStore(id, { isActive: false }); // Optimistic hide? Or delete?
            // Actually delete from store
            deleteFromStore(id);

            await itemService.deleteItem(id);
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            setError(message);
            void fetchItems();
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    };

    return {
        items: filteredItems,
        allItems: items,
        loading,
        error,
        searchQuery,
        setSearchQuery,
        fetchItems,
        addItem,
        updateItem,
        deleteItem,
    };
};
