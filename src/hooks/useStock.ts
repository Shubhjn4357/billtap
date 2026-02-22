import { Platform } from 'react-native';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { itemRepository } from '../repositories/itemRepository';
import { itemService } from '../api/itemService';
import { useStockStore } from '../store';
import type { Item } from '../types';
import { useAuth } from './useAuth';
import { useDebouncedValue } from './useDebouncedValue';
import { randomUUID } from 'expo-crypto';
import type { NewDbItem } from '../types/db';
import { mapDbItemToAppItem } from '../utils/mappers';

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
    const organizationId = user?.uid; // Assuming Owner UID is Org ID for now, adjust if needed

    const stockQuery = useQuery({
        queryKey,
        queryFn: async (): Promise<Item[]> => {
            if (!user || !organizationId) return [];

            if (Platform.OS === 'web') {
                return await itemService.getUserItems(user.uid);
            }

            // Load from SQLite Repository
            const localItems = await itemRepository.getAll(organizationId);
            return sortItemsByName(localItems.map(mapDbItemToAppItem));
        },
        enabled: Boolean(user),
        staleTime: 5000, 
        placeholderData: (previous) => previous,
    });
    const { refetch: refetchStock } = stockQuery;

    useEffect(() => {
        if (!user) {
            setItems([]);
            setError(null);
            return;
        }

        if (stockQuery.data) {
            setItems(stockQuery.data);
            setError(null);
        }
    }, [setItems, stockQuery.data, user]);

    useEffect(() => {
        if (!stockQuery.error) return;
        setError(getErrorMessage(stockQuery.error));
    }, [stockQuery.error]);

    const invalidateStock = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey });
        void refetchStock();
    }, [queryClient, queryKey, refetchStock]);

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
        await refetchStock();
    }, [refetchStock, setItems, user]);

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



    const deleteItem = async (id: string) => {
        if (!user || !organizationId) throw new Error('You must be logged in to delete items.');

        setActionLoading(true);
        setError(null);
        try {
            deleteFromStore(id);
            if (Platform.OS === 'web') {
                await itemService.deleteItem(id);
            } else {
                await itemRepository.delete(id, organizationId);
            }
            invalidateStock();
        } catch (err: unknown) {
            const message = getErrorMessage(err);
            setError(message);
            throw new Error(message);
        } finally {
            setActionLoading(false);
        }
    };

    const addItem = async (itemPayload: NewStockItem) => {
        if (!user || !organizationId) throw new Error('You must be logged in to add items.');

        setActionLoading(true);
        setError(null);
        try {
            const id = randomUUID();
            // Map to DB Schema
            const fullItem: NewDbItem = {
                id,
                organizationId,
                name: itemPayload.name.trim(),
                nameLowercase: itemPayload.name.trim().toLowerCase(),
                price: itemPayload.price,
                purchasePrice: itemPayload.purchasePrice ?? 0,
                mrp: itemPayload.mrp ?? 0,
                hsn: itemPayload.hsn,
                gstPercentage: itemPayload.gstPercentage ?? 0,
                stock: itemPayload.stock ?? 0,
                minimumStock: itemPayload.minimumStock ?? 0,
                unit: itemPayload.unit ?? 'pcs',
                category: itemPayload.category,
                image: itemPayload.imageUrl, // Mapped to 'image' property as per schema
                barcode: itemPayload.barcode,
                isActive: true, // Boolean mode handled by Drizzle
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            };

            if (Platform.OS === 'web') {
                await itemService.addItem(itemPayload as any);
            } else {
                await itemRepository.create(fullItem);
            }

            addToStore(fullItem as any);
            invalidateStock();
        } catch (err: unknown) {
            const message = getErrorMessage(err);
            setError(message);
            throw new Error(message);
        } finally {
            setActionLoading(false);
        }
    };

    const updateItem = async (id: string, updates: StockItemUpdate) => {
        if (!user || !organizationId) throw new Error('You must be logged in to update items.');

        setActionLoading(true);
        setError(null);
        try {
            const originalItem = items.find((entry) => entry.id === id);
            if (!originalItem) throw new Error('Item not found');

            const nextName = typeof updates.name === 'string' ? updates.name.trim() : originalItem.name;

            // Construct full object to satisfy upsert's NewDbItem requirement
            // We merge originalItem props (which might match NewDbItem mostly) with updates
            const mergedItem: NewDbItem = {
                id: originalItem.id,
                organizationId: organizationId,
                name: nextName,
                nameLowercase: nextName.toLowerCase(),
                price: updates.price ?? originalItem.price,
                purchasePrice: updates.purchasePrice ?? originalItem.purchasePrice ?? 0,
                mrp: updates.mrp ?? originalItem.mrp ?? 0,
                hsn: updates.hsn ?? originalItem.hsn ?? undefined,
                gstPercentage: updates.gstPercentage ?? originalItem.gstPercentage ?? 0,
                stock: updates.stock ?? originalItem.stock ?? 0,
                minimumStock: updates.minimumStock ?? originalItem.minimumStock ?? 0,
                unit: updates.unit ?? originalItem.unit ?? 'pcs',
                category: updates.category ?? originalItem.category,
                image: updates.imageUrl ?? originalItem.imageUrl, // Mapped to 'image' property
                barcode: updates.barcode ?? originalItem.barcode,
                isActive: updates.isActive ?? originalItem.isActive ?? true,
                updatedAt: new Date().toISOString(),
                createdAt: originalItem.createdAt ? new Date(originalItem.createdAt).toISOString() : new Date().toISOString(),
            };

            if (Platform.OS === 'web') {
                await itemService.updateItem(id, updates as any);
            } else {
                await itemRepository.update(mergedItem.id, mergedItem);
            }
            updateInStore(id, mergedItem as any);
            invalidateStock();
        } catch (err: unknown) {
            const message = getErrorMessage(err);
            setError(message);
            throw new Error(message);
        } finally {
            setActionLoading(false);
        }
    };

    // ...

    const adjustStock = async (id: string, qty: number, type: 'IN' | 'OUT', reason?: string) => {
        if (!user || !organizationId) throw new Error('You must be logged in to update stock.');

        setActionLoading(true);
        setError(null);
        try {
            const current = items.find((entry) => entry.id === id);
            if (current) {
                const nextStock = type === 'IN' ? (current.stock || 0) + qty : (current.stock || 0) - qty;

                const updatedItem: NewDbItem = {
                    id: current.id,
                    organizationId: organizationId,
                    name: current.name,
                    nameLowercase: current.nameLowercase,
                    price: current.price,
                    purchasePrice: current.purchasePrice ?? 0,
                    mrp: current.mrp ?? 0,
                    hsn: current.hsn,
                    gstPercentage: current.gstPercentage ?? 0,
                    stock: nextStock,
                    minimumStock: current.minimumStock ?? 0,
                    unit: current.unit ?? 'pcs',
                    category: current.category,
                    image: current.imageUrl, // Map from Item's imageUrl to DbItem's image
                    barcode: current.barcode,
                    isActive: current.isActive ?? true,
                    createdAt: current.createdAt ? new Date(current.createdAt).toISOString() : new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                if (Platform.OS === 'web') {
                    await itemService.updateStock(id, qty, type, reason);
                } else {
                    await itemRepository.update(updatedItem.id, updatedItem);
                }
                updateInStore(id, { stock: nextStock });
            }
            invalidateStock();
        } catch (err: unknown) {
            const message = getErrorMessage(err);
            setError(message);
            throw new Error(message);
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
