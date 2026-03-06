import { api } from "@/lib/api";

export interface Organization {
    id: string;
    userId: string;
    name: string;
    code: string;
    gstNumber?: string;
    address?: string;
    phoneNumber?: string;
    email?: string;
    currency: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BusinessQuotas {
    maxInvoicesTotal: number | null;
    maxStaffUsers: number | null;
    storageLimitMb: number | null;
}

export const organizationService = {
    getAll: async () => {
        const response = await api.get<{ ok: boolean; organizations?: Organization[]; message?: string }>("/admin/organizations");
        if (!response.data?.ok) {
            throw new Error(response.data?.message || "Failed to load organizations.");
        }
        return response.data.organizations ?? [];
    },
    getById: async (id: string) => {
        const response = await api.get<{ ok: boolean; organization?: Organization; message?: string }>(`/admin/organizations/${id}`);
        if (!response.data?.ok || !response.data.organization) {
            throw new Error(response.data?.message || "Failed to load organization.");
        }
        return response.data.organization;
    },
    update: async (id: string, data: Partial<Organization>) => {
        const response = await api.patch<{ ok: boolean; message?: string }>(`/admin/organizations/${id}`, data);
        if (!response.data?.ok) {
            throw new Error(response.data?.message || "Failed to update organization.");
        }
        return response.data;
    },
    create: async (data: Partial<Organization>) => {
        const response = await api.post<{ ok: boolean; organization?: Organization; message?: string }>("/admin/organizations", data);
        if (!response.data?.ok) {
            throw new Error(response.data?.message || "Failed to create organization.");
        }
        return response.data;
    },
    toggleStatus: async (id: string) => {
        const response = await api.post<{ ok: boolean }>(`/admin/organizations/${id}/toggle-status`);
        return response.data;
    },
    remove: async (id: string) => {
        const response = await api.delete<{ ok: boolean; message?: string }>(`/admin/organizations/${id}`);
        if (!response.data?.ok) {
            throw new Error(response.data?.message || "Failed to delete organization.");
        }
        return response.data;
    },
    getQuotas: async (id: string) => {
        const response = await api.get<{ ok: boolean; quotas: BusinessQuotas }>(`/admin/businesses/${id}/quotas`);
        return response.data.quotas;
    },
    updateQuotas: async (id: string, data: Partial<BusinessQuotas>) => {
        const response = await api.patch<{ ok: boolean }>(`/admin/businesses/${id}/quotas`, data);
        return response.data;
    }
};
