import { apiClient, ApiError } from './httpClient';
import { isOnline } from '../utils/network';
import type { AnalyticsEventType, BillItem, Item, Party, UserProfile, TransactionType } from '../types';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';
import {
    ORG_FEE_REMINDERS_CACHE_KEY,
    ORG_CONTEXT_CACHE_KEY,
    getOrgCachedValue,
    ORG_LIST_CACHE_KEY,
    ORG_MEMBERS_CACHE_KEY,
    getSignatureMapKey,
    ORG_SETTINGS_CACHE_KEY,
    ORG_SIGNATURES_CACHE_KEY,
    ORG_STUDENTS_CACHE_KEY,
    ORG_TEMPLATES_CACHE_KEY,
    readSignatureIdMap,
    setOrgCachedValue,
    writeSignatureIdMap,
} from './businessSuiteCache';

const OFFLINE_QUEUE_KEY = 'billtap_offline_queue_v1';
const ITEM_CACHE_KEY = 'billtap_item_cache_v1';
const BILL_CACHE_KEY = 'billtap_bill_cache_v1';
const PARTY_CACHE_KEY = 'billtap_party_cache_v1';

const MAX_MUTATIONS_PER_FLUSH = 24;
const AUTO_SYNC_INTERVAL_MS = 30000;
const RETRY_BASE_DELAY_MS = 4000;
const RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

const withOrgQuery = (path: string, organizationId?: string): string => {
    if (!organizationId) return path;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}organizationId=${encodeURIComponent(organizationId)}`;
};

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
    discountAmount?: number;
    taxAmount?: number;
    paidAmount?: number;
    paymentMode?: 'CASH' | 'CREDIT';
    paymentStatus?: 'PAID' | 'PARTIAL' | 'PENDING';
    dueDate?: string | null;
    reminderEnabled?: boolean;
    reminderFrequencyDays?: number;
    nextReminderAt?: string | null;
    remark?: string;
    createdAt: string;
}

interface OfflinePartyPayload {
    id: string;
    userId?: string;
    name: string;
    type: 'customer' | 'supplier';
    phone?: string;
    email?: string;
    address?: string;
    gstNumber?: string;
    isActive?: boolean;
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
        type: 'upsert_party';
        payload: OfflinePartyPayload;
    })
    | (QueueMutationBase & {
        type: 'archive_party';
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
    })
    | (QueueMutationBase & {
        type: 'update_organization_settings';
        payload: {
            organizationId?: string;
            settings: Record<string, unknown>;
        };
    })
    | (QueueMutationBase & {
        type: 'create_signature';
        payload: {
            organizationId?: string;
            localId: string;
            name?: string;
            signatureData?: string;
            signatureUrl?: string;
            isDefault?: boolean;
        };
    })
    | (QueueMutationBase & {
        type: 'set_default_signature';
        payload: {
            organizationId?: string;
            signatureId: string;
        };
    })
    | (QueueMutationBase & {
        type: 'update_transaction_payment';
        payload: {
            transactionId: string;
            paidAmount?: number;
            markAsPaid?: boolean;
            dueDate?: string | null;
            reminderEnabled?: boolean;
            reminderFrequencyDays?: number;
            nextReminderAt?: string | null;
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

const normalizeParty = (party: Party): Party => ({
    ...party,
    isActive: party.isActive !== false,
    updatedAt: party.updatedAt ?? new Date().toISOString(),
});

const sortParties = (partiesToSort: Party[]) => {
    return [...partiesToSort].sort((a, b) => {
        const nameA = a.name?.toLowerCase?.() ?? '';
        const nameB = b.name?.toLowerCase?.() ?? '';
        return nameA.localeCompare(nameB);
    });
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
    if (mutation.type === 'archive_party' && error.status === 404) return true;
    if (mutation.type === 'analytics_event' && error.status === 400) return true;
    if (mutation.type === 'set_default_signature' && error.status === 404) return true;
    if (mutation.type === 'update_transaction_payment' && error.status === 404) return true;
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

    if (mutation.type === 'upsert_party') {
        nextQueue = nextQueue.filter((entry) => {
            if (entry.type === 'upsert_party' && entry.payload.id === mutation.payload.id) return false;
            if (entry.type === 'archive_party' && entry.payload.id === mutation.payload.id) return false;
            return true;
        });
    }

    if (mutation.type === 'archive_party') {
        nextQueue = nextQueue.filter((entry) => {
            if (entry.type === 'upsert_party' && entry.payload.id === mutation.payload.id) return false;
            if (entry.type === 'archive_party' && entry.payload.id === mutation.payload.id) return false;
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

    if (mutation.type === 'update_organization_settings') {
        const organizationId = mutation.payload.organizationId ?? '';
        const mergedSettings = nextQueue
            .filter((entry): entry is Extract<OfflineMutation, { type: 'update_organization_settings' }> => (
                entry.type === 'update_organization_settings' &&
                (entry.payload.organizationId ?? '') === organizationId
            ))
            .reduce<Record<string, unknown>>((acc, entry) => ({
                ...acc,
                ...entry.payload.settings,
            }), {});

        nextQueue = nextQueue.filter((entry) => !(
            entry.type === 'update_organization_settings' &&
            (entry.payload.organizationId ?? '') === organizationId
        ));
        nextMutation = {
            ...mutation,
            payload: {
                organizationId: mutation.payload.organizationId,
                settings: {
                    ...mergedSettings,
                    ...mutation.payload.settings,
                },
            },
        };
    }

    if (mutation.type === 'set_default_signature') {
        const organizationId = mutation.payload.organizationId ?? '';
        nextQueue = nextQueue.filter((entry) => !(
            entry.type === 'set_default_signature' &&
            (entry.payload.organizationId ?? '') === organizationId
        ));
    }

    if (mutation.type === 'create_signature') {
        nextQueue = nextQueue.filter((entry) => !(
            entry.type === 'create_signature' &&
            entry.payload.localId === mutation.payload.localId
        ));
    }

    if (mutation.type === 'update_transaction_payment') {
        nextQueue = nextQueue.filter((entry) => !(
            entry.type === 'update_transaction_payment' &&
            entry.payload.transactionId === mutation.payload.transactionId
        ));
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

const resolveSyncedSignatureId = async (organizationId: string | undefined, signatureId: string): Promise<string> => {
    const map = await readSignatureIdMap();
    return map[getSignatureMapKey(organizationId, signatureId)] ?? signatureId;
};

const cacheCreatedSignature = async (
    organizationId: string | undefined,
    localId: string,
    serverId: string,
    payload: {
        name?: string;
        signatureData?: string;
        signatureUrl?: string;
        isDefault?: boolean;
    }
) => {
    const cached = await getOrgCachedValue<{
        id: string;
        name?: string | null;
        signatureData?: string | null;
        signatureUrl?: string | null;
        isDefault?: boolean;
    }[]>(ORG_SIGNATURES_CACHE_KEY, organizationId) ?? [];

    const entry = {
        id: serverId,
        name: payload.name ?? null,
        signatureData: payload.signatureData ?? null,
        signatureUrl: payload.signatureUrl ?? null,
        isDefault: payload.isDefault ?? false,
    };

    const next = [...cached.filter((item) => item.id !== localId && item.id !== serverId), entry].map((item) => ({
        ...item,
        isDefault: entry.isDefault ? item.id === serverId : item.isDefault,
    }));

    await setOrgCachedValue(ORG_SIGNATURES_CACHE_KEY, organizationId, next);
    const map = await readSignatureIdMap();
    map[getSignatureMapKey(organizationId, localId)] = serverId;
    await writeSignatureIdMap(map);
};

const cacheDefaultSignature = async (organizationId: string | undefined, signatureId: string) => {
    const actualId = await resolveSyncedSignatureId(organizationId, signatureId);
    const cached = await getOrgCachedValue<{ id: string; isDefault?: boolean }[]>(
        ORG_SIGNATURES_CACHE_KEY,
        organizationId
    );
    if (!cached || cached.length === 0) return;
    await setOrgCachedValue(
        ORG_SIGNATURES_CACHE_KEY,
        organizationId,
        cached.map((entry) => ({ ...entry, isDefault: entry.id === actualId }))
    );
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
        case 'upsert_party': {
            const payload = {
                name: mutation.payload.name,
                type: mutation.payload.type,
                phone: mutation.payload.phone ?? undefined,
                email: mutation.payload.email ?? undefined,
                address: mutation.payload.address ?? undefined,
                gstNumber: mutation.payload.gstNumber ?? undefined,
                isActive: mutation.payload.isActive ?? true,
            };

            try {
                const patchResponse = await apiClient.patch<{ ok: boolean; message?: string }>(
                    `/parties/${encodeURIComponent(mutation.payload.id)}`,
                    payload
                );
                if (!patchResponse.ok) {
                    throw new Error(patchResponse.message || 'Failed to update party.');
                }
            } catch (error: unknown) {
                if (!(error instanceof ApiError) || error.status !== 404) {
                    throw error;
                }

                const createResponse = await apiClient.post<{ ok: boolean; id?: string; message?: string }>(
                    '/parties',
                    {
                        id: mutation.payload.id,
                        ...payload,
                    }
                );
                if (!createResponse.ok) {
                    throw new Error(createResponse.message || 'Failed to create party.');
                }
            }
            return;
        }
        case 'archive_party': {
            try {
                const response = await apiClient.patch<{ ok: boolean; message?: string }>(
                    `/parties/${encodeURIComponent(mutation.payload.id)}`,
                    { isActive: false }
                );
                if (!response.ok) {
                    throw new Error(response.message || 'Failed to archive party.');
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
            const computedTaxAmount = Number(mutation.payload.taxAmount ?? taxAmount);
            const discountAmount = Number(mutation.payload.discountAmount ?? 0);
            const paidAmount = Number(mutation.payload.paidAmount ?? 0);
            const dueAmount = Math.max(0, Number(mutation.payload.total ?? 0) - paidAmount);
            const paymentStatus = mutation.payload.paymentStatus
                ?? (dueAmount <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'));

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
                discountAmount,
                taxAmount: computedTaxAmount,
                paidAmount,
                paymentMode: mutation.payload.paymentMode ?? (paidAmount > 0 ? 'CREDIT' : 'CASH'),
                paymentStatus,
                dueDate: mutation.payload.dueDate ?? undefined,
                reminderEnabled: mutation.payload.reminderEnabled ?? false,
                reminderFrequencyDays: mutation.payload.reminderFrequencyDays,
                nextReminderAt: mutation.payload.nextReminderAt ?? undefined,
                billMode,
                affectsGst: billMode === 'GST',
                remark: mutation.payload.remark,
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
        case 'update_organization_settings': {
            const response = await apiClient.put<{ ok: boolean; settings?: Record<string, unknown>; message?: string }>(
                withOrgQuery('/organizations/settings/current', mutation.payload.organizationId),
                { settings: mutation.payload.settings }
            );
            if (!response.ok) {
                throw new Error(response.message || 'Failed to update organization settings.');
            }
            await setOrgCachedValue(
                ORG_SETTINGS_CACHE_KEY,
                mutation.payload.organizationId,
                response.settings ?? mutation.payload.settings
            );
            return;
        }
        case 'create_signature': {
            const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>(
                withOrgQuery('/organizations/signatures/current', mutation.payload.organizationId),
                {
                    name: mutation.payload.name,
                    signatureData: mutation.payload.signatureData,
                    signatureUrl: mutation.payload.signatureUrl,
                    isDefault: mutation.payload.isDefault,
                }
            );
            if (!response.ok || !response.id) {
                throw new Error(response.message || 'Failed to save signature.');
            }
            await cacheCreatedSignature(
                mutation.payload.organizationId,
                mutation.payload.localId,
                response.id,
                mutation.payload
            );
            return;
        }
        case 'set_default_signature': {
            const actualId = await resolveSyncedSignatureId(mutation.payload.organizationId, mutation.payload.signatureId);
            const response = await apiClient.post<{ ok: boolean; message?: string }>(
                withOrgQuery(`/organizations/signatures/current/${encodeURIComponent(actualId)}/default`, mutation.payload.organizationId)
            );
            if (!response.ok) {
                throw new Error(response.message || 'Failed to set default signature.');
            }
            await cacheDefaultSignature(mutation.payload.organizationId, actualId);
            return;
        }
        case 'update_transaction_payment': {
            const response = await apiClient.patch<{
                ok: boolean;
                paymentStatus?: 'PAID' | 'PARTIAL' | 'PENDING';
                paidAmount?: number;
                dueAmount?: number;
                message?: string;
            }>(
                `/transactions/${encodeURIComponent(mutation.payload.transactionId)}/payment`,
                {
                    paidAmount: mutation.payload.paidAmount,
                    markAsPaid: mutation.payload.markAsPaid,
                    dueDate: mutation.payload.dueDate,
                    reminderEnabled: mutation.payload.reminderEnabled,
                    reminderFrequencyDays: mutation.payload.reminderFrequencyDays,
                    nextReminderAt: mutation.payload.nextReminderAt,
                }
            );
            if (!response.ok) {
                throw new Error(response.message || 'Failed to update payment.');
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

    async getCachedParties(): Promise<Party[]> {
        const data = await readJson<Party[]>(PARTY_CACHE_KEY, []);
        return sortParties(data.map(normalizeParty));
    },

    async setCachedParties(partiesToPersist: Party[]): Promise<void> {
        await writeJson(PARTY_CACHE_KEY, sortParties(partiesToPersist.map(normalizeParty)));
    },

    async upsertCachedParty(party: Party): Promise<void> {
        const current = await this.getCachedParties();
        const exists = current.some((entry) => entry.id === party.id);
        const normalized = normalizeParty(party);
        const next = exists
            ? current.map((entry) => (entry.id === normalized.id ? normalized : entry))
            : [...current, normalized];
        await this.setCachedParties(next);
    },

    async archiveCachedParty(partyId: string): Promise<void> {
        const current = await this.getCachedParties();
        const next = current.map((entry) => (
            entry.id === partyId
                ? {
                    ...entry,
                    isActive: false,
                    updatedAt: new Date().toISOString(),
                }
                : entry
        ));
        await this.setCachedParties(next);
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

    async updateCachedBillPayment(
        billId: string,
        payload: {
            paidAmount?: number;
            markAsPaid?: boolean;
            dueDate?: string | Date | null;
            reminderEnabled?: boolean;
            reminderFrequencyDays?: number;
            nextReminderAt?: string | Date | null;
        }
    ): Promise<{ paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING'; paidAmount: number; dueAmount: number } | null> {
        const entries = await this.getCachedBills<Record<string, unknown> & { id: string; createdAt?: string | number | Date }>();
        const target = entries.find((entry) => entry.id === billId);
        if (!target) return null;

        const total = Number((target.total as number | undefined) ?? (target.totalAmount as number | undefined) ?? 0);
        const existingPaid = Number((target.paidAmount as number | undefined) ?? 0);
        let nextPaid = existingPaid;

        if (typeof payload.paidAmount === 'number' && Number.isFinite(payload.paidAmount)) {
            nextPaid = Math.max(0, payload.paidAmount);
        }
        if (payload.markAsPaid) {
            nextPaid = total;
        }

        const dueAmount = Math.max(0, total - nextPaid);
        const paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = dueAmount === 0 ? 'PAID' : (nextPaid > 0 ? 'PARTIAL' : 'PENDING');
        const dueDate = payload.dueDate == null
            ? target.dueDate
            : (payload.dueDate instanceof Date ? payload.dueDate.toISOString() : payload.dueDate);
        const nextReminderAt = payload.nextReminderAt == null
            ? target.nextReminderAt
            : (payload.nextReminderAt instanceof Date ? payload.nextReminderAt.toISOString() : payload.nextReminderAt);

        const updated = entries.map((entry) => {
            if (entry.id !== billId) return entry;
            return {
                ...entry,
                paidAmount: nextPaid,
                dueAmount,
                paymentStatus,
                dueDate,
                reminderEnabled: payload.reminderEnabled ?? entry.reminderEnabled,
                reminderFrequencyDays: payload.reminderFrequencyDays ?? entry.reminderFrequencyDays,
                nextReminderAt,
                updatedAt: new Date().toISOString(),
            };
        });

        await this.setCachedBills(updated);
        return {
            paymentStatus,
            paidAmount: nextPaid,
            dueAmount,
        };
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
        await offlineKeyValueStore.multiRemove([
            ITEM_CACHE_KEY,
            BILL_CACHE_KEY,
            PARTY_CACHE_KEY,
            ORG_LIST_CACHE_KEY,
            ORG_CONTEXT_CACHE_KEY,
            ORG_MEMBERS_CACHE_KEY,
            ORG_SETTINGS_CACHE_KEY,
            ORG_TEMPLATES_CACHE_KEY,
            ORG_SIGNATURES_CACHE_KEY,
            ORG_STUDENTS_CACHE_KEY,
            ORG_FEE_REMINDERS_CACHE_KEY,
        ]);
        await writeSignatureIdMap({});
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
