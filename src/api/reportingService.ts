import { API_CONFIG } from '../constants/Api';
import { apiClient } from './httpClient';
import { getSessionToken } from './session';

export const reportingService = {
    async getPnL(start?: string, end?: string) {
        const params = new URLSearchParams();
        if (start) params.append('start', start);
        if (end) params.append('end', end);
        const qs = params.toString();
        const response = await apiClient.get<{
            ok: boolean;
            totalSales: number;
            totalPurchases: number;
            netProfit: number;
            currency?: string;
            message?: string;
        }>(`/reporting/pnl${qs ? `?${qs}` : ''}`);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to fetch P&L.');
        }
        return response;
    },

    async getBalanceSheet() {
        const response = await apiClient.get<{
            ok: boolean;
            assets: Record<string, number>;
            liabilities: Record<string, number>;
            equity: Record<string, number>;
            message?: string;
        }>('/reporting/balance-sheet');
        if (!response.ok) {
            throw new Error(response.message || 'Failed to fetch balance sheet.');
        }
        return response;
    },

    async getStockValuation() {
        const response = await apiClient.get<{
            ok: boolean;
            totalStockValue: number;
            potentialRetailValue: number;
            itemCount: number;
            message?: string;
        }>('/reporting/stock-valuation');
        if (!response.ok) {
            throw new Error(response.message || 'Failed to fetch stock valuation.');
        }
        return response;
    },

    async exportTransactions(format: 'json' | 'csv', params?: { type?: 'SALE' | 'PURCHASE'; start?: string; end?: string }) {
        const query = new URLSearchParams();
        query.set('format', format);
        if (params?.type) query.set('type', params.type);
        if (params?.start) query.set('start', params.start);
        if (params?.end) query.set('end', params.end);

        const endpoint = `${API_CONFIG.baseUrl}/reporting/export/transactions?${query.toString()}`;
        const token = await getSessionToken();
        const response = await fetch(endpoint, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) {
            throw new Error(`Export failed (${response.status})`);
        }

        return format === 'json' ? await response.json() : await response.text();
    }
};
