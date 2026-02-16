import type { BillItem, Item } from '../types';
import { apiClient, ApiError } from './httpClient';
import { offlineSyncService } from './offlineSyncService';
import { isOnline } from '../utils/network';

const toItem = (raw: Item): Item => ({
    ...raw,
    nameLowercase: raw.nameLowercase ?? raw.name.toLowerCase(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
});

export const itemService = {
    async addItem(item: Omit<Item, 'id'>): Promise<string> {
        const localId = offlineSyncService.createLocalId('item');
        const normalized = toItem({
            ...item,
            id: localId,
        });

        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>('/items', {
                    id: localId,
                    name: item.name,
                    price: item.price,
                    purchasePrice: item.purchasePrice,
                    mrp: item.mrp,
                    stock: item.stock,
                    minimumStock: item.minimumStock,
                    openingStock: item.openingStock,
                    unit: item.unit,
                    hsn: item.hsn,
                    gstPercentage: item.gstPercentage,
                    category: item.category,
                    subcategory: item.subcategory,
                    location: item.location,
                    barcode: item.barcode,
                    imageUrl: item.imageUrl,
                    isActive: item.isActive,
                });

                if (!response.ok || !response.id) {
                    throw new Error(response.message || 'Failed to add item.');
                }

                await offlineSyncService.upsertCachedItem({
                    ...normalized,
                    id: response.id,
                });
                return response.id;
            } catch (error: unknown) {
                if (error instanceof ApiError) {
                    throw error;
                }
            }
        }

        await offlineSyncService.upsertCachedItem(normalized);
        await offlineSyncService.enqueueMutation({
            type: 'upsert_item',
            payload: {
                id: localId,
                name: normalized.name,
                nameLowercase: normalized.nameLowercase,
                price: normalized.price,
                stock: normalized.stock,
                purchasePrice: normalized.purchasePrice ?? null,
                mrp: normalized.mrp ?? null,
                minimumStock: normalized.minimumStock ?? null,
                unit: normalized.unit ?? null,
                hsn: normalized.hsn ?? null,
                gstPercentage: normalized.gstPercentage ?? null,
                category: normalized.category ?? null,
                subcategory: normalized.subcategory ?? null,
                location: normalized.location ?? null,
                barcode: normalized.barcode ?? null,
                imageUrl: normalized.imageUrl ?? null,
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
                if (error instanceof ApiError && error.status < 500) {
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
                purchasePrice: merged.purchasePrice ?? null,
                mrp: merged.mrp ?? null,
                minimumStock: merged.minimumStock ?? null,
                unit: merged.unit ?? null,
                hsn: merged.hsn ?? null,
                gstPercentage: merged.gstPercentage ?? null,
                category: merged.category ?? null,
                subcategory: merged.subcategory ?? null,
                location: merged.location ?? null,
                barcode: merged.barcode ?? null,
                imageUrl: merged.imageUrl ?? null,
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
                if (error instanceof ApiError && error.status < 500) {
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
                if (error instanceof ApiError && error.status < 500 && error.status !== 404) {
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
                if (error instanceof ApiError && error.status < 500) {
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
                if (error instanceof ApiError && error.status < 500) {
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
