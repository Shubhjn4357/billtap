import { api } from "@/lib/api";

export interface Transaction {
    id: string;
    businessId: string;
    userId: string;
    type: 'SALE' | 'PURCHASE' | 'RETURN_INWARD' | 'RETURN_OUTWARD';
    totalAmount: number;
    paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
    paymentStatusRaw?: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE';
    paidAmount: number;
    paymentMode: 'CASH' | 'BANK' | 'UPI' | 'CARD' | 'CREDIT';
    invoiceNumber?: string;
    invoiceType?: string;
    dueDate?: string | null;
    notes?: string | null;
    isDeleted?: boolean;
    createdAt: string;
    updatedAt: string;
    // Simple view:
    organizationName?: string;
}

export const transactionService = {
    getAll: async (params?: {
        limit?: number;
        businessId?: string;
        paymentStatus?: 'PAID' | 'PARTIAL' | 'PENDING';
        q?: string;
        includeDeleted?: boolean;
    }) => {
        const response = await api.get<{ ok: boolean; transactions: Transaction[] }>("/admin/transactions", {
            params: params ?? {},
        });
        return response.data.transactions;
    },

    update: async (id: string, payload: Partial<{
        paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
        paidAmount: number;
        dueDate: string | null;
        notes: string | null;
        isDeleted: boolean;
    }>) => {
        const response = await api.patch<{ ok: boolean }>(`/admin/transactions/${id}`, payload);
        return response.data;
    },

    markPaid: async (id: string) => {
        const response = await api.post<{ ok: boolean }>(`/admin/transactions/${id}/mark-paid`, {});
        return response.data;
    },

    remove: async (id: string) => {
        const response = await api.delete<{ ok: boolean }>(`/admin/transactions/${id}`);
        return response.data;
    },

    restore: async (id: string) => {
        const response = await api.post<{ ok: boolean }>(`/admin/transactions/${id}/restore`, {});
        return response.data;
    },
};
