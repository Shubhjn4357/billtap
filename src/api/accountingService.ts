import type { Account, AccountType, JournalLineInput } from '../types';
import { apiClient } from './httpClient';

export const accountingService = {
    async getAccounts(type?: AccountType): Promise<Account[]> {
        const suffix = type ? `?type=${encodeURIComponent(type)}` : '';
        const response = await apiClient.get<{ ok: boolean; accounts?: Account[]; message?: string }>(
            `/accounting/accounts${suffix}`
        );
        if (!response.ok) throw new Error(response.message || 'Failed to fetch accounts.');
        return response.accounts ?? [];
    },

    async seedDefaultAccounts(): Promise<void> {
        const response = await apiClient.post<{ ok: boolean; message?: string }>('/accounting/accounts/seed-default');
        if (!response.ok) throw new Error(response.message || 'Failed to seed default accounts.');
    },

    async createAccount(payload: {
        code: string;
        name: string;
        type: AccountType;
        parentId?: string;
        isActive?: boolean;
    }): Promise<string> {
        const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>(
            '/accounting/accounts',
            payload
        );
        if (!response.ok || !response.id) throw new Error(response.message || 'Failed to create account.');
        return response.id;
    },

    async createJournalEntry(payload: {
        entryDate?: string | Date;
        batchNumber?: string;
        referenceType?: string;
        referenceId?: string;
        narration?: string;
        currency?: string;
        lines: JournalLineInput[];
    }): Promise<string> {
        const response = await apiClient.post<{ ok: boolean; entryId?: string; message?: string }>(
            '/accounting/journals',
            payload
        );
        if (!response.ok || !response.entryId) throw new Error(response.message || 'Failed to create journal.');
        return response.entryId;
    },

    async getTrialBalance(start?: string, end?: string) {
        const params = new URLSearchParams();
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        const suffix = params.toString();
        const response = await apiClient.get<{
            ok: boolean;
            rows: {
                accountId: string;
                code: string;
                name: string;
                type: AccountType;
                debit: number;
                credit: number;
                balance: number;
            }[];
            summary: { totalDebit: number; totalCredit: number; isBalanced: boolean };
            message?: string;
        }>(`/accounting/trial-balance${suffix ? `?${suffix}` : ''}`);
        if (!response.ok) throw new Error(response.message || 'Failed to fetch trial balance.');
        return response;
    },

    async getGstSummary(start?: string, end?: string) {
        const params = new URLSearchParams();
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        const suffix = params.toString();
        const response = await apiClient.get<{
            ok: boolean;
            taxableTurnover: number;
            outputTax: number;
            inputTax: number;
            netGstPayable: number;
            byHsn: { hsn: string; taxableValue: number; gstAmount: number; quantity: number }[];
            message?: string;
        }>(`/accounting/gst/summary${suffix ? `?${suffix}` : ''}`);
        if (!response.ok) throw new Error(response.message || 'Failed to fetch GST summary.');
        return response;
    },

    async getProfitLoss(start?: string, end?: string) {
        const params = new URLSearchParams();
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        const suffix = params.toString();
        const response = await apiClient.get<{
            ok: boolean;
            income: { accountId: string; code: string; name: string; debit: number; credit: number; net: number }[];
            expenses: { accountId: string; code: string; name: string; debit: number; credit: number; net: number }[];
            totalIncome: number;
            totalExpenses: number;
            netProfit: number;
            message?: string;
        }>(`/accounting/profit-loss${suffix ? `?${suffix}` : ''}`);
        if (!response.ok) throw new Error(response.message || 'Failed to fetch Profit & Loss.');
        return response;
    },

    async getBalanceSheet(asOf?: string) {
        const params = new URLSearchParams();
        if (asOf) params.set('asOf', asOf);
        const suffix = params.toString();
        const response = await apiClient.get<{
            ok: boolean;
            assets: {
                rows: { accountId: string; code: string; name: string; balance: number }[];
                totalAssets: number;
            };
            liabilities: {
                rows: { accountId: string; code: string; name: string; balance: number }[];
                totalLiabilities: number;
            };
            equity: {
                rows: { accountId: string; code: string; name: string; balance: number }[];
                retainedEarnings: number;
                totalEquity: number;
            };
            equationDelta: number;
            isBalanced: boolean;
            message?: string;
        }>(`/accounting/balance-sheet${suffix ? `?${suffix}` : ''}`);
        if (!response.ok) throw new Error(response.message || 'Failed to fetch balance sheet.');
        return response;
    },

    async getInventoryValuation() {
        const response = await apiClient.get<{
            ok: boolean;
            totalCostValue: number;
            totalRetailValue: number;
            potentialGrossMargin: number;
            lowStockCount: number;
            rows: {
                itemId: string;
                name: string;
                category: string | null;
                stock: number;
                unit: string;
                minimumStock: number;
                costValue: number;
                retailValue: number;
            }[];
            message?: string;
        }>('/accounting/inventory/valuation');
        if (!response.ok) throw new Error(response.message || 'Failed to fetch inventory valuation.');
        return response;
    },

    async getReorderSuggestions() {
        const response = await apiClient.get<{
            ok: boolean;
            count: number;
            suggestions: {
                itemId: string;
                name: string;
                category: string | null;
                unit: string;
                stock: number;
                minimumStock: number;
                shortage: number;
                suggestedOrderQty: number;
                estimatedCost: number;
            }[];
            message?: string;
        }>('/accounting/inventory/reorder-suggestions');
        if (!response.ok) throw new Error(response.message || 'Failed to fetch reorder suggestions.');
        return response;
    },

    async getStockAging() {
        const response = await apiClient.get<{
            ok: boolean;
            summary: {
                bucket: string;
                itemCount: number;
                quantity: number;
                costValue: number;
            }[];
            rows: {
                itemId: string;
                name: string;
                category: string | null;
                stock: number;
                unit: string;
                ageDays: number;
                bucket: string;
                lastMovementAt: string;
                costValue: number;
            }[];
            message?: string;
        }>('/accounting/inventory/stock-aging');
        if (!response.ok) throw new Error(response.message || 'Failed to fetch stock aging.');
        return response;
    },
};
