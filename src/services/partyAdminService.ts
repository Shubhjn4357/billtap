import { api } from "@/lib/api";

export interface PartyAdminSummary {
    total: number;
    active: number;
    inactive: number;
    customers: number;
    suppliers: number;
}

export interface PartyAdminRow {
    id: string;
    businessId: string;
    businessName: string;
    type: "CUSTOMER" | "SUPPLIER";
    name: string;
    phone: string | null;
    email: string | null;
    billingAddress: string | null;
    gstin: string | null;
    openingBalance: number;
    creditLimit: number;
    loyaltyPoints: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export const partyAdminService = {
    getAll: async (filters?: {
        businessId?: string;
        q?: string;
        type?: "CUSTOMER" | "SUPPLIER";
        includeInactive?: boolean;
        limit?: number;
    }) => {
        const { data } = await api.get<{
            ok: boolean;
            summary: PartyAdminSummary;
            parties: PartyAdminRow[];
        }>("/admin/parties", { params: filters ?? {} });
        return data;
    },
    update: async (id: string, payload: Partial<{
        name: string;
        type: "CUSTOMER" | "SUPPLIER";
        phone: string | null;
        email: string | null;
        billingAddress: string | null;
        gstin: string | null;
        openingBalance: number;
        creditLimit: number;
        loyaltyPoints: number;
        isActive: boolean;
    }>) => {
        const { data } = await api.patch<{ ok: boolean }>(`/admin/parties/${id}`, payload);
        return data;
    },
    restore: async (id: string) => {
        const { data } = await api.post<{ ok: boolean }>(`/admin/parties/${id}/restore`, {});
        return data;
    },
    deactivate: async (id: string) => {
        const { data } = await api.delete<{ ok: boolean }>(`/admin/parties/${id}`);
        return data;
    },
    deletePermanent: async (id: string) => {
        const { data } = await api.delete<{ ok: boolean }>(`/admin/parties/${id}/permanent`);
        return data;
    },
};
