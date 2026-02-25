import type { Bill, BillItem, Transaction, TransactionType } from '../types';
import { isOnline } from '../utils/network';
import { apiClient } from './httpClient';
import { offlineSyncService } from './syncService';

export type StoredBill = Bill & {
    id: string;
    userId: string;
    createdAt: string;
    total: number;
    items: BillItem[];
};

/**
 * CachedBill — what offlineSyncService.upsertCachedBill actually writes.
 */
export type CachedBill = StoredBill & {
    type?: TransactionType;
    paymentStatus?: 'PAID' | 'PARTIAL' | 'PENDING';
    paidAmount?: number;
    dueAmount?: number;
    paymentMode?: 'CASH' | 'CREDIT';
    taxAmount?: number;
    partyId?: string;
    partyName?: string;
    customerName?: string;
    billNumber?: string;
};

type ServerTransaction = Transaction & {
    billDate?: string | Date;
    createdAt?: string | Date;
};

type RawDate = string | number | Date | null | undefined;

const normalizeTransactionTypeForApi = (value: TransactionType | undefined): 'SALE' | 'PURCHASE' => {
    if (value === 'SALE' || value === 'PURCHASE') return value;
    if (value === 'RETURN_OUTWARD') return 'SALE';
    if (value === 'RETURN_INWARD') return 'PURCHASE';
    return 'SALE';
};

const toIso = (value: RawDate, fallback: string): string => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
    }
    if (typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
    }
    return fallback;
};


const toStoredBill = (entry: ServerTransaction): StoredBill => {
    const createdAt = toIso(entry.createdAt ?? entry.billDate, new Date().toISOString());
    const enriched = entry as ServerTransaction & {
        businessName?: string | null;
        businessAddress?: string | null;
        billingAddress?: string | null;
        gstNumber?: string | null;
    };
    return {
        ...entry,
        id: entry.id,
        userId: entry.userId,
        billNumber: entry.billNumber,
        customerName: entry.partyName ?? undefined,
        customerPhone: entry.partyPhone ?? undefined,
        businessName: enriched.businessName ?? undefined,
        businessAddress: enriched.businessAddress ?? enriched.billingAddress ?? undefined,
        gstNumber: enriched.gstNumber ?? undefined,
        currency: entry.currency ?? 'INR',
        items: entry.items ?? [],
        total: Number(entry.totalAmount ?? 0),
        createdAt,
    } as StoredBill;
};

export const billService = {
    async createBill(bill: Omit<Bill, 'createdAt' | 'id'>): Promise<string> {
        const generatedId = offlineSyncService.createLocalId('bill');
        const createdAt = new Date().toISOString();
        const billDate = toIso(bill.billDate, createdAt);
        const totalAmount = Number(bill.total ?? 0);
        const taxAmount = bill.items.reduce((sum, item) => sum + ((item.price * item.quantity * (item.tax || 0)) / 100), 0);
        const paymentMode: 'CASH' | 'CREDIT' = bill.paymentMode ?? 'CASH';
        const paidAmount = paymentMode === 'CREDIT' ? 0 : totalAmount;
        const paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = paidAmount >= totalAmount
            ? 'PAID'
            : (paidAmount > 0 ? 'PARTIAL' : 'PENDING');

        const offlineBill: CachedBill = {
            ...bill,
            userId: '', // Should be filled if known, but creation will use context
            id: generatedId,
            total: totalAmount,
            billDate,
            paidAmount,
            dueAmount: Math.max(0, totalAmount - paidAmount),
            paymentStatus,
            paymentMode,
            taxAmount,
            createdAt,
        } as CachedBill;

        // 1. If Online: Attempt direct creation to get server ID
        if (await isOnline()) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>('/transactions', {
                    ...offlineBill,
                    type: normalizeTransactionTypeForApi(offlineBill.type),
                    partyName: offlineBill.customerName,
                    partyPhone: offlineBill.customerPhone,
                    totalAmount: offlineBill.total,
                });

                if (response.ok && response.id) {
                    const finalBill = { ...offlineBill, id: response.id };
                    await offlineSyncService.upsertCachedBill(finalBill);
                    return response.id;
                }
                if (!response.ok) throw new Error(response.message || 'Failed to create bill');
            } catch (error: unknown) {
                // If it's a structural error (4xx), throw it.
                // If it's a network error, fall through to offline path.
                if (error instanceof Error && (error as any).status >= 400 && (error as any).status < 500) {
                    throw error;
                }
            }
        }

        // 2. Offline Fallback
        await offlineSyncService.upsertCachedBill(offlineBill);
        await offlineSyncService.applyLocalBillStock(bill.items, bill.type ?? 'SALE');
        await offlineSyncService.enqueueMutation({
            type: 'create_bill',
            payload: offlineBill as any,
        });

        return generatedId;
    },


    async createBillWithStockValidation(bill: Omit<Bill, 'createdAt' | 'id'>): Promise<string> {
        return await this.createBill(bill);
    },

    async getUserBills(_userId: string, max = 200): Promise<StoredBill[]> {
        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.get<{
                    ok: boolean;
                    transactions?: ServerTransaction[];
                    message?: string;
                }>(`/transactions?type=SALE&limit=${max}`);
                if (!response.ok || !response.transactions) {
                    throw new Error(response.message || 'Failed to fetch bills.');
                }
                const mapped = response.transactions.map(toStoredBill);
                await offlineSyncService.setCachedBills(mapped);
                return mapped;
            } catch {
                // Fall back to cache.
            }
        }

        return await offlineSyncService.getCachedBills<StoredBill>();
    },

    async getUserBillsInRange(_userId: string, start: Date, end?: Date): Promise<StoredBill[]> {
        const entries = await this.getUserBills(_userId, 2000);
        const startTime = start.getTime();
        const endTime = end ? end.getTime() : Number.POSITIVE_INFINITY;

        return entries.filter((entry) => {
            const createdAt = new Date(entry.createdAt ?? 0).getTime();
            return createdAt >= startTime && createdAt <= endTime;
        });
    },
};
