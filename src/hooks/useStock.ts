
import { useCallback, useEffect, useMemo, useState } from 'react';
import { itemService } from '../api/itemService';
import type { Item } from '../types';
import { useAuth } from './useAuth';

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
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

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
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            void fetchItems();
            return;
        }
        setItems([]);
        setError(null);
    }, [user, fetchItems]);

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredItems = useMemo(() => {
        if (!normalizedSearch) {
            return items;
        }

        return items.filter((item) =>
            item.nameLowercase.includes(normalizedSearch) ||
            (item.barcode && item.barcode.includes(searchQuery.trim()))
        );
    }, [items, normalizedSearch, searchQuery]);

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
            const id = await itemService.addItem(payload);

            setItems((current) => sortItemsByName([
                ...current,
                {
                    id,
                    ...payload,
                },
            ]));
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
            await itemService.updateItem(id, updates);
            setItems((current) => {
                const next = current.map((item) => {
                    if (item.id !== id) return item;

                    const nextName = typeof updates.name === 'string' ? updates.name.trim() : item.name;
                    const merged: Item = {
                        ...item,
                        ...updates,
                        name: nextName,
                        nameLowercase: nextName.toLowerCase(),
                        updatedAt: new Date(),
                    };
                    return merged;
                });

                return sortItemsByName(next);
            });
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            setError(message);
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
            await itemService.deleteItem(id);
            setItems((current) => current.filter((item) => item.id !== id));
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            setError(message);
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
