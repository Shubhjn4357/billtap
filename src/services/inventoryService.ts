import { api } from "@/lib/api";

export interface InventoryOverviewStats {
    totalSkus: number;
    lowStockAlerts: number;
    stockValue: number;
    recentMovements: number;
}

export interface InventoryOverviewItem {
    id: string;
    businessId: string;
    name: string;
    category: string;
    unit: string;
    stock: number;
    price: number;
    isActive: boolean;
    organizationName: string;
}

export interface InventoryItemRow {
    id: string;
    businessId: string;
    businessName: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    category: string;
    unit: string;
    stock: number;
    salePrice: number;
    purchasePrice: number;
    mrp: number;
    reorderLevel: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
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

    getItems: async (filters?: {
        businessId?: string;
        q?: string;
        includeInactive?: boolean;
        limit?: number;
    }) => {
        const response = await api.get<{
            ok: boolean;
            items: InventoryItemRow[];
        }>("/admin/inventory/items", { params: filters ?? {} });
        return response.data.items ?? [];
    },

    updateItem: async (id: string, payload: Partial<{
        name: string;
        category: string | null;
        unit: string | null;
        salePrice: number;
        purchasePrice: number;
        mrp: number;
        reorderLevel: number;
        stock: number;
        isActive: boolean;
    }>) => {
        const response = await api.patch<{ ok: boolean }>(`/admin/inventory/items/${id}`, payload);
        return response.data;
    },

    adjustStock: async (id: string, payload: { delta: number; reason?: string }) => {
        const response = await api.post<{ ok: boolean; stock: number }>(`/admin/inventory/items/${id}/adjust`, payload);
        return response.data;
    },

    restoreItem: async (id: string) => {
        const response = await api.post<{ ok: boolean }>(`/admin/inventory/items/${id}/restore`, {});
        return response.data;
    },

    deactivateItem: async (id: string) => {
        const response = await api.delete<{ ok: boolean }>(`/admin/inventory/items/${id}`);
        return response.data;
    },

    deleteItemPermanent: async (id: string) => {
        const response = await api.delete<{ ok: boolean }>(`/admin/inventory/items/${id}/permanent`);
        return response.data;
    },
};
