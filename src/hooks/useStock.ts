
import { useState, useEffect, useCallback } from 'react';
import { itemService } from '../api/itemService';
import { Item } from '../types';
import { useAuth } from './useAuth';

export const useStock = () => {
    const { user } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchItems = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const data = await itemService.getUserItems(user.uid);
            setItems(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Initial fetch when user logs in
    useEffect(() => {
        if (user) {
            fetchItems();
        } else {
            setItems([]);
        }
    }, [user, fetchItems]);

    // Local Search filtering
    const filteredItems = items.filter(item => 
        item.nameLowercase.includes(searchQuery.toLowerCase()) || 
        (item.barcode && item.barcode.includes(searchQuery))
    );

    const addItem = async (item: Omit<Item, 'id' | 'userId' | 'updatedAt' | 'nameLowercase'>) => {
        if (!user) return;
        setLoading(true);
        try {
            await itemService.addItem({
                ...item,
                userId: user.uid,
                nameLowercase: item.name.toLowerCase(),
                updatedAt: new Date(),
            });
            await fetchItems(); // Refresh list
        } catch (err: any) {
            setError(err.message);
            throw err;
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
        addItem
    };
};
