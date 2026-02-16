import type { Bill, Transaction, TransactionItem } from '../types';
import { isOnline } from '../utils/network';
import { apiClient } from './httpClient';
import { offlineSyncService } from './offlineSyncService';

export interface StoredBill extends Bill {
    createdAt: string | Date | number;
}

type ServerTransaction = Transaction & {
    billDate?: string | Date;
    createdAt?: string | Date;
};

const toTransactionItem = (item: Bill['items'][number]): TransactionItem => {
    const tax = Number(item.tax ?? 0);
    const total = Number(item.total ?? item.price * item.quantity);
    return {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        tax,
        total,
    };
};

const toStoredBill = (entry: ServerTransaction): StoredBill => ({
    id: entry.id,
    userId: entry.userId,
    customerName: entry.partyName ?? undefined,
    customerPhone: entry.partyPhone ?? undefined,
    businessName: undefined,
    businessAddress: undefined,
    gstNumber: undefined,
    currency: entry.currency ?? 'INR',
    items: (entry.items ?? []).map((line) => ({
        id: line.id,
        name: line.name,
        quantity: line.quantity,
        price: line.price,
        tax: line.tax,
        total: line.total,
    })),
    total: Number(entry.totalAmount ?? 0),
    createdAt: entry.billDate ?? entry.createdAt ?? new Date().toISOString(),
});

export const billService = {
    async createBill(bill: Omit<Bill, 'createdAt' | 'id'>): Promise<string> {
        const generatedId = offlineSyncService.createLocalId('bill');
        const createdAt = new Date().toISOString();

        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const saleItems = bill.items.map(toTransactionItem);
                const billMode = bill.billMode ?? 'GST';
                const taxAmount = saleItems.reduce((sum, line) => {
                    const taxable = line.quantity * line.price;
                    return sum + (taxable * line.tax) / 100;
                }, 0);

                const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>('/transactions', {
                    id: generatedId,
                    type: bill.type ?? 'SALE',
                    partyId: bill.partyId,
                    partyName: bill.customerName,
                    partyPhone: bill.customerPhone,
                    billNumber: bill.billNumber,
                    billDate: bill.billDate ?? createdAt,
                    businessName: bill.businessName,
                    businessAddress: bill.businessAddress,
                    gstNumber: bill.gstNumber,
                    items: saleItems,
                    totalAmount: bill.total,
                    discountAmount: 0,
                    taxAmount,
                    billMode,
                    affectsGst: billMode === 'GST',
                    currency: bill.currency ?? 'INR',
                });
                if (!response.ok || !response.id) {
                    throw new Error(response.message || 'Failed to create bill.');
                }

                await offlineSyncService.upsertCachedBill<StoredBill>({
                    ...bill,
                    id: response.id,
                    createdAt,
                });
                return response.id;
            } catch {
                // Fall back to offline queue below.
            }
        }

        if (online) {
            // ... online logic ...
        }

        await offlineSyncService.applyLocalBillStock(bill.items, bill.type ?? 'SALE');

        await offlineSyncService.upsertCachedBill<StoredBill>({
            ...bill,
            id: generatedId,
            createdAt,
        });
        await offlineSyncService.enqueueMutation({
            type: 'create_bill',
            payload: {
                id: generatedId,
                type: bill.type,
                partyId: bill.partyId,
                customerName: bill.customerName,
                customerPhone: bill.customerPhone,
                businessName: bill.businessName,
                businessAddress: bill.businessAddress,
                gstNumber: bill.gstNumber,
                currency: bill.currency,
                billNumber: bill.billNumber,
                billDate: bill.billDate as string,
                billMode: bill.billMode ?? 'GST',
                items: bill.items,
                total: bill.total,
                createdAt,
            },
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
