import { api } from "@/lib/api";

export interface TreasuryStats {
    totalLiquidity: number;
    settlementsPending: number;
    institutionalReserve: number;
    netCashFlow: number;
}

export interface PayrollStats {
    totalDisbursed: number;
    totalStaff: number;
    avgSalary: number;
    activeBatches: number;
}

export interface TreasuryAccountRow {
    id: string;
    name: string;
    bankName: string;
    currentBalance: number;
    userId: string;
    ownerBusinessName?: string | null;
    updatedAt: string;
}

export interface PayrollBatchRow {
    id: string;
    userId: string;
    totalNet: number;
    status: string;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
    staffCount: number;
    ownerBusinessName?: string | null;
}

export interface SystemMetrics {
    totalUsers: number;
    activeSubscriptions: number;
    monthlyRevenue: number;
    systemHealth: number;
    userGrowth: number;
    revenueGrowth: number;
}

export interface AdminSettings {
    maintenanceMode: boolean;
    registrationAllowed: boolean;
    globalTaxRate: number;
    supportEmail: string;
}

export const adminService = {
    getTreasuryStats: async () => {
        const response = await api.get<{
            ok: boolean;
            stats: TreasuryStats;
            accounts: TreasuryAccountRow[];
        }>("/admin/treasury/stats");
        return response.data;
    },
    getPayrollStats: async () => {
        const response = await api.get<{
            ok: boolean;
            stats: PayrollStats;
            latestBatches: PayrollBatchRow[];
        }>("/admin/payroll/stats");
        return response.data;
    },
    getAnalyticsExtended: async () => {
        const response = await api.get<{ ok: boolean; metrics: SystemMetrics }>("/admin/analytics/extended");
        return response.data;
    },
    getSettings: async () => {
        const response = await api.get<{ ok: boolean; settings: AdminSettings }>("/admin/settings");
        return response.data.settings;
    },
    updateSettings: async (settings: Partial<AdminSettings>) => {
        const response = await api.patch<{ ok: boolean }>("/admin/settings", settings);
        return response.data;
    }
};
