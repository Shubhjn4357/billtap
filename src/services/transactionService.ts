import { api } from "@/lib/api";

export interface Transaction {
    id: string;
    
    userId: string;
    type: 'SALE' | 'PURCHASE' | 'RETURN_INWARD' | 'RETURN_OUTWARD';
    totalAmount: number;
    paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
    paymentMode: 'CASH' | 'BANK' | 'UPI' | 'CARD' | 'CREDIT';
    createdAt: string;
    updatedAt: string;
    // Simple view:
    organizationName?: string;
}

export const transactionService = {
    getAll: async (limit = 100) => {
        const response = await api.get<{ ok: boolean; transactions: Transaction[] }>(`/admin/transactions?limit=${limit}`);
        return response.data.transactions;
    }
};
