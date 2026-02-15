import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, ApiError } from './httpClient';
import { isOnline } from '../utils/network';
import type { AnalyticsEventType, BillItem, Item, UserProfile, TransactionType } from '../types';

const OFFLINE_QUEUE_KEY = 'billtap_offline_queue_v1';
const ITEM_CACHE_KEY = 'billtap_item_cache_v1';
const BILL_CACHE_KEY = 'billtap_bill_cache_v1';

interface QueueMutationBase {
    id: string;
    createdAt: string;
}

interface OfflineItemPayload {
    id: string;
    name: string;
    nameLowercase: string;
    price: number;
    stock: number;
    category?: string | null;
    barcode?: string | null;
}

interface OfflineBillPayload {
    id: string;
    type?: TransactionType;
    partyId?: string;
    customerName?: string;
    customerPhone?: string;
    businessName?: string;
    businessAddress?: string;
    gstNumber?: string;
    currency?: string;
    billNumber?: string;
    billDate?: string;
    items: BillItem[];
    total: number;
    createdAt: string;
}

type OfflineMutation =
    | (QueueMutationBase & {
        type: 'upsert_item';
        payload: OfflineItemPayload;
    })
    | (QueueMutationBase & {
        type: 'delete_item';
        payload: { id: string };
    })
    | (QueueMutationBase & {
        type: 'create_bill';
        payload: OfflineBillPayload;
    })
    | (QueueMutationBase & {
        type: 'update_user_me';
        payload: Partial<UserProfile>;
    })
    | (QueueMutationBase & {
        type: 'analytics_event';
        payload: {
            eventType: AnalyticsEventType;
            source?: string;
            planId?: string;
            offerId?: string;
            value?: number;
            currency?: string;
            metadata?: Record<string, string | number | boolean>;
        };
    });

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;

    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

const writeJson = async <T>(key: string, value: T) => {
    await AsyncStorage.setItem(key, JSON.stringify(value));
};

const normalizeItem = (item: Item): Item => ({
    ...item,
    nameLowercase: item.nameLowercase ?? item.name.toLowerCase(),
    updatedAt: item.updatedAt ?? new Date().toISOString(),
});

const sortItems = (itemsToSort: Item[]) => {
    return [...itemsToSort].sort((a, b) => a.nameLowercase.localeCompare(b.nameLowercase));
};

const sortBills = <T extends { createdAt?: string | number | Date }>(entries: T[]) => {
    return [...entries].sort((a, b) => {
        const dateA = new Date(a.createdAt ?? 0).getTime();
        const dateB = new Date(b.createdAt ?? 0).getTime();
        return dateB - dateA;
    });
};

const shouldDropMutation = (error: unknown, mutation: OfflineMutation) => {
    if (!(error instanceof ApiError)) return false;
    if (mutation.type === 'delete_item' && error.status === 404) return true;
    if (mutation.type === 'analytics_event' && error.status === 400) return true;
    return false;
};

const shouldStopFlush = (error: unknown) => {
    if (!(error instanceof ApiError)) return true;
    return error.status === 401 || error.status === 403 || error.status >= 500;
};

const applyMutation = async (mutation: OfflineMutation): Promise<void> => {
    switch (mutation.type) {
        case 'upsert_item': {
            const payload = {
                name: mutation.payload.name,
                price: mutation.payload.price,
                stock: mutation.payload.stock,
                category: mutation.payload.category ?? undefined,
                barcode: mutation.payload.barcode ?? undefined,
            };

            try {
                const patchResponse = await apiClient.patch<{ ok: boolean; message?: string }>(
                    `/items/${encodeURIComponent(mutation.payload.id)}`,
                    payload
                );
                if (!patchResponse.ok) {
                    throw new Error(patchResponse.message || 'Failed to update item.');
                }
            } catch (error: unknown) {
                if (!(error instanceof ApiError) || error.status !== 404) {
                    throw error;
                }

                const createResponse = await apiClient.post<{ ok: boolean; id?: string; message?: string }>('/items', {
                    id: mutation.payload.id,
                    ...payload,
                });

                if (!createResponse.ok) {
                    throw new Error(createResponse.message || 'Failed to create item.');
                }
            }
            return;
        }
        case 'delete_item': {
            try {
                const response = await apiClient.delete<{ ok: boolean; message?: string }>(
                    `/items/${encodeURIComponent(mutation.payload.id)}`
                );
                if (!response.ok) {
                    throw new Error(response.message || 'Failed to delete item.');
                }
            } catch (error: unknown) {
                if (error instanceof ApiError && error.status === 404) {
                    return;
                }
                throw error;
            }
            return;
        }
        case 'create_bill': {
            const lineItems = mutation.payload.items.map((line) => ({
                id: line.id,
                name: line.name,
                quantity: line.quantity,
                price: line.price,
                tax: Number(line.tax ?? 0),
                total: Number(line.total ?? line.quantity * line.price),
            }));
            const taxAmount = lineItems.reduce((sum, line) => {
                const taxable = line.quantity * line.price;
                return sum + (taxable * line.tax) / 100;
            }, 0);

            const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>('/transactions', {
                id: mutation.payload.id,
                type: mutation.payload.type ?? 'SALE',
                partyId: mutation.payload.partyId ?? undefined,
                partyName: mutation.payload.customerName,
                partyPhone: mutation.payload.customerPhone,
                businessName: mutation.payload.businessName,
                businessAddress: mutation.payload.businessAddress,
                gstNumber: mutation.payload.gstNumber,
                currency: mutation.payload.currency ?? 'INR',
                billNumber: mutation.payload.billNumber,
                billDate: mutation.payload.billDate ?? mutation.payload.createdAt,
                items: lineItems,
                totalAmount: mutation.payload.total,
                discountAmount: 0,
                taxAmount,
            });

            if (!response.ok) {
                throw new Error(response.message || 'Failed to create bill.');
            }
            return;
        }
        case 'update_user_me': {
            const response = await apiClient.patch<{ ok: boolean; user?: UserProfile; message?: string }>(
                '/users/me',
                mutation.payload
            );
            if (!response.ok) {
                throw new Error(response.message || 'Failed to update user.');
            }
            return;
        }
        case 'analytics_event': {
            const response = await apiClient.post<{ ok: boolean; message?: string }>('/analytics/events', mutation.payload);
            if (!response.ok) {
                throw new Error(response.message || 'Failed to log analytics event.');
            }
            return;
        }
        default:
            return;
    }
};

const generateLocalId = (prefix: string) => {
    const random = Math.random().toString(36).slice(2, 10);
    const stamp = Date.now().toString(36);
    return `local_${prefix}_${stamp}_${random}`;
};

export const offlineSyncService = {
    createLocalId(prefix: string) {
        return generateLocalId(prefix);
    },

    async getCachedItems(): Promise<Item[]> {
        const data = await readJson<Item[]>(ITEM_CACHE_KEY, []);
        return sortItems(data.map(normalizeItem));
    },

    async setCachedItems(itemsToPersist: Item[]): Promise<void> {
        await writeJson(ITEM_CACHE_KEY, sortItems(itemsToPersist.map(normalizeItem)));
    },

    async upsertCachedItem(item: Item): Promise<void> {
        const current = await this.getCachedItems();
        const exists = current.some((entry) => entry.id === item.id);
        const next = exists
            ? current.map((entry) => (entry.id === item.id ? normalizeItem(item) : entry))
            : [...current, normalizeItem(item)];
        await this.setCachedItems(next);
    },

    async removeCachedItem(itemId: string): Promise<void> {
        const current = await this.getCachedItems();
        await this.setCachedItems(current.filter((entry) => entry.id !== itemId));
    },

    async getCachedBills<T extends { id: string; createdAt?: string | number | Date }>(): Promise<T[]> {
        const data = await readJson<T[]>(BILL_CACHE_KEY, []);
        return sortBills(data);
    },

    async setCachedBills<T extends { id: string; createdAt?: string | number | Date }>(entries: T[]): Promise<void> {
        await writeJson(BILL_CACHE_KEY, sortBills(entries));
    },

    async upsertCachedBill<T extends { id: string; createdAt?: string | number | Date }>(entry: T): Promise<void> {
        const current = await this.getCachedBills<T>();
        const exists = current.some((item) => item.id === entry.id);
        const next = exists
            ? current.map((item) => (item.id === entry.id ? entry : item))
            : [entry, ...current];
        await this.setCachedBills(next);
    },

    async applyLocalBillStock(itemsInBill: BillItem[], type: TransactionType = 'SALE'): Promise<void> {
        const currentItems = await this.getCachedItems();
        const grouped = new Map<string, number>();

        for (const line of itemsInBill) {
            grouped.set(line.id, (grouped.get(line.id) ?? 0) + line.quantity);
        }

        const nextItems = [...currentItems];

        for (const [itemId, qty] of grouped.entries()) {
            const index = nextItems.findIndex((entry) => entry.id === itemId);
            if (index < 0) {
                // If purchasing a new item that doesn't exist locally? 
                // We should probably skip or handle it. For now, throw or skip.
                // If it's a purchase, maybe we don't error if it's not found?
                // But typically we select items from list.
                // If it's a new item created offline, it should be in cache first.
                throw new Error(`Item ${itemId} no longer exists.`);
            }

            const stock = Number(nextItems[index].stock ?? 0);
            let nextStock = stock;

            if (type === 'SALE') {
                nextStock = stock - qty;
                if (nextStock < 0) {
                    // For forced offline sales, maybe we allow negative? 
                    // But UI blocks it.
                    throw new Error(`Insufficient stock for "${nextItems[index].name}".`);
                }
            } else {
                nextStock = stock + qty;
            }

            nextItems[index] = {
                ...nextItems[index],
                stock: nextStock,
                updatedAt: new Date().toISOString(),
            };
        }

        await this.setCachedItems(nextItems);
    },

    async getQueue(): Promise<OfflineMutation[]> {
        return await readJson<OfflineMutation[]>(OFFLINE_QUEUE_KEY, []);
    },

    async getQueueStats(): Promise<{ pendingCount: number; oldestCreatedAt: string | null }> {
        const queue = await this.getQueue();
        return {
            pendingCount: queue.length,
            oldestCreatedAt: queue.length > 0 ? queue[0].createdAt : null,
        };
    },

    async enqueueMutation(mutation: Omit<OfflineMutation, 'id' | 'createdAt'>): Promise<void> {
        const queue = await this.getQueue();
        const nextMutation = {
            ...mutation,
            id: generateLocalId('queue'),
            createdAt: new Date().toISOString(),
        } as OfflineMutation;

        queue.push(nextMutation);
        await writeJson(OFFLINE_QUEUE_KEY, queue);
    },

    async clearQueue(): Promise<void> {
        await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    },

    async clearCaches(): Promise<void> {
        await Promise.all([
            AsyncStorage.removeItem(ITEM_CACHE_KEY),
            AsyncStorage.removeItem(BILL_CACHE_KEY),
        ]);
    },

    async clearAllLocalData(): Promise<void> {
        await Promise.all([
            this.clearQueue(),
            this.clearCaches(),
        ]);
    },

    async flushQueue(): Promise<{ processed: number; remaining: number }> {
        if (!(await isOnline())) {
            const queued = await this.getQueue();
            return { processed: 0, remaining: queued.length };
        }

        const queue = await this.getQueue();
        if (queue.length === 0) {
            return { processed: 0, remaining: 0 };
        }

        const nextQueue: OfflineMutation[] = [];
        let processed = 0;

        for (let i = 0; i < queue.length; i += 1) {
            const mutation = queue[i];
            try {
                await applyMutation(mutation);
                processed += 1;
            } catch (error: unknown) {
                if (shouldDropMutation(error, mutation)) {
                    processed += 1;
                    continue;
                }

                nextQueue.push(mutation, ...queue.slice(i + 1));
                if (shouldStopFlush(error)) {
                    break;
                }
            }
        }

        await writeJson(OFFLINE_QUEUE_KEY, nextQueue);
        return {
            processed,
            remaining: nextQueue.length,
        };
    },
};
