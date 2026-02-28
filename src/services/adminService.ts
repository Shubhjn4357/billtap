import { api } from "@/lib/api";

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
