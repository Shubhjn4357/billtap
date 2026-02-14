import { apiClient } from './httpClient';
import { offlineSyncService } from './offlineSyncService';
import { isOnline } from '../utils/network';
import type { Bill } from '../types';

export interface StoredBill extends Bill {
    id: string;
    createdAt: string | Date | number;
}

export const billService = {
    async createBill(bill: Omit<Bill, 'createdAt'>): Promise<string> {
        const generatedId = offlineSyncService.createLocalId('bill');
        const createdAt = new Date().toISOString();
        const billPayload = {
            id: generatedId,
            ...bill,
            createdAt,
        };

        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>('/bills', billPayload);
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

        await offlineSyncService.applyLocalBillStock(bill.items);
        await offlineSyncService.upsertCachedBill<StoredBill>({
            ...bill,
            id: generatedId,
            createdAt,
        });
        await offlineSyncService.enqueueMutation({
            type: 'create_bill',
            payload: {
                id: generatedId,
                customerName: bill.customerName,
                customerPhone: bill.customerPhone,
                businessName: bill.businessName,
                businessAddress: bill.businessAddress,
                gstNumber: bill.gstNumber,
                currency: bill.currency,
                items: bill.items,
                total: bill.total,
                createdAt,
            },
        });

        return generatedId;
    },

    async createBillWithStockValidation(bill: Omit<Bill, 'createdAt'>): Promise<string> {
        return await this.createBill(bill);
    },

    async getUserBills(_userId: string, max = 200): Promise<StoredBill[]> {
        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                const response = await apiClient.get<{ ok: boolean; bills?: StoredBill[]; message?: string }>(`/bills?limit=${max}`);
                if (!response.ok || !response.bills) {
                    throw new Error(response.message || 'Failed to fetch bills.');
                }
                await offlineSyncService.setCachedBills(response.bills);
                return response.bills;
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
