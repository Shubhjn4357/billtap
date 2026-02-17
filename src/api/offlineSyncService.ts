import { apiClient, ApiError } from './httpClient';
import { isOnline } from '../utils/network';
import type { AnalyticsEventType, BillItem, Item, UserProfile, TransactionType } from '../types';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';

const OFFLINE_QUEUE_KEY = 'billtap_offline_queue_v1';
const ITEM_CACHE_KEY = 'billtap_item_cache_v1';
const BILL_CACHE_KEY = 'billtap_bill_cache_v1';

const MAX_MUTATIONS_PER_FLUSH = 24;
const AUTO_SYNC_INTERVAL_MS = 15000;
const RETRY_BASE_DELAY_MS = 4000;
const RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

interface QueueMutationBase {
    id: string;
    createdAt: string;
    attemptCount?: number;
    nextRetryAt?: number;
    lastAttemptAt?: string;
    lastError?: string;
}

interface OfflineItemPayload {
    id: string;
    name: string;
    nameLowercase: string;
    price: number;
    stock: number;
    purchasePrice?: number | null;
    mrp?: number | null;
    minimumStock?: number | null;
    unit?: string | null;
    hsn?: string | null;
    gstPercentage?: number | null;
    category?: string | null;
    subcategory?: string | null;
    location?: string | null;
    barcode?: string | null;
    imageUrl?: string | null;
    isActive?: boolean;
}

interface OfflineBillPayload {
    id: string;
    type?: TransactionType;
    billMode?: 'GST' | 'ESTIMATE';
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
    })
    | (QueueMutationBase & {
        type: 'send_message';
        payload: {
            channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
            recipient: string;
            message: string;
            barcode?: string;
            mediaUrl?: string;
        };
    });

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
type EnqueueMutation = DistributiveOmit<OfflineMutation, 'id' | 'createdAt'>;

let flushInFlight: Promise<{ processed: number; remaining: number }> | null = null;
let autoSyncIntervalHandle: ReturnType<typeof setInterval> | null = null;
let queuedFlushTimeout: ReturnType<typeof setTimeout> | null = null;

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
    const raw = await offlineKeyValueStore.getItem(key);
    if (!raw) return fallback;

    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

const writeJson = async <T>(key: string, value: T) => {
    await offlineKeyValueStore.setItem(key, JSON.stringify(value));
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
    if (error.status === 0) return true;
    return error.status === 401 || error.status === 403 || error.status === 429 || error.status >= 500;
};

const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'Unknown sync error';
};

const getRetryDelayMs = (attemptCount: number, error: unknown): number => {
    if (error instanceof ApiError && error.status === 429) {
        return Math.min(RETRY_MAX_DELAY_MS, 60_000 * Math.max(1, attemptCount));
    }

    const exponential = RETRY_BASE_DELAY_MS * Math.pow(2, Math.max(0, attemptCount - 1));
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(RETRY_MAX_DELAY_MS, exponential + jitter);
};

const normalizeMutation = (raw: OfflineMutation): OfflineMutation => {
    const attemptCount = Number.isFinite(raw.attemptCount) ? Math.max(0, Math.floor(raw.attemptCount ?? 0)) : 0;
    const nextRetryAt = Number.isFinite(raw.nextRetryAt) ? Math.max(0, Math.floor(raw.nextRetryAt ?? 0)) : 0;

    return {
        ...raw,
        id: raw.id || generateLocalId('queue'),
        createdAt: raw.createdAt || new Date().toISOString(),
        attemptCount,
        nextRetryAt,
        lastAttemptAt: typeof raw.lastAttemptAt === 'string' ? raw.lastAttemptAt : undefined,
        lastError: typeof raw.lastError === 'string' ? raw.lastError : undefined,
    };
};

const compactQueueForEnqueue = (
    queue: OfflineMutation[],
    mutation: EnqueueMutation
): OfflineMutation[] => {
    let nextQueue = [...queue];
    let nextMutation = mutation;

    if (mutation.type === 'upsert_item') {
        nextQueue = nextQueue.filter((entry) => {
            if (entry.type === 'upsert_item' && entry.payload.id === mutation.payload.id) return false;
            if (entry.type === 'delete_item' && entry.payload.id === mutation.payload.id) return false;
            return true;
        });
    }

    if (mutation.type === 'delete_item') {
        nextQueue = nextQueue.filter((entry) => {
            if (entry.type === 'upsert_item' && entry.payload.id === mutation.payload.id) return false;
            if (entry.type === 'delete_item' && entry.payload.id === mutation.payload.id) return false;
            return true;
        });
    }

    if (mutation.type === 'update_user_me') {
        const mergedPayload = nextQueue
            .filter((entry): entry is Extract<OfflineMutation, { type: 'update_user_me' }> => entry.type === 'update_user_me')
            .reduce<Partial<UserProfile>>((acc, entry) => ({ ...acc, ...entry.payload }), {});

        nextQueue = nextQueue.filter((entry) => entry.type !== 'update_user_me');
        nextMutation = {
            ...mutation,
            payload: {
                ...mergedPayload,
                ...mutation.payload,
            },
        };
    }

    nextQueue.push({
        ...nextMutation,
        id: generateLocalId('queue'),
        createdAt: new Date().toISOString(),
        attemptCount: 0,
        nextRetryAt: 0,
    } as OfflineMutation);

    return nextQueue;
};

const applyMutation = async (mutation: OfflineMutation): Promise<void> => {
    switch (mutation.type) {
        case 'upsert_item': {
            const payload = {
                name: mutation.payload.name,
                price: mutation.payload.price,
                purchasePrice: mutation.payload.purchasePrice ?? undefined,
                mrp: mutation.payload.mrp ?? undefined,
                stock: mutation.payload.stock,
                minimumStock: mutation.payload.minimumStock ?? undefined,
                unit: mutation.payload.unit ?? undefined,
                hsn: mutation.payload.hsn ?? undefined,
                gstPercentage: mutation.payload.gstPercentage ?? undefined,
                category: mutation.payload.category ?? undefined,
                subcategory: mutation.payload.subcategory ?? undefined,
                location: mutation.payload.location ?? undefined,
                barcode: mutation.payload.barcode ?? undefined,
                imageUrl: mutation.payload.imageUrl ?? undefined,
                isActive: mutation.payload.isActive ?? true,
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
            const billMode = mutation.payload.billMode ?? 'GST';
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
                billMode,
                affectsGst: billMode === 'GST',
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
        case 'send_message': {
            const response = await apiClient.post<{ ok: boolean; message?: string }>(
                '/communications/messages/send',
                mutation.payload
            );
            if (!response.ok) {
                throw new Error(response.message || 'Failed to send message.');
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

const scheduleFlushSoon = (delayMs = 280) => {
    if (queuedFlushTimeout) {
        clearTimeout(queuedFlushTimeout);
    }
    queuedFlushTimeout = setTimeout(() => {
        queuedFlushTimeout = null;
        void offlineSyncService.flushQueue();
    }, delayMs);
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
                throw new Error(`Item ${itemId} no longer exists.`);
            }

            const stock = Number(nextItems[index].stock ?? 0);
            let nextStock = stock;

            if (type === 'SALE') {
                nextStock = stock - qty;
                if (nextStock < 0) {
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
        const queue = await readJson<OfflineMutation[]>(OFFLINE_QUEUE_KEY, []);
        return queue.map((entry) => normalizeMutation(entry));
    },

    async getQueueStats(): Promise<{
        pendingCount: number;
        oldestCreatedAt: string | null;
        readyToSyncCount: number;
    }> {
        const queue = await this.getQueue();
        const now = Date.now();
        const readyToSyncCount = queue.filter((entry) => (entry.nextRetryAt ?? 0) <= now).length;
        return {
            pendingCount: queue.length,
            oldestCreatedAt: queue.length > 0 ? queue[0].createdAt : null,
            readyToSyncCount,
        };
    },

    async enqueueMutation(mutation: EnqueueMutation): Promise<void> {
        const queue = await this.getQueue();
        const nextQueue = compactQueueForEnqueue(queue, mutation);
        await writeJson(OFFLINE_QUEUE_KEY, nextQueue);
        scheduleFlushSoon();
    },

    async enqueueMessage(payload: {
        channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
        recipient: string;
        message: string;
        barcode?: string;
        mediaUrl?: string;
    }): Promise<void> {
        await this.enqueueMutation({
            type: 'send_message',
            payload,
        });
    },

    async clearQueue(): Promise<void> {
        if (queuedFlushTimeout) {
            clearTimeout(queuedFlushTimeout);
            queuedFlushTimeout = null;
        }
        await offlineKeyValueStore.removeItem(OFFLINE_QUEUE_KEY);
    },

    async clearCaches(): Promise<void> {
        await offlineKeyValueStore.multiRemove([ITEM_CACHE_KEY, BILL_CACHE_KEY]);
    },

    async clearAllLocalData(): Promise<void> {
        await Promise.all([
            this.clearQueue(),
            this.clearCaches(),
        ]);
    },

    getStorageBackend(): 'sqlite-drizzle' | 'async-storage' {
        return offlineKeyValueStore.getBackendName();
    },

    startAutoSync(): void {
        if (autoSyncIntervalHandle) return;
        autoSyncIntervalHandle = setInterval(() => {
            void this.flushQueue();
        }, AUTO_SYNC_INTERVAL_MS);
    },

    stopAutoSync(): void {
        if (autoSyncIntervalHandle) {
            clearInterval(autoSyncIntervalHandle);
            autoSyncIntervalHandle = null;
        }
        if (queuedFlushTimeout) {
            clearTimeout(queuedFlushTimeout);
            queuedFlushTimeout = null;
        }
    },

    onNetworkStateChange(isNowOnline: boolean): void {
        if (!isNowOnline) return;
        scheduleFlushSoon();
    },

    async flushQueue(): Promise<{ processed: number; remaining: number }> {
        if (flushInFlight) {
            return await flushInFlight;
        }

        flushInFlight = (async () => {
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
            let attempted = 0;
            const now = Date.now();

            for (let i = 0; i < queue.length; i += 1) {
                const mutation = queue[i];

                if (attempted >= MAX_MUTATIONS_PER_FLUSH) {
                    nextQueue.push(mutation, ...queue.slice(i + 1));
                    break;
                }

                if ((mutation.nextRetryAt ?? 0) > now) {
                    nextQueue.push(mutation);
                    continue;
                }

                attempted += 1;

                try {
                    await applyMutation(mutation);
                    processed += 1;
                } catch (error: unknown) {
                    if (shouldDropMutation(error, mutation)) {
                        processed += 1;
                        continue;
                    }

                    const attemptCount = (mutation.attemptCount ?? 0) + 1;
                    const nextRetryAt = Date.now() + getRetryDelayMs(attemptCount, error);

                    nextQueue.push({
                        ...mutation,
                        attemptCount,
                        nextRetryAt,
                        lastAttemptAt: new Date().toISOString(),
                        lastError: toErrorMessage(error),
                    });

                    if (shouldStopFlush(error)) {
                        nextQueue.push(...queue.slice(i + 1));
                        break;
                    }
                }
            }

            await writeJson(OFFLINE_QUEUE_KEY, nextQueue);
            return {
                processed,
                remaining: nextQueue.length,
            };
        })();

        try {
            return await flushInFlight;
        } finally {
            flushInFlight = null;
        }
    },
};
