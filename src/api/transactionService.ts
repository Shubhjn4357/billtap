import type { Transaction, TransactionType } from '../types';
import { isOnline } from '../utils/network';
import { isNetworkLikeError } from '../utils/errorGuards';
import { apiClient } from './httpClient';
import { offlineSyncService } from './syncService';

type ReminderRow = {
    id: string;
    billNumber?: string;
    partyName?: string;
    partyPhone?: string;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    currency: string;
    dueDate?: string | null;
    reminderFrequencyDays: number;
    nextReminderAt?: string | null;
    paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
};

const normalizeTransactionTypeForApi = (value: TransactionType): 'SALE' | 'PURCHASE' => {
    if (value === 'SALE' || value === 'PURCHASE') return value;
    if (value === 'RETURN_OUTWARD') return 'SALE';
    if (value === 'RETURN_INWARD') return 'PURCHASE';
    return 'SALE';
};

const toIsoOrNull = (value?: string | Date | null): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
};

const toIsoOrNow = (value?: string | Date): string => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' && value.trim()) return value;
    return new Date().toISOString();
};

const derivePendingRemindersFromCachedBills = async (dueBefore?: string): Promise<ReminderRow[]> => {
    const dueBeforeTime = dueBefore ? new Date(dueBefore).getTime() : Number.POSITIVE_INFINITY;
    const cached = await offlineSyncService.getCachedBills<Record<string, unknown> & { id: string }>();

    return cached
        .map((entry) => {
            const totalAmount = Number((entry.total as number | undefined) ?? (entry.totalAmount as number | undefined) ?? 0);
            const paidAmount = Number((entry.paidAmount as number | undefined) ?? 0);
            const dueAmount = Math.max(0, totalAmount - paidAmount);
            const paymentStatusRaw = typeof entry.paymentStatus === 'string' ? entry.paymentStatus.toUpperCase() : '';
            const paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = paymentStatusRaw === 'PAID'
                ? 'PAID'
                : paymentStatusRaw === 'PARTIAL'
                    ? 'PARTIAL'
                    : (dueAmount <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'));
            const dueDate = typeof entry.dueDate === 'string' ? entry.dueDate : null;
            const dueDateTime = dueDate ? new Date(dueDate).getTime() : Number.POSITIVE_INFINITY;

            return {
                id: entry.id,
                billNumber: typeof entry.billNumber === 'string' ? entry.billNumber : undefined,
                partyName: typeof entry.customerName === 'string'
                    ? entry.customerName
                    : (typeof entry.partyName === 'string' ? entry.partyName : undefined),
                partyPhone: typeof entry.customerPhone === 'string'
                    ? entry.customerPhone
                    : (typeof entry.partyPhone === 'string' ? entry.partyPhone : undefined),
                totalAmount,
                paidAmount,
                dueAmount,
                currency: typeof entry.currency === 'string' ? entry.currency : 'INR',
                dueDate,
                reminderFrequencyDays: Number((entry.reminderFrequencyDays as number | undefined) ?? 7),
                nextReminderAt: typeof entry.nextReminderAt === 'string' ? entry.nextReminderAt : null,
                paymentStatus,
                dueDateTime,
            };
        })
        .filter((row) => row.paymentStatus !== 'PAID' && row.dueAmount > 0)
        .filter((row) => row.dueDateTime <= dueBeforeTime)
        .map(({ dueDateTime: _dueDateTime, ...row }) => row as ReminderRow);
};

const mapCachedBillToTransaction = (entry: Record<string, unknown> & { id: string }): Transaction => {
    const billDateValue = entry.billDate ?? entry.createdAt ?? new Date().toISOString();
    const createdAtValue = entry.createdAt ?? billDateValue ?? new Date().toISOString();
    const updatedAtValue = entry.updatedAt ?? createdAtValue;
    const rawItems = Array.isArray(entry.items) ? entry.items : [];
    const items = rawItems.map((raw) => {
        const line = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
        const quantity = Number(line.quantity ?? 0);
        const price = Number(line.price ?? 0);
        return {
            id: String(line.id ?? ''),
            name: String(line.name ?? ''),
            quantity,
            price,
            tax: Number(line.tax ?? 0),
            total: Number(line.total ?? quantity * price),
        };
    }).filter((line) => line.id && line.name);

    const totalAmount = Number(entry.totalAmount ?? entry.total ?? 0);
    const paidAmount = Number(entry.paidAmount ?? 0);
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    const paymentStatusRaw = typeof entry.paymentStatus === 'string' ? entry.paymentStatus.toUpperCase() : '';
    const paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = paymentStatusRaw === 'PAID'
        ? 'PAID'
        : paymentStatusRaw === 'PARTIAL'
            ? 'PARTIAL'
            : (dueAmount <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'));

    return {
        id: entry.id,
        userId: typeof entry.userId === 'string' ? entry.userId : '',
        type: entry.type === 'PURCHASE' ? 'PURCHASE' : 'SALE',
        partyId: typeof entry.partyId === 'string' ? entry.partyId : undefined,
        partyName: typeof entry.customerName === 'string'
            ? entry.customerName
            : (typeof entry.partyName === 'string' ? entry.partyName : undefined),
        partyPhone: typeof entry.customerPhone === 'string'
            ? entry.customerPhone
            : (typeof entry.partyPhone === 'string' ? entry.partyPhone : undefined),
        billNumber: typeof entry.billNumber === 'string' ? entry.billNumber : undefined,
        billDate: billDateValue as string | number | Date,
        items,
        totalAmount,
        taxAmount: Number(entry.taxAmount ?? 0),
        discountAmount: Number(entry.discountAmount ?? 0),
        paidAmount,
        paymentMode: entry.paymentMode === 'CREDIT' ? 'CREDIT' : 'CASH',
        paymentStatus,
        billMode: entry.billMode === 'ESTIMATE' ? 'ESTIMATE' : 'GST',
        affectsGst: entry.billMode === 'ESTIMATE' ? false : true,
        dueDate: (typeof entry.dueDate === 'string' ? entry.dueDate : null) as string | null,
        reminderEnabled: Boolean(entry.reminderEnabled),
        reminderFrequencyDays: Number(entry.reminderFrequencyDays ?? 0) || undefined,
        nextReminderAt: (typeof entry.nextReminderAt === 'string' ? entry.nextReminderAt : null) as string | null,
        currency: typeof entry.currency === 'string' ? entry.currency : 'INR',
        remark: typeof entry.remark === 'string' ? entry.remark : undefined,
        createdAt: createdAtValue as string | number | Date,
        updatedAt: updatedAtValue as string | number | Date,
    };
};

const deriveTransactionsFromCachedBills = async (
    params?: { type?: TransactionType; start?: string; end?: string; limit?: number }
): Promise<Transaction[]> => {
    const cached = await offlineSyncService.getCachedBills<Record<string, unknown> & { id: string }>();
    const startTime = params?.start ? new Date(params.start).getTime() : Number.NEGATIVE_INFINITY;
    const endTime = params?.end ? new Date(params.end).getTime() : Number.POSITIVE_INFINITY;
    const typed = params?.type;

    let mapped = cached
        .map(mapCachedBillToTransaction)
        .filter((entry) => !typed || entry.type === typed)
        .filter((entry) => {
            const at = new Date(entry.billDate ?? entry.createdAt ?? 0).getTime();
            return at >= startTime && at <= endTime;
        });

    mapped = mapped.sort((a, b) => {
        const aTime = new Date(a.createdAt ?? a.billDate ?? 0).getTime();
        const bTime = new Date(b.createdAt ?? b.billDate ?? 0).getTime();
        return bTime - aTime;
    });

    if (params?.limit && params.limit > 0) {
        mapped = mapped.slice(0, params.limit);
    }
    return mapped;
};

export const transactionService = {
    async checkBillNumberAvailability(billNumber: string): Promise<{
        billNumber: string;
        available: boolean;
        existingTransactionId: string | null;
    }> {
        const normalized = billNumber.trim().toUpperCase().replace(/\s+/g, '');
        if (!normalized) {
            return {
                billNumber: '',
                available: false,
                existingTransactionId: null,
            };
        }

        const online = await isOnline();
        if (online) {
            try {
                const response = await apiClient.get<{
                    ok: boolean;
                    message?: string;
                    billNumber?: string;
                    available?: boolean;
                    existingTransactionId?: string | null;
                }>(`/transactions/bill-number/check?billNumber=${encodeURIComponent(normalized)}`);

                if (!response.ok) {
                    throw new Error(response.message || 'Failed to validate bill number.');
                }

                return {
                    billNumber: (response.billNumber ?? normalized).trim().toUpperCase().replace(/\s+/g, ''),
                    available: Boolean(response.available),
                    existingTransactionId: response.existingTransactionId ?? null,
                };
            } catch (error: unknown) {
                if (!isNetworkLikeError(error)) {
                    throw error;
                }
            }
        }

        const cachedBills = await offlineSyncService.getCachedBills<Record<string, unknown> & { id: string }>();
        const existing = cachedBills.find((entry) => {
            const existingBillNumber = String(entry.billNumber ?? '')
                .trim()
                .toUpperCase()
                .replace(/\s+/g, '');
            return existingBillNumber === normalized;
        });

        return {
            billNumber: normalized,
            available: !existing,
            existingTransactionId: existing?.id ?? null,
        };
    },

    async createTransaction(payload: {
        id?: string;
        type: TransactionType;
        partyId?: string;
        partyName?: string;
        partyPhone?: string;
        billNumber?: string;
        billDate?: string | Date;
        businessName?: string;
        businessAddress?: string;
        gstNumber?: string;
        items: Transaction['items'];
        totalAmount: number;
        discountAmount?: number;
        taxAmount?: number;
        paidAmount?: number;
        paymentMode?: 'CASH' | 'CREDIT';
        paymentStatus?: 'PAID' | 'PARTIAL' | 'PENDING';
        billMode?: 'GST' | 'ESTIMATE';
        dueDate?: string | Date;
        reminderEnabled?: boolean;
        reminderFrequencyDays?: number;
        nextReminderAt?: string | Date;
        currency?: string;
        remark?: string;
    }): Promise<string> {
        const localId = payload.id ?? offlineSyncService.createLocalId('transaction');
        const billDate = toIsoOrNow(payload.billDate);
        const paidAmount = Number(payload.paidAmount ?? 0);
        const totalAmount = Number(payload.totalAmount ?? 0);
        const dueAmount = Math.max(0, totalAmount - paidAmount);
        const paymentStatus = payload.paymentStatus ?? (dueAmount <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'));
        const online = await isOnline();

        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>(
                    '/transactions',
                    {
                        ...payload,
                        type: normalizeTransactionTypeForApi(payload.type),
                        id: localId,
                        billDate,
                        dueDate: toIsoOrNull(payload.dueDate) ?? undefined,
                        nextReminderAt: toIsoOrNull(payload.nextReminderAt) ?? undefined,
                    }
                );
                if (!response.ok || !response.id) {
                    throw new Error(response.message || 'Failed to save transaction.');
                }

                await offlineSyncService.upsertCachedBill({
                    id: response.id,
                    type: payload.type,
                    billMode: payload.billMode ?? 'GST',
                    billNumber: payload.billNumber,
                    customerName: payload.partyName,
                    customerPhone: payload.partyPhone,
                    items: payload.items,
                    total: totalAmount,
                    totalAmount,
                    discountAmount: Number(payload.discountAmount ?? 0),
                    taxAmount: Number(payload.taxAmount ?? 0),
                    paidAmount,
                    dueAmount,
                    paymentMode: payload.paymentMode ?? (paidAmount > 0 ? 'CREDIT' : 'CASH'),
                    paymentStatus,
                    dueDate: toIsoOrNull(payload.dueDate) ?? null,
                    reminderEnabled: Boolean(payload.reminderEnabled),
                    reminderFrequencyDays: payload.reminderFrequencyDays,
                    nextReminderAt: toIsoOrNull(payload.nextReminderAt) ?? null,
                    currency: payload.currency ?? 'INR',
                    remark: payload.remark,
                    billDate,
                    createdAt: billDate,
                    updatedAt: new Date().toISOString(),
                });
                return response.id;
            } catch (error: unknown) {
                if (!isNetworkLikeError(error)) {
                    throw error;
                }
            }
        }

        const queuePayloadItems = payload.items.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            tax: Number(item.tax ?? 0),
            total: Number(item.total ?? (item.quantity * item.price)),
        }));

        await offlineSyncService.applyLocalBillStock(queuePayloadItems, normalizeTransactionTypeForApi(payload.type));

        await offlineSyncService.upsertCachedBill({
            id: localId,
            type: payload.type,
            billMode: payload.billMode ?? 'GST',
            billNumber: payload.billNumber,
            customerName: payload.partyName,
            customerPhone: payload.partyPhone,
            items: queuePayloadItems,
            total: totalAmount,
            totalAmount,
            discountAmount: Number(payload.discountAmount ?? 0),
            taxAmount: Number(payload.taxAmount ?? 0),
            paidAmount,
            dueAmount,
            paymentMode: payload.paymentMode ?? (paidAmount > 0 ? 'CREDIT' : 'CASH'),
            paymentStatus,
            dueDate: toIsoOrNull(payload.dueDate) ?? null,
            reminderEnabled: Boolean(payload.reminderEnabled),
            reminderFrequencyDays: payload.reminderFrequencyDays,
            nextReminderAt: toIsoOrNull(payload.nextReminderAt) ?? null,
            currency: payload.currency ?? 'INR',
            remark: payload.remark,
            billDate,
            createdAt: billDate,
            updatedAt: new Date().toISOString(),
        });

        await offlineSyncService.enqueueMutation({
            type: 'create_bill',
            payload: {
                id: localId,
                type: normalizeTransactionTypeForApi(payload.type),
                partyId: payload.partyId,
                customerName: payload.partyName,
                customerPhone: payload.partyPhone,
                businessName: payload.businessName,
                businessAddress: payload.businessAddress,
                gstNumber: payload.gstNumber,
                currency: payload.currency ?? 'INR',
                billNumber: payload.billNumber,
                billDate,
                billMode: payload.billMode ?? 'GST',
                items: queuePayloadItems,
                total: totalAmount,
                discountAmount: Number(payload.discountAmount ?? 0),
                taxAmount: Number(payload.taxAmount ?? 0),
                paidAmount,
                paymentMode: payload.paymentMode ?? (paidAmount > 0 ? 'CREDIT' : 'CASH'),
                paymentStatus,
                dueDate: toIsoOrNull(payload.dueDate) ?? null,
                reminderEnabled: Boolean(payload.reminderEnabled),
                reminderFrequencyDays: payload.reminderFrequencyDays,
                nextReminderAt: toIsoOrNull(payload.nextReminderAt) ?? null,
                remark: payload.remark,
                createdAt: billDate,
            },
        });

        return localId;
    },

    async getTransactions(params?: { type?: TransactionType; start?: string; end?: string; limit?: number }): Promise<Transaction[]> {
        const search = new URLSearchParams();
        if (params?.type) search.set('type', params.type);
        if (params?.start) search.set('start', params.start);
        if (params?.end) search.set('end', params.end);
        if (params?.limit) search.set('limit', String(params.limit));

        const online = await isOnline();
        if (online) {
            try {
                const response = await apiClient.get<{ ok: boolean; transactions?: Transaction[]; message?: string }>(
                    `/transactions${search.toString() ? `?${search.toString()}` : ''}`
                );
                if (!response.ok) {
                    throw new Error(response.message || 'Failed to fetch transactions.');
                }
                return response.transactions ?? [];
            } catch (error: unknown) {
                if (!isNetworkLikeError(error)) {
                    throw error;
                }
            }
        }

        return await deriveTransactionsFromCachedBills(params);
    },

    async updatePayment(
        transactionId: string,
        payload: {
            paidAmount?: number;
            markAsPaid?: boolean;
            dueDate?: string | Date | null;
            reminderEnabled?: boolean;
            reminderFrequencyDays?: number;
            nextReminderAt?: string | Date | null;
        }
    ): Promise<{ paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING'; paidAmount: number; dueAmount: number }> {
        const normalizedPayload = {
            paidAmount: payload.paidAmount,
            markAsPaid: payload.markAsPaid,
            dueDate: toIsoOrNull(payload.dueDate),
            reminderEnabled: payload.reminderEnabled,
            reminderFrequencyDays: payload.reminderFrequencyDays,
            nextReminderAt: toIsoOrNull(payload.nextReminderAt),
        };

        const online = await isOnline();
        if (online) {
            try {
                const response = await apiClient.patch<{
                    ok: boolean;
                    paymentStatus?: 'PAID' | 'PARTIAL' | 'PENDING';
                    paidAmount?: number;
                    dueAmount?: number;
                    message?: string;
                }>(`/transactions/${encodeURIComponent(transactionId)}/payment`, normalizedPayload);

                if (!response.ok || !response.paymentStatus) {
                    throw new Error(response.message || 'Failed to update payment.');
                }

                await offlineSyncService.updateCachedBillPayment(transactionId, normalizedPayload);
                return {
                    paymentStatus: response.paymentStatus,
                    paidAmount: Number(response.paidAmount ?? 0),
                    dueAmount: Number(response.dueAmount ?? 0),
                };
            } catch (error: unknown) {
                if (!isNetworkLikeError(error)) {
                    throw error;
                }
            }
        }

        const optimistic = await offlineSyncService.updateCachedBillPayment(transactionId, normalizedPayload);
        await offlineSyncService.enqueueMutation({
            type: 'update_transaction_payment',
            payload: {
                transactionId,
                paidAmount: normalizedPayload.paidAmount,
                markAsPaid: normalizedPayload.markAsPaid,
                dueDate: normalizedPayload.dueDate ?? undefined,
                reminderEnabled: normalizedPayload.reminderEnabled,
                reminderFrequencyDays: normalizedPayload.reminderFrequencyDays,
                nextReminderAt: normalizedPayload.nextReminderAt ?? undefined,
            },
        });
        return optimistic ?? {
            paymentStatus: normalizedPayload.markAsPaid ? 'PAID' : (normalizedPayload.paidAmount && normalizedPayload.paidAmount > 0 ? 'PARTIAL' : 'PENDING'),
            paidAmount: Number(normalizedPayload.paidAmount ?? 0),
            dueAmount: 0,
        };
    },

    async getPendingReminders(dueBefore?: string): Promise<ReminderRow[]> {
        const query = dueBefore ? `?dueBefore=${encodeURIComponent(dueBefore)}` : '';
        const online = await isOnline();

        if (online) {
            try {
                const response = await apiClient.get<{ ok: boolean; reminders?: ReminderRow[]; message?: string }>(
                    `/transactions/pending-reminders${query}`
                );

                if (!response.ok) {
                    throw new Error(response.message || 'Failed to fetch pending reminders.');
                }
                return response.reminders ?? [];
            } catch (error: unknown) {
                if (!isNetworkLikeError(error)) {
                    throw error;
                }
            }
        }

        return await derivePendingRemindersFromCachedBills(dueBefore);
    },
};
