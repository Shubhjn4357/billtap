import { api } from "@/lib/api";

export interface InventoryOverviewStats {
    totalSkus: number;
    lowStockAlerts: number;
    stockValue: number;
    recentMovements: number;
}

export interface InventoryOverviewItem {
    id: string;
    name: string;
    category: string;
    stock: number;
    price: number;
    organizationName: string;
}

export const inventoryService = {
    getOverview: async (limit = 200) => {
        const response = await api.get<{
            ok: boolean;
            stats: InventoryOverviewStats;
            items: InventoryOverviewItem[];
        }>(`/admin/inventory/overview?limit=${limit}`);
        return response.data;
    },
};
