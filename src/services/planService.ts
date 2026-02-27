import { api } from "@/lib/api";

export interface Plan {
    id: string;
    name: string;
    description: string;
    monthlyPrice: number;
    currency: string;
    isActive: boolean;
    displayOrder: number;
    features: string[];
    createdAt: string;
    updatedAt: string;
}

export const planService = {
    getAll: async (includeInactive = true) => {
        const response = await api.get<{ ok: boolean; plans: Plan[] }>(`/admin/plans?includeInactive=${includeInactive}`);
        return response.data.plans;
    },
    getById: async (id: string) => {
        const response = await api.get<{ ok: boolean; plan: Plan }>(`/admin/plans/${id}`);
        return response.data.plan;
    },
    update: async (id: string, data: Partial<Plan>) => {
        const response = await api.patch<{ ok: boolean }>(`/admin/plans/${id}`, data);
        return response.data;
    },
    upsert: async (id: string, data: Partial<Plan>) => {
        const response = await api.put<{ ok: boolean }>(`/admin/plans/${id}`, data);
        return response.data;
    },
    create: async (data: Partial<Plan>) => {
        const response = await api.post<{ ok: boolean; id: string }>("/admin/plans", data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await api.delete<{ ok: boolean }>(`/admin/plans/${id}`);
        return response.data;
    }
};
