import { api } from "@/lib/api";

export interface Offer {
    id: string;
    title: string;
    message: string;
    bannerUrl?: string;
    bannerBackground?: string;
    ctaText?: string;
    ctaRoute?: string;
    audience: 'all' | 'owners' | 'staff';
    isActive: boolean;
    priority: number;
    startsAt?: string;
    endsAt?: string;
    createdAt: string;
    updatedAt: string;
}

export const offerService = {
    getAll: async (includeInactive = true) => {
        const response = await api.get<{ ok: boolean; offers: Offer[] }>(`/admin/offers?includeInactive=${includeInactive}`);
        return response.data.offers;
    },
    getById: async (id: string) => {
        const response = await api.get<{ ok: boolean; offer: Offer }>(`/admin/offers/${id}`);
        return response.data.offer;
    },
    update: async (id: string, data: Partial<Offer>) => {
        const response = await api.patch<{ ok: boolean }>(`/admin/offers/${id}`, data);
        return response.data;
    },
    upsert: async (id: string, data: Partial<Offer>) => {
        const response = await api.put<{ ok: boolean }>(`/admin/offers/${id}`, data);
        return response.data;
    },
    create: async (data: Partial<Offer>) => {
        const response = await api.post<{ ok: boolean; id: string }>("/admin/offers", data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await api.delete<{ ok: boolean }>(`/admin/offers/${id}`);
        return response.data;
    },
    toggleActive: async (id: string, isActive: boolean) => {
        const response = await api.patch<{ ok: boolean }>(`/admin/offers/${id}/active`, { isActive });
        return response.data;
    }
};
