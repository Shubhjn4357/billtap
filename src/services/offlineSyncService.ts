import type { AxiosError } from 'axios';
import { api } from '../api/client';
import type { Account, Expense, Godown, Invoice, Item, Loan, Party } from '../types/domain';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';
import { isOnline } from '../utils/network';

const OFFLINE_QUEUE_KEY = 'vahi_offline_queue_v1';
const ITEM_CACHE_KEY = 'vahi_item_cache_v1';
const PARTY_CACHE_KEY = 'vahi_party_cache_v1';
const INVOICE_CACHE_KEY = 'vahi_invoice_cache_v1';
const EXPENSE_CACHE_KEY = 'vahi_expense_cache_v1';
const LOAN_CACHE_KEY = 'vahi_loan_cache_v1';
const GODOWN_CACHE_KEY = 'vahi_godown_cache_v1';
const CASH_BANK_CACHE_KEY = 'vahi_cash_bank_cache_v1';
const SETTINGS_CACHE_KEY = 'vahi_settings_cache_v1';

const MAX_MUTATIONS_PER_FLUSH = 28;
const AUTO_SYNC_INTERVAL_MS = 30_000;
const RETRY_BASE_DELAY_MS = 4_000;
const RETRY_MAX_DELAY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS_PER_MUTATION = 12;

type QueueMutationBase = {
    id: string;
    createdAt: string;
    attemptCount: number;
    nextRetryAt?: number;
    lastAttemptAt?: string;
    lastError?: string;
};

type QueueMutation =
    | (QueueMutationBase & { type: 'upsert_item'; payload: Record<string, unknown> & { id: string } })
    | (QueueMutationBase & { type: 'delete_item'; payload: { id: string } })
    | (QueueMutationBase & { type: 'upsert_party'; payload: Record<string, unknown> & { id: string } })
    | (QueueMutationBase & { type: 'archive_party'; payload: { id: string } })
    | (QueueMutationBase & { type: 'create_invoice'; payload: Record<string, unknown> & { localId?: string } })
    | (QueueMutationBase & { type: 'record_invoice_payment'; payload: { invoiceId: string; paidAmount?: number; paymentMode?: string; date?: string } })
    | (QueueMutationBase & { type: 'delete_invoice'; payload: { id: string } })
    | (QueueMutationBase & { type: 'update_settings_section'; payload: { section: string; data: Record<string, unknown> } })
    | (QueueMutationBase & { type: 'create_expense'; payload: Record<string, unknown> & { localId?: string } })
    | (QueueMutationBase & { type: 'create_loan'; payload: Record<string, unknown> & { localId?: string } })
    | (QueueMutationBase & { type: 'cash_bank_deposit'; payload: Record<string, unknown> })
    | (QueueMutationBase & { type: 'cash_bank_withdraw'; payload: Record<string, unknown> })
    | (QueueMutationBase & { type: 'cash_bank_transfer'; payload: Record<string, unknown> })
    | (QueueMutationBase & { type: 'create_godown'; payload: Record<string, unknown> & { localId?: string } })
    | (QueueMutationBase & { type: 'delete_godown'; payload: { id: string } })
    | (QueueMutationBase & { type: 'create_pos_sale'; payload: Record<string, unknown> });

type EnqueueMutation =
    | { type: 'upsert_item'; payload: Record<string, unknown> & { id: string } }
    | { type: 'delete_item'; payload: { id: string } }
    | { type: 'upsert_party'; payload: Record<string, unknown> & { id: string } }
    | { type: 'archive_party'; payload: { id: string } }
    | { type: 'create_invoice'; payload: Record<string, unknown> & { localId?: string } }
    | { type: 'record_invoice_payment'; payload: { invoiceId: string; paidAmount?: number; paymentMode?: string; date?: string } }
    | { type: 'delete_invoice'; payload: { id: string } }
    | { type: 'update_settings_section'; payload: { section: string; data: Record<string, unknown> } }
    | { type: 'create_expense'; payload: Record<string, unknown> & { localId?: string } }
    | { type: 'create_loan'; payload: Record<string, unknown> & { localId?: string } }
    | { type: 'cash_bank_deposit'; payload: Record<string, unknown> }
    | { type: 'cash_bank_withdraw'; payload: Record<string, unknown> }
    | { type: 'cash_bank_transfer'; payload: Record<string, unknown> }
    | { type: 'create_godown'; payload: Record<string, unknown> & { localId?: string } }
    | { type: 'delete_godown'; payload: { id: string } }
    | { type: 'create_pos_sale'; payload: Record<string, unknown> };

let flushInFlight: Promise<{ processed: number; remaining: number }> | null = null;
let autoSyncHandle: ReturnType<typeof setInterval> | null = null;
let queuedFlushTimeout: ReturnType<typeof setTimeout> | null = null;

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
    try {
        const raw = await offlineKeyValueStore.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
};

const writeJson = async <T>(key: string, value: T): Promise<void> => {
    await offlineKeyValueStore.setItem(key, JSON.stringify(value));
};

const sortByUpdatedAtDesc = <T extends { updatedAt?: string; createdAt?: string }>(list: T[]): T[] =>
    [...list].sort((a, b) => {
        const aKey = a.updatedAt ?? a.createdAt ?? '';
        const bKey = b.updatedAt ?? b.createdAt ?? '';
        return bKey.localeCompare(aKey);
    });

const toErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const asAxiosError = (error: unknown): AxiosError | null => {
    if (!error || typeof error !== 'object') return null;
    const candidate = error as AxiosError & { isAxiosError?: boolean };
    if (candidate.isAxiosError) return candidate;
    return null;
};

export const isOfflineLikeError = (error: unknown): boolean => {
    const axiosError = asAxiosError(error);
    if (axiosError) {
        if (!axiosError.response) return true;
        const status = axiosError.response.status;
        return status === 408 || status === 429 || status >= 500;
    }

    const message = toErrorMessage(error).toLowerCase();
    return (
        message.includes('network')
        || message.includes('timeout')
        || message.includes('internet')
        || message.includes('fetch')
        || message.includes('offline')
    );
};

const shouldDropMutation = (error: unknown): boolean => {
    const axiosError = asAxiosError(error);
    if (!axiosError?.response) return false;
    const status = axiosError.response.status;
    return status === 400 || status === 404 || status === 422;
};

const shouldStopFlush = (error: unknown): boolean => {
    const axiosError = asAxiosError(error);
    return axiosError?.response?.status === 401;
};

const isConflictMutationError = (error: unknown): boolean => {
    const axiosError = asAxiosError(error);
    const status = axiosError?.response?.status;
    return status === 409 || status === 412;
};

const getRetryDelayMs = (attemptCount: number): number => {
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, Math.min(attemptCount - 1, 5));
    return Math.min(delay, RETRY_MAX_DELAY_MS);
};

const generateLocalId = (prefix: string): string =>
    `local_${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const normalizeQueueMutation = (raw: QueueMutation): QueueMutation => ({
    ...raw,
    attemptCount: raw.attemptCount ?? 0,
});

const asUpsertItemMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'upsert_item' }> | null =>
    mutation.type === 'upsert_item' ? mutation : null;

const asUpsertPartyMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'upsert_party' }> | null =>
    mutation.type === 'upsert_party' ? mutation : null;

const asSettingsMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'update_settings_section' }> | null =>
    mutation.type === 'update_settings_section' ? mutation : null;

const asRecordPaymentMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'record_invoice_payment' }> | null =>
    mutation.type === 'record_invoice_payment' ? mutation : null;

const compactQueueForEnqueue = (
    queue: QueueMutation[],
    mutation: EnqueueMutation
): QueueMutation[] => {
    const full = {
        ...mutation,
        id: generateLocalId('mut'),
        createdAt: new Date().toISOString(),
        attemptCount: 0,
    } as QueueMutation;

    if (mutation.type === 'upsert_item') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'upsert_item' }>;
        const targetId = typed.payload.id;
        return [
            ...queue.filter(
                (entry) => {
                    const candidate = asUpsertItemMutation(entry);
                    return !(candidate && candidate.payload.id === targetId);
                }
            ),
            full,
        ];
    }

    if (mutation.type === 'upsert_party') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'upsert_party' }>;
        const targetId = typed.payload.id;
        return [
            ...queue.filter(
                (entry) => {
                    const candidate = asUpsertPartyMutation(entry);
                    return !(candidate && candidate.payload.id === targetId);
                }
            ),
            full,
        ];
    }

    if (mutation.type === 'update_settings_section') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'update_settings_section' }>;
        const targetSection = typed.payload.section;
        return [
            ...queue.filter(
                (entry) => {
                    const candidate = asSettingsMutation(entry);
                    return !(candidate && candidate.payload.section === targetSection);
                }
            ),
            full,
        ];
    }

    if (mutation.type === 'record_invoice_payment') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'record_invoice_payment' }>;
        const targetInvoiceId = typed.payload.invoiceId;
        return [
            ...queue.filter(
                (entry) => {
                    const candidate = asRecordPaymentMutation(entry);
                    return !(candidate && candidate.payload.invoiceId === targetInvoiceId);
                }
            ),
            full,
        ];
    }

    return [...queue, full];
};

const scheduleFlushSoon = (delayMs = 300) => {
    if (queuedFlushTimeout) clearTimeout(queuedFlushTimeout);
    queuedFlushTimeout = setTimeout(() => {
        queuedFlushTimeout = null;
        void offlineSyncService.flushQueue();
    }, delayMs);
};

const applyMutation = async (mutation: QueueMutation): Promise<void> => {
    switch (mutation.type) {
        case 'upsert_item':
            await api.post('/api/items', mutation.payload);
            return;
        case 'delete_item':
            await api.delete(`/api/items/${encodeURIComponent(mutation.payload.id)}`);
            return;
        case 'upsert_party':
            await api.post('/api/parties', mutation.payload);
            return;
        case 'archive_party':
            await api.patch(`/api/parties/${encodeURIComponent(mutation.payload.id)}`, { isActive: false });
            return;
        case 'create_invoice': {
            const payload = { ...mutation.payload };
            delete payload.localId;
            await api.post('/api/transactions', payload);
            return;
        }
        case 'record_invoice_payment':
            await api.patch(
                `/api/transactions/${encodeURIComponent(mutation.payload.invoiceId)}/payment`,
                {
                    paidAmount: mutation.payload.paidAmount,
                    paymentMode: mutation.payload.paymentMode,
                    date: mutation.payload.date,
                }
            );
            return;
        case 'delete_invoice':
            await api.delete(`/api/transactions/${encodeURIComponent(mutation.payload.id)}`);
            return;
        case 'update_settings_section':
            await api.put(`/api/settings/${encodeURIComponent(mutation.payload.section)}`, {
                data: mutation.payload.data,
            });
            return;
        case 'create_expense': {
            const payload = { ...mutation.payload };
            delete payload.localId;
            await api.post('/api/expenses', payload);
            return;
        }
        case 'create_loan': {
            const payload = { ...mutation.payload };
            delete payload.localId;
            await api.post('/api/loans', payload);
            return;
        }
        case 'cash_bank_deposit':
            await api.post('/api/cash-bank/deposit', mutation.payload);
            return;
        case 'cash_bank_withdraw':
            await api.post('/api/cash-bank/withdraw', mutation.payload);
            return;
        case 'cash_bank_transfer':
            await api.post('/api/cash-bank/transfer', mutation.payload);
            return;
        case 'create_godown': {
            const payload = { ...mutation.payload };
            delete payload.localId;
            await api.post('/api/godowns', payload);
            return;
        }
        case 'delete_godown':
            await api.delete(`/api/godowns/${encodeURIComponent(mutation.payload.id)}`);
            return;
        case 'create_pos_sale':
            await api.post('/api/pos/sale', mutation.payload);
            return;
        default:
            return;
    }
};

const asObject = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const resolveConflict = async (mutation: QueueMutation): Promise<boolean> => {
    try {
        switch (mutation.type) {
            case 'upsert_item':
                await api.patch(`/api/items/${encodeURIComponent(mutation.payload.id)}`, mutation.payload);
                return true;
            case 'upsert_party':
                await api.patch(`/api/parties/${encodeURIComponent(mutation.payload.id)}`, mutation.payload);
                return true;
            case 'update_settings_section': {
                const section = encodeURIComponent(mutation.payload.section);
                const current = await api.get<{ ok?: boolean; data?: Record<string, unknown> }>(`/api/settings/${section}`);
                const merged = {
                    ...asObject(current?.data),
                    ...asObject(mutation.payload.data),
                };
                await api.put(`/api/settings/${section}`, { data: merged });
                return true;
            }
            case 'record_invoice_payment': {
                const invoiceId = encodeURIComponent(mutation.payload.invoiceId);
                const current = await api.get<{ invoice?: Record<string, unknown>; data?: Record<string, unknown> }>(
                    `/api/transactions/${invoiceId}`
                );
                const invoice = asObject(current?.invoice ?? current?.data);
                const serverPaid = Number(invoice.paidAmount ?? 0);
                const wantedPaid = Number(mutation.payload.paidAmount ?? 0);
                if (serverPaid >= wantedPaid && wantedPaid > 0) return true;

                await api.patch(`/api/transactions/${invoiceId}/payment`, {
                    paidAmount: mutation.payload.paidAmount,
                    paymentMode: mutation.payload.paymentMode,
                    date: mutation.payload.date,
                });
                return true;
            }
            case 'create_invoice':
            case 'create_pos_sale':
            case 'delete_item':
            case 'archive_party':
            case 'delete_invoice':
            case 'delete_godown':
                // Conflict here is usually duplicate/already-applied. Treat as resolved.
                return true;
            default:
                return false;
        }
    } catch {
        return false;
    }
};

class OfflineSyncService {
    createLocalId(prefix: string): string {
        return generateLocalId(prefix);
    }

    getStorageBackend() {
        return offlineKeyValueStore.getBackendName();
    }

    async getQueue(): Promise<QueueMutation[]> {
        const queue = await readJson<QueueMutation[]>(OFFLINE_QUEUE_KEY, []);
        return queue.map(normalizeQueueMutation);
    }

    async enqueueMutation(mutation: EnqueueMutation): Promise<void> {
        const queue = await this.getQueue();
        const next = compactQueueForEnqueue(queue, mutation);
        await writeJson(OFFLINE_QUEUE_KEY, next);
        scheduleFlushSoon();
    }

    async getQueueStats(): Promise<{ pendingCount: number; oldestCreatedAt: string | null }> {
        const queue = await this.getQueue();
        const oldestCreatedAt = queue.length > 0 ? queue[0].createdAt : null;
        return { pendingCount: queue.length, oldestCreatedAt };
    }

    async flushQueue(): Promise<{ processed: number; remaining: number }> {
        if (flushInFlight) return flushInFlight;
        flushInFlight = (async () => {
            if (!(await isOnline())) {
                const queue = await this.getQueue();
                return { processed: 0, remaining: queue.length };
            }

            const queue = await this.getQueue();
            if (queue.length === 0) return { processed: 0, remaining: 0 };

            const nextQueue: QueueMutation[] = [];
            let processed = 0;
            let attempts = 0;
            const now = Date.now();

            for (let index = 0; index < queue.length; index += 1) {
                if (attempts >= MAX_MUTATIONS_PER_FLUSH) {
                    nextQueue.push(...queue.slice(index));
                    break;
                }

                const mutation = queue[index];
                if ((mutation.nextRetryAt ?? 0) > now) {
                    nextQueue.push(mutation);
                    continue;
                }

                attempts += 1;
                try {
                    await applyMutation(mutation);
                    processed += 1;
                } catch (error) {
                    if (isConflictMutationError(error)) {
                        const resolved = await resolveConflict(mutation);
                        if (resolved) {
                            processed += 1;
                            continue;
                        }
                    }

                    if (shouldDropMutation(error)) {
                        processed += 1;
                        continue;
                    }

                    const attemptCount = (mutation.attemptCount ?? 0) + 1;
                    if (attemptCount >= MAX_ATTEMPTS_PER_MUTATION) {
                        processed += 1;
                        continue;
                    }

                    nextQueue.push({
                        ...mutation,
                        attemptCount,
                        lastAttemptAt: new Date().toISOString(),
                        lastError: toErrorMessage(error),
                        nextRetryAt: Date.now() + getRetryDelayMs(attemptCount),
                    });

                    if (shouldStopFlush(error)) {
                        nextQueue.push(...queue.slice(index + 1));
                        break;
                    }
                }
            }

            await writeJson(OFFLINE_QUEUE_KEY, nextQueue);
            if (nextQueue.length > 0) {
                const nearestRetryAt = nextQueue.reduce<number>((minValue, entry) => {
                    const nextAt = entry.nextRetryAt ?? Date.now() + AUTO_SYNC_INTERVAL_MS;
                    return Math.min(minValue, nextAt);
                }, Date.now() + AUTO_SYNC_INTERVAL_MS);
                const delayMs = Math.max(250, nearestRetryAt - Date.now());
                scheduleFlushSoon(delayMs);
            }
            return { processed, remaining: nextQueue.length };
        })();

        try {
            return await flushInFlight;
        } finally {
            flushInFlight = null;
        }
    }

    startAutoSync(intervalMs = AUTO_SYNC_INTERVAL_MS): void {
        if (autoSyncHandle) return;
        autoSyncHandle = setInterval(() => {
            void this.flushQueue();
        }, intervalMs);
    }

    stopAutoSync(): void {
        if (!autoSyncHandle) return;
        clearInterval(autoSyncHandle);
        autoSyncHandle = null;
    }

    onNetworkStateChange(online: boolean): void {
        if (online) {
            scheduleFlushSoon(120);
        }
    }

    async clearAllLocalData(): Promise<void> {
        await offlineKeyValueStore.multiRemove([
            OFFLINE_QUEUE_KEY,
            ITEM_CACHE_KEY,
            PARTY_CACHE_KEY,
            INVOICE_CACHE_KEY,
            EXPENSE_CACHE_KEY,
            LOAN_CACHE_KEY,
            GODOWN_CACHE_KEY,
            CASH_BANK_CACHE_KEY,
            SETTINGS_CACHE_KEY,
        ]);
    }

    async getCachedItems(): Promise<Item[]> {
        return readJson<Item[]>(ITEM_CACHE_KEY, []);
    }

    async setCachedItems(items: Item[]): Promise<void> {
        await writeJson(ITEM_CACHE_KEY, sortByUpdatedAtDesc(items));
    }

    async upsertCachedItem(item: Item): Promise<void> {
        const current = await this.getCachedItems();
        const exists = current.some((entry) => entry.id === item.id);
        const next = exists
            ? current.map((entry) => (entry.id === item.id ? item : entry))
            : [item, ...current];
        await this.setCachedItems(next);
    }

    async removeCachedItem(id: string): Promise<void> {
        const current = await this.getCachedItems();
        await this.setCachedItems(current.filter((entry) => entry.id !== id));
    }

    async getCachedParties(): Promise<Party[]> {
        return readJson<Party[]>(PARTY_CACHE_KEY, []);
    }

    async setCachedParties(parties: Party[]): Promise<void> {
        await writeJson(PARTY_CACHE_KEY, sortByUpdatedAtDesc(parties));
    }

    async upsertCachedParty(party: Party): Promise<void> {
        const current = await this.getCachedParties();
        const exists = current.some((entry) => entry.id === party.id);
        const next = exists
            ? current.map((entry) => (entry.id === party.id ? party : entry))
            : [party, ...current];
        await this.setCachedParties(next);
    }

    async archiveCachedParty(id: string): Promise<void> {
        const current = await this.getCachedParties();
        await this.setCachedParties(
            current.map((entry) =>
                entry.id === id ? { ...entry, isActive: false, updatedAt: new Date().toISOString() } : entry
            )
        );
    }

    async getCachedInvoices(): Promise<Invoice[]> {
        return readJson<Invoice[]>(INVOICE_CACHE_KEY, []);
    }

    async setCachedInvoices(invoices: Invoice[]): Promise<void> {
        await writeJson(INVOICE_CACHE_KEY, sortByUpdatedAtDesc(invoices));
    }

    async upsertCachedInvoice(invoice: Invoice): Promise<void> {
        const current = await this.getCachedInvoices();
        const exists = current.some((entry) => entry.id === invoice.id);
        const next = exists
            ? current.map((entry) => (entry.id === invoice.id ? invoice : entry))
            : [invoice, ...current];
        await this.setCachedInvoices(next);
    }

    async removeCachedInvoice(id: string): Promise<void> {
        const current = await this.getCachedInvoices();
        await this.setCachedInvoices(current.filter((entry) => entry.id !== id));
    }

    async archiveCachedInvoice(id: string): Promise<void> {
        const current = await this.getCachedInvoices();
        await this.setCachedInvoices(
            current.map((entry) =>
                entry.id === id ? { ...entry, isDeleted: true, updatedAt: new Date().toISOString() } : entry
            )
        );
    }

    async updateCachedInvoicePayment(
        invoiceId: string,
        payload: { paidAmount?: number; markAsPaid?: boolean }
    ): Promise<void> {
        const current = await this.getCachedInvoices();
        const next = current.map((invoice) => {
            if (invoice.id !== invoiceId) return invoice;
            const total = Number(invoice.totalInvoiceValue ?? 0);
            const paidAmount = payload.markAsPaid
                ? total
                : Math.max(0, Number(payload.paidAmount ?? invoice.paidAmount ?? 0));
            const due = Math.max(0, total - paidAmount);
            const paymentStatus: Invoice['paymentStatus'] =
                due === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
            return {
                ...invoice,
                paidAmount,
                paymentStatus,
                updatedAt: new Date().toISOString(),
            };
        });
        await this.setCachedInvoices(next);
    }

    async getCachedExpenses(): Promise<Expense[]> {
        return readJson<Expense[]>(EXPENSE_CACHE_KEY, []);
    }

    async setCachedExpenses(expenses: Expense[]): Promise<void> {
        await writeJson(EXPENSE_CACHE_KEY, sortByUpdatedAtDesc(expenses));
    }

    async upsertCachedExpense(expense: Expense): Promise<void> {
        const current = await this.getCachedExpenses();
        const exists = current.some((entry) => entry.id === expense.id);
        const next = exists
            ? current.map((entry) => (entry.id === expense.id ? expense : entry))
            : [expense, ...current];
        await this.setCachedExpenses(next);
    }

    async getCachedLoans(): Promise<Loan[]> {
        return readJson<Loan[]>(LOAN_CACHE_KEY, []);
    }

    async setCachedLoans(loans: Loan[]): Promise<void> {
        await writeJson(LOAN_CACHE_KEY, sortByUpdatedAtDesc(loans));
    }

    async upsertCachedLoan(loan: Loan): Promise<void> {
        const current = await this.getCachedLoans();
        const exists = current.some((entry) => entry.id === loan.id);
        const next = exists
            ? current.map((entry) => (entry.id === loan.id ? loan : entry))
            : [loan, ...current];
        await this.setCachedLoans(next);
    }

    async getCachedGodowns(): Promise<Godown[]> {
        return readJson<Godown[]>(GODOWN_CACHE_KEY, []);
    }

    async setCachedGodowns(godowns: Godown[]): Promise<void> {
        await writeJson(GODOWN_CACHE_KEY, sortByUpdatedAtDesc(godowns));
    }

    async upsertCachedGodown(godown: Godown): Promise<void> {
        const current = await this.getCachedGodowns();
        const exists = current.some((entry) => entry.id === godown.id);
        const next = exists
            ? current.map((entry) => (entry.id === godown.id ? godown : entry))
            : [godown, ...current];
        await this.setCachedGodowns(next);
    }

    async removeCachedGodown(id: string): Promise<void> {
        const current = await this.getCachedGodowns();
        await this.setCachedGodowns(current.filter((entry) => entry.id !== id));
    }

    async getCachedCashBankAccounts(): Promise<Account[]> {
        return readJson<Account[]>(CASH_BANK_CACHE_KEY, []);
    }

    async setCachedCashBankAccounts(accounts: Account[]): Promise<void> {
        await writeJson(CASH_BANK_CACHE_KEY, accounts);
    }

    async getAllCachedSettings(): Promise<Record<string, Record<string, unknown>>> {
        return readJson<Record<string, Record<string, unknown>>>(SETTINGS_CACHE_KEY, {});
    }

    async getCachedSettingsSection(section: string): Promise<Record<string, unknown>> {
        const all = await this.getAllCachedSettings();
        return all[section] ?? {};
    }

    async setCachedSettingsSection(section: string, data: Record<string, unknown>): Promise<void> {
        const all = await this.getAllCachedSettings();
        all[section] = data;
        await writeJson(SETTINGS_CACHE_KEY, all);
    }
}

export const offlineSyncService = new OfflineSyncService();
