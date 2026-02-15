import type { Transaction, TransactionType } from '../types';
import { apiClient } from './httpClient';

export const transactionService = {
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
        dueDate?: string | Date;
        reminderEnabled?: boolean;
        reminderFrequencyDays?: number;
        nextReminderAt?: string | Date;
        currency?: string;
        remark?: string;
    }): Promise<string> {
        const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>(
            '/transactions',
            payload
        );
        if (!response.ok || !response.id) {
            throw new Error(response.message || 'Failed to save transaction.');
        }
        return response.id;
    },

    async getTransactions(params?: { type?: TransactionType; start?: string; end?: string; limit?: number }): Promise<Transaction[]> {
        const search = new URLSearchParams();
        if (params?.type) search.set('type', params.type);
        if (params?.start) search.set('start', params.start);
        if (params?.end) search.set('end', params.end);
        if (params?.limit) search.set('limit', String(params.limit));

        const response = await apiClient.get<{ ok: boolean; transactions?: Transaction[]; message?: string }>(
            `/transactions${search.toString() ? `?${search.toString()}` : ''}`
        );
        if (!response.ok) {
            throw new Error(response.message || 'Failed to fetch transactions.');
        }
        return response.transactions ?? [];
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
        const response = await apiClient.patch<{
            ok: boolean;
            paymentStatus?: 'PAID' | 'PARTIAL' | 'PENDING';
            paidAmount?: number;
            dueAmount?: number;
            message?: string;
        }>(`/transactions/${encodeURIComponent(transactionId)}/payment`, payload);

        if (!response.ok || !response.paymentStatus) {
            throw new Error(response.message || 'Failed to update payment.');
        }

        return {
            paymentStatus: response.paymentStatus,
            paidAmount: Number(response.paidAmount ?? 0),
            dueAmount: Number(response.dueAmount ?? 0),
        };
    },

    async getPendingReminders(dueBefore?: string): Promise<{
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
    }[]> {
        const query = dueBefore ? `?dueBefore=${encodeURIComponent(dueBefore)}` : '';
        const response = await apiClient.get<{ ok: boolean; reminders?: {
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
        }[]; message?: string }>(`/transactions/pending-reminders${query}`);

        if (!response.ok) {
            throw new Error(response.message || 'Failed to fetch pending reminders.');
        }
        return response.reminders ?? [];
    },
};
