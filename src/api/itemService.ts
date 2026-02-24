import type { BillItem, Item } from '../types';
import { apiClient } from './httpClient';
import { offlineSyncService } from './syncService';
import { isOnline } from '../utils/network';
import { shouldThrowClientApiError } from '../utils/errorGuards';

const toItem = (raw: Item): Item => ({
    ...raw,
    nameLowercase: (raw.nameLowercase && raw.nameLowercase.trim()) || raw.name.toLowerCase(),
    hsn: typeof raw.hsn === 'string' && raw.hsn.trim().length > 0 ? raw.hsn.trim() : undefined,
    category: typeof raw.category === 'string' && raw.category.trim().length > 0 ? raw.category.trim() : undefined,
    subcategory: typeof raw.subcategory === 'string' && raw.subcategory.trim().length > 0 ? raw.subcategory.trim() : undefined,
    location: typeof raw.location === 'string' && raw.location.trim().length > 0 ? raw.location.trim() : undefined,
    barcode: typeof raw.barcode === 'string' && raw.barcode.trim().length > 0 ? raw.barcode.trim() : undefined,
    imageUrl: typeof raw.imageUrl === 'string' && raw.imageUrl.trim().length > 0 ? raw.imageUrl.trim() : undefined,
    updatedAt: raw.updatedAt || new Date().toISOString(),
});

export const itemService = {
    async addItem(item: Omit<Item, 'id'>): Promise<string> {
        const localId = offlineSyncService.createLocalId('item');
        const normalized = toItem({
            ...item,
            id: localId,
        });

        // 1. If Online: Attempt direct creation
        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>('/items', normalized);
                if (response.ok && response.id) {
                    const finalItem = toItem({ ...normalized, id: response.id });
                    await offlineSyncService.upsertCachedItem(finalItem);
                    return response.id;
                }
                if (!response.ok) throw new Error(response.message || 'Failed to sync item.');
            } catch (error: unknown) {
                if (shouldThrowClientApiError(error)) throw error;
            }
        }

        // 2. Offline Fallback
        await offlineSyncService.upsertCachedItem(normalized);
        await offlineSyncService.enqueueMutation({
            type: 'upsert_item',
            payload: {
                id: localId,
                name: normalized.name,
                nameLowercase: normalized.nameLowercase,
                price: normalized.price,
                stock: normalized.stock,
                purchasePrice: normalized.purchasePrice ?? undefined,
                mrp: normalized.mrp ?? undefined,
                minimumStock: normalized.minimumStock ?? undefined,
                unit: normalized.unit ?? undefined,
                hsn: normalized.hsn ?? undefined,
                gstPercentage: normalized.gstPercentage ?? undefined,
                category: normalized.category ?? undefined,
                subcategory: normalized.subcategory ?? undefined,
                location: normalized.location ?? undefined,
                barcode: normalized.barcode ?? undefined,
                imageUrl: normalized.imageUrl ?? undefined,
                isActive: normalized.isActive ?? true,
            },
        });

        return localId;
    },


    async updateItem(id: string, updates: Partial<Item>): Promise<void> {
        const current = await this.getItem(id);
        if (!current) {
            throw new Error('Item not found.');
        }

        const merged = toItem({
            ...current,
            ...updates,
            id,
            name: typeof updates.name === 'string' ? updates.name : current.name,
            nameLowercase: typeof updates.name === 'string'
                ? updates.name.toLowerCase()
                : current.nameLowercase,
            updatedAt: new Date().toISOString(),
        });

        await offlineSyncService.upsertCachedItem(merged);

        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/items/${id}`, {
                    name: merged.name,
                    price: merged.price,
                    purchasePrice: merged.purchasePrice,
                    mrp: merged.mrp,
                    stock: merged.stock,
                    minimumStock: merged.minimumStock,
                    unit: merged.unit,
                    hsn: merged.hsn,
                    gstPercentage: merged.gstPercentage,
                    category: merged.category,
                    subcategory: merged.subcategory,
                    location: merged.location,
                    barcode: merged.barcode,
                    imageUrl: merged.imageUrl,
                    isActive: merged.isActive,
                });

                if (!response.ok) {
                    throw new Error(response.message || 'Failed to update item.');
                }

                return;
            } catch (error: unknown) {
                if (shouldThrowClientApiError(error)) {
                    throw error;
                }
            }
        }

        await offlineSyncService.enqueueMutation({
            type: 'upsert_item',
            payload: {
                id: merged.id,
                name: merged.name,
                nameLowercase: merged.nameLowercase,
                price: merged.price,
                stock: merged.stock,
                purchasePrice: merged.purchasePrice ?? undefined,
                mrp: merged.mrp ?? undefined,
                minimumStock: merged.minimumStock ?? undefined,
                unit: merged.unit ?? undefined,
                hsn: merged.hsn ?? undefined,
                gstPercentage: merged.gstPercentage ?? undefined,
                category: merged.category ?? undefined,
                subcategory: merged.subcategory ?? undefined,
                location: merged.location ?? undefined,
                barcode: merged.barcode ?? undefined,
                imageUrl: merged.imageUrl ?? undefined,
                isActive: merged.isActive ?? true,
            },
        });
    },

    async updateStock(id: string, qty: number, type: 'IN' | 'OUT', reason?: string): Promise<void> {
        if (qty <= 0) {
            throw new Error('Quantity must be greater than 0.');
        }

        const item = await this.getItem(id);
        if (!item) {
            throw new Error('Item not found.');
        }

        const nextStock = type === 'IN' ? item.stock + qty : item.stock - qty;
        if (type === 'OUT' && nextStock < 0) {
            throw new Error(`Insufficient stock for "${item.name}".`);
        }

        // Optimistic update locally
        await offlineSyncService.upsertCachedItem({ ...item, stock: nextStock });

        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.post<{ ok: boolean; message?: string }>(`/items/${id}/adjust`, {
                    type,
                    quantity: qty,
                    reason,
                });

                if (!response.ok) {
                    throw new Error(response.message || 'Failed to adjust stock.');
                }
                return;
            } catch (error: unknown) {
                if (shouldThrowClientApiError(error)) {
                    // Revert on client error
                    await offlineSyncService.upsertCachedItem({ ...item, stock: item.stock });
                    throw error;
                }
            }
        }

        // Offline fallback: Use regular item update which queues a full upsert
        // We lose the "reason" / specific movement record for now, but stock is correct.
        await this.updateItem(id, { stock: nextStock });
    },

    async consumeStock(itemsToConsume: Pick<BillItem, 'id' | 'quantity'>[]): Promise<void> {
        const grouped = new Map<string, number>();
        for (const item of itemsToConsume) {
            if (item.quantity <= 0) continue;
            grouped.set(item.id, (grouped.get(item.id) ?? 0) + item.quantity);
        }

        for (const [id, qty] of grouped.entries()) {
            await this.updateStock(id, qty, 'OUT');
        }
    },

    async deleteItem(id: string): Promise<void> {
        await offlineSyncService.removeCachedItem(id);

        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.delete<{ ok: boolean; message?: string }>(`/items/${id}`);
                if (!response.ok) {
                    throw new Error(response.message || 'Failed to delete item.');
                }
                return;
            } catch (error: unknown) {
                if (shouldThrowClientApiError(error) && error.status !== 404) {
                    throw error;
                }
            }
        }

        await offlineSyncService.enqueueMutation({
            type: 'delete_item',
            payload: { id },
        });
    },

    async getUserItems(_userId: string): Promise<Item[]> {
        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.get<{ ok: boolean; items?: Item[]; message?: string }>('/items?limit=500');
                if (!response.ok || !response.items) {
                    throw new Error(response.message || 'Failed to fetch items.');
                }

                const normalized = response.items.map(toItem);
                await offlineSyncService.setCachedItems(normalized);
                return normalized;
            } catch (error: unknown) {
                if (shouldThrowClientApiError(error)) {
                    throw error;
                }
            }
        }

        return await offlineSyncService.getCachedItems();
    },

    async getItem(id: string): Promise<Item | null> {
        const cached = await offlineSyncService.getCachedItems();
        const cachedItem = cached.find((entry) => entry.id === id) ?? null;

        const online = await isOnline();
        if (!online) {
            return cachedItem;
        }

        try {
            await offlineSyncService.flushQueue();
            const response = await apiClient.get<{ ok: boolean; item?: Item; message?: string }>(`/items/${id}`);
            if (!response.ok || !response.item) return null;
            const normalized = toItem(response.item);
            await offlineSyncService.upsertCachedItem(normalized);
            return normalized;
        } catch {
            return cachedItem;
        }
    },

    async searchItems(_userId: string, queryText: string): Promise<Item[]> {
        const query = queryText.trim().toLowerCase();
        const cached = await offlineSyncService.getCachedItems();

        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const encoded = encodeURIComponent(queryText);
                const response = await apiClient.get<{ ok: boolean; items?: Item[]; message?: string }>(`/items?q=${encoded}&limit=500`);

                if (!response.ok || !response.items) {
                    throw new Error(response.message || 'Failed to search items.');
                }

                const normalized = response.items.map(toItem);
                await offlineSyncService.setCachedItems(normalized);
                return normalized;
            } catch (error: unknown) {
                if (shouldThrowClientApiError(error)) {
                    throw error;
                }
            }
        }

        if (!query) {
            return cached;
        }

        return cached.filter((item) =>
            item.nameLowercase.includes(query) ||
            (item.barcode && item.barcode.includes(queryText.trim()))
        );
    }
};
