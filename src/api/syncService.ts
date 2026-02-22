import { apiClient, ApiError } from './httpClient';
import { isOnline } from '../utils/network';
import type { BillItem, Item, Party, TransactionType } from '../types';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';

const OFFLINE_QUEUE_KEY = 'billtap_offline_queue_v1';
const ITEM_CACHE_KEY = 'billtap_item_cache_v1';
const BILL_CACHE_KEY = 'billtap_bill_cache_v1';
const PARTY_CACHE_KEY = 'billtap_party_cache_v1';
const ACCOUNT_CACHE_KEY = 'billtap_account_cache_v1';

const MAX_MUTATIONS_PER_FLUSH = 24;
const AUTO_SYNC_INTERVAL_MS = 30000;
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
    | (QueueMutationBase & { type: 'upsert_item'; payload: OfflineItemPayload })
    | (QueueMutationBase & { type: 'delete_item'; payload: { id: string } })
    | (QueueMutationBase & { type: 'upsert_party'; payload: OfflinePartyPayload })
    | (QueueMutationBase & { type: 'archive_party'; payload: { id: string } })
    | (QueueMutationBase & { type: 'create_bill'; payload: OfflineBillPayload })
    | (QueueMutationBase & { type: 'update_bill_payment'; payload: { transactionId: string; paidAmount?: number; markAsPaid?: boolean; dueDate?: string | null; reminderEnabled?: boolean; reminderFrequencyDays?: number; nextReminderAt?: string | null } })
    | (QueueMutationBase & { type: 'upsert_account'; payload: { id: string; code: string; name: string; type: string; isActive?: boolean } })
    | (QueueMutationBase & { type: 'send_message'; payload: { channel: 'WHATSAPP' | 'SMS' | 'EMAIL'; recipient: string; message: string; barcode?: string; mediaUrl?: string } })
    | (QueueMutationBase & { type: 'update_user_me'; payload: any })
    | (QueueMutationBase & { type: 'update_transaction_payment'; payload: any })
    | (QueueMutationBase & { type: 'update_organization_settings'; payload: any })
    | (QueueMutationBase & { type: 'create_signature'; payload: any })
    | (QueueMutationBase & { type: 'set_default_signature'; payload: any })
    | (QueueMutationBase & { type: 'analytics_event'; payload: any });

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
type EnqueueMutation = DistributiveOmit<OfflineMutation, keyof QueueMutationBase>;

interface ApiResponse {
    ok?: boolean;
    id?: string;
    message?: string;
}

let flushInFlight: Promise<{ processed: number; remaining: number }> | null = null;
let autoSyncIntervalHandle: any = null;
let queuedFlushTimeout: any = null;

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
    try {
        const val = await offlineKeyValueStore.getItem(key);
        return val ? JSON.parse(val) as T : fallback;
    } catch { return fallback; }
};

const writeJson = async <T>(key: string, value: T): Promise<void> => {
    await offlineKeyValueStore.setItem(key, JSON.stringify(value));
};

const normalizeItem = (item: Item): Item => ({
    ...item,
    price: Number(item.price || 0),
    stock: Number(item.stock || 0),
    purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : undefined,
    mrp: item.mrp ? Number(item.mrp) : undefined,
});

const sortItems = (items: Item[]): Item[] => [...items].sort((a, b) => b.updatedAt.toString().localeCompare(a.updatedAt.toString()));

const normalizeParty = (party: Party): Party => ({ ...party, isActive: party.isActive ?? true });

const sortParties = (parties: Party[]): Party[] => [...parties].sort((a, b) => (b.updatedAt || '').toString().localeCompare((a.updatedAt || '').toString()));

const sortBills = <T extends { createdAt?: any }>(entries: T[]): T[] =>
    [...entries].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

const shouldDropMutation = (error: unknown, _m: OfflineMutation): boolean => {
    if (error instanceof ApiError && error.status === 404) return true;
    return false;
};

const shouldStopFlush = (error: unknown): boolean => {
    if (error instanceof ApiError && error.status === 401) return true;
    return false;
};

const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const getRetryDelayMs = (attemptCount: number, _e: unknown): number => {
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, Math.min(attemptCount - 1, 5));
    return Math.min(delay, RETRY_MAX_DELAY_MS);
};

const normalizeMutation = (raw: OfflineMutation): OfflineMutation => ({ ...raw, attemptCount: raw.attemptCount || 0 });

const generateLocalId = (prefix: string) => `local_${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const compactQueueForEnqueue = (queue: OfflineMutation[], mutation: EnqueueMutation): OfflineMutation[] => {
    const id = generateLocalId('mut');
    const full: OfflineMutation = { ...mutation, id, createdAt: new Date().toISOString(), attemptCount: 0 } as OfflineMutation;
    if (mutation.type === 'upsert_item' || mutation.type === 'upsert_party') {
        const filtered = queue.filter(q => !(q.type === mutation.type && q.payload.id === mutation.payload.id));
        return [...filtered, full];
    }
    return [...queue, full];
};

const applyMutation = async (mutation: OfflineMutation): Promise<void> => {
    switch (mutation.type) {
        case 'upsert_item': {
            const res = await apiClient.post<ApiResponse>('/items', mutation.payload);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to sync item.');
            return;
        }
        case 'delete_item': {
            const res = await apiClient.delete<ApiResponse>(`/items/${encodeURIComponent(mutation.payload.id)}`);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to delete item.');
            return;
        }
        case 'upsert_party': {
            const res = await apiClient.post<ApiResponse>('/parties', mutation.payload);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to sync party.');
            return;
        }
        case 'archive_party': {
            const res = await apiClient.patch<ApiResponse>(`/parties/${encodeURIComponent(mutation.payload.id)}`, { isActive: false });
            if (res && res.ok === false) throw new Error(res.message || 'Failed to archive party.');
            return;
        }
        case 'create_bill': {
            const res = await apiClient.post<ApiResponse>('/transactions', mutation.payload);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to sync bill.');
            return;
        }
        case 'update_bill_payment': {
            const p = mutation.payload;
            const res = await apiClient.patch<ApiResponse>(
                `/transactions/${encodeURIComponent(p.transactionId)}/payment`,
                {
                    paidAmount: p.paidAmount,
                    markAsPaid: p.markAsPaid,
                    dueDate: p.dueDate,
                    reminderEnabled: p.reminderEnabled,
                    reminderFrequencyDays: p.reminderFrequencyDays,
                    nextReminderAt: p.nextReminderAt,
                }
            );
            if (res && res.ok === false) throw new Error(res.message || 'Failed to update payment.');
            return;
        }
        case 'upsert_account': {
            const res = await apiClient.post<ApiResponse>('/accounting/accounts', mutation.payload);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to sync account.');
            return;
        }
        case 'send_message': {
            const res = await apiClient.post<ApiResponse>('/communications/messages/send', mutation.payload);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to send message.');
            return;
        }
        case 'update_user_me': {
            const res = await apiClient.patch<ApiResponse>('/users/me', mutation.payload);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to update user.');
            return;
        }
        case 'update_transaction_payment': {
            const res = await apiClient.patch<ApiResponse>(`/transactions/${encodeURIComponent(mutation.payload.transactionId)}/payment`, mutation.payload);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to update transaction payment.');
            return;
        }
        case 'update_organization_settings': {
            const path = `/organizations/settings/current?organizationId=${encodeURIComponent(mutation.payload.organizationId)}`;
            const res = await apiClient.put<ApiResponse>(path, { settings: mutation.payload.settings });
            if (res && res.ok === false) throw new Error(res.message || 'Failed to update org settings.');
            return;
        }
        case 'create_signature': {
            const path = `/organizations/signatures/current?organizationId=${encodeURIComponent(mutation.payload.organizationId)}`;
            const res = await apiClient.post<ApiResponse>(path, mutation.payload);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to create signature.');
            return;
        }
        case 'set_default_signature': {
            const path = `/organizations/signatures/current/${encodeURIComponent(mutation.payload.signatureId)}/default?organizationId=${encodeURIComponent(mutation.payload.organizationId)}`;
            const res = await apiClient.post<ApiResponse>(path);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to set default signature.');
            return;
        }
        case 'analytics_event': {
            const res = await apiClient.post<ApiResponse>('/analytics/events', mutation.payload);
            if (res && res.ok === false) throw new Error(res.message || 'Failed to send analytics.');
            return;
        }
        default: return;
    }
};

const scheduleFlushSoon = (delayMs = 280) => {
    if (queuedFlushTimeout) clearTimeout(queuedFlushTimeout);
    queuedFlushTimeout = setTimeout(() => {
        queuedFlushTimeout = null;
        void offlineSyncService.flushQueue();
    }, delayMs);
};

class OfflineSyncService {
    createLocalId(prefix: string) { return generateLocalId(prefix); }

    async getCachedItems(): Promise<Item[]> {
        const data = await readJson<Item[]>(ITEM_CACHE_KEY, []);
        return sortItems(data.map(normalizeItem));
    }

    async setCachedItems(items: Item[]): Promise<void> {
        await writeJson(ITEM_CACHE_KEY, sortItems(items.map(normalizeItem)));
    }

    async upsertCachedItem(item: Item): Promise<void> {
        const current = await this.getCachedItems();
        const exists = current.some(e => e.id === item.id);
        const next = exists ? current.map(e => (e.id === item.id ? normalizeItem(item) : e)) : [...current, normalizeItem(item)];
        await this.setCachedItems(next);
    }

    async removeCachedItem(id: string): Promise<void> {
        const current = await this.getCachedItems();
        await this.setCachedItems(current.filter(e => e.id !== id));
    }

    async getCachedParties(): Promise<Party[]> {
        const data = await readJson<Party[]>(PARTY_CACHE_KEY, []);
        return sortParties(data.map(normalizeParty));
    }

    async setCachedParties(parties: Party[]): Promise<void> {
        await writeJson(PARTY_CACHE_KEY, sortParties(parties.map(normalizeParty)));
    }

    async upsertCachedParty(party: Party): Promise<void> {
        const current = await this.getCachedParties();
        const norm = normalizeParty(party);
        const exists = current.some(e => e.id === norm.id);
        const next = exists ? current.map(e => (e.id === norm.id ? norm : e)) : [...current, norm];
        await this.setCachedParties(next);
    }

    async archiveCachedParty(id: string): Promise<void> {
        const current = await this.getCachedParties();
        const next = current.map(e => (e.id === id ? { ...e, isActive: false, updatedAt: new Date().toISOString() } : e));
        await this.setCachedParties(next);
    }

    async removeCachedParty(id: string): Promise<void> {
        const current = await this.getCachedParties();
        await this.setCachedParties(current.filter(e => e.id !== id));
    }

    async getCachedBills<T extends { id: string; createdAt?: any }>(): Promise<T[]> {
        const data = await readJson<T[]>(BILL_CACHE_KEY, []);
        return sortBills(data);
    }

    async setCachedBills<T extends { id: string; createdAt?: any }>(entries: T[]): Promise<void> {
        await writeJson(BILL_CACHE_KEY, sortBills(entries));
    }

    async upsertCachedBill<T extends { id: string; createdAt?: any }>(entry: T): Promise<void> {
        const current = await this.getCachedBills<T>();
        const exists = current.some(e => e.id === entry.id);
        const next = exists ? current.map(e => (e.id === entry.id ? entry : e)) : [entry, ...current];
        await this.setCachedBills(next);
    }

    async removeCachedBill(id: string): Promise<void> {
        const current = await this.getCachedBills();
        await this.setCachedBills(current.filter(e => e.id !== id));
    }

    async updateCachedBillPayment(billId: string, payload: any): Promise<{ paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING'; paidAmount: number; dueAmount: number } | null> {
        const entries = await this.getCachedBills<any>();
        const target = entries.find((e: any) => e.id === billId);
        if (!target) return null;
        const total = Number(target.total || target.totalAmount || 0);
        const nextPaid = payload.markAsPaid ? total : Math.max(0, payload.paidAmount ?? target.paidAmount ?? 0);
        const due = Math.max(0, total - nextPaid);
        const status = due === 0 ? 'PAID' : (nextPaid > 0 ? 'PARTIAL' : 'PENDING');
        const updated = entries.map((e: any) => e.id === billId ? { ...e, paidAmount: nextPaid, dueAmount: due, paymentStatus: status, updatedAt: new Date().toISOString() } : e);
        await this.setCachedBills(updated);
        return { paymentStatus: status, paidAmount: nextPaid, dueAmount: due };
    }

    async applyLocalBillStock(items: BillItem[], type: TransactionType = 'SALE'): Promise<void> {
        const current = await this.getCachedItems();
        const next = [...current];
        for (const line of items) {
            const idx = next.findIndex(e => e.id === line.id);
            if (idx >= 0) {
                const stock = Number(next[idx].stock || 0);
                next[idx] = { ...next[idx], stock: type === 'SALE' ? stock - line.quantity : stock + line.quantity, updatedAt: new Date().toISOString() };
            }
        }
        await this.setCachedItems(next);
    }

    async getQueue(): Promise<OfflineMutation[]> {
        const queue = await readJson<OfflineMutation[]>(OFFLINE_QUEUE_KEY, []);
        return queue.map(normalizeMutation);
    }

    async enqueueMutation(mutation: EnqueueMutation): Promise<void> {
        const queue = await this.getQueue();
        await writeJson(OFFLINE_QUEUE_KEY, compactQueueForEnqueue(queue, mutation));
        scheduleFlushSoon();
    }

    async flushQueue(): Promise<{ processed: number; remaining: number }> {
        if (flushInFlight) return flushInFlight;
        flushInFlight = (async () => {
            if (!(await isOnline())) return { processed: 0, remaining: (await this.getQueue()).length };
            const q = await this.getQueue();
            if (q.length === 0) return { processed: 0, remaining: 0 };
            const next: OfflineMutation[] = [];
            let proc = 0, att = 0;
            const now = Date.now();
            for (let i = 0; i < q.length; i++) {
                if (att >= MAX_MUTATIONS_PER_FLUSH) { next.push(...q.slice(i)); break; }
                const m = q[i];
                if ((m.nextRetryAt || 0) > now) { next.push(m); continue; }
                att++;
                try {
                    await applyMutation(m);
                    proc++;
                } catch (e) {
                    if (shouldDropMutation(e, m)) { proc++; continue; }
                    const count = (m.attemptCount || 0) + 1;
                    next.push({ ...m, attemptCount: count, nextRetryAt: Date.now() + getRetryDelayMs(count, e), lastError: toErrorMessage(e) });
                    if (shouldStopFlush(e)) { next.push(...q.slice(i + 1)); break; }
                }
            }
            await writeJson(OFFLINE_QUEUE_KEY, next);
            return { processed: proc, remaining: next.length };
        })();
        try { return await flushInFlight; } finally { flushInFlight = null; }
    }

    async getCachedAccounts(): Promise<any[]> { return readJson<any[]>(ACCOUNT_CACHE_KEY, []); }
    async setCachedAccounts(accounts: any[]): Promise<void> { await writeJson(ACCOUNT_CACHE_KEY, accounts); }
    async upsertCachedAccount(acc: any): Promise<void> {
        const current = await this.getCachedAccounts();
        const exists = current.some(e => e.id === acc.id);
        const next = exists ? current.map(e => (e.id === acc.id ? acc : e)) : [...current, acc];
        await this.setCachedAccounts(next);
    }

    async clearAllLocalData(): Promise<void> {
        const keys = [
            OFFLINE_QUEUE_KEY,
            ITEM_CACHE_KEY,
            BILL_CACHE_KEY,
            PARTY_CACHE_KEY,
            ACCOUNT_CACHE_KEY,
        ];
        for (const key of keys) {
            await offlineKeyValueStore.removeItem(key);
        }
    }

    getStorageBackend() { return offlineKeyValueStore.getBackendName(); }
    startAutoSync() { if (!autoSyncIntervalHandle) autoSyncIntervalHandle = setInterval(() => void this.flushQueue(), AUTO_SYNC_INTERVAL_MS); }
    stopAutoSync() { if (autoSyncIntervalHandle) { clearInterval(autoSyncIntervalHandle); autoSyncIntervalHandle = null; } }
    onNetworkStateChange(online: boolean) { if (online) scheduleFlushSoon(); }
}

export const offlineSyncService = new OfflineSyncService();
