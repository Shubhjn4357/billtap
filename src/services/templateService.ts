import { api } from "@/lib/api";
import { Template } from "@/types";

export const templateService = {
    getAll: async () => {
        const response = await api.get<{ ok: boolean; templates: Template[] }>("/admin/templates");
        return response.data.templates;
    },
    create: async (payload: Partial<Template>) => {
        const response = await api.post<{ ok: boolean; template: Template }>("/admin/templates", payload);
        return response.data.template;
    },
    update: async (id: string, payload: Partial<Template>) => {
        const response = await api.patch<{ ok: boolean; message?: string }>(`/admin/templates/${id}`, payload);
        if (!response.data.ok) {
            throw new Error(response.data.message || "Failed to update template.");
        }
    },
    upsert: async (id: string, payload: Partial<Template>) => {
        const response = await api.put<{ ok: boolean; message?: string }>(`/admin/templates/${id}`, payload);
        if (!response.data.ok) {
            throw new Error(response.data.message || "Failed to save template.");
        }
    },
    remove: async (id: string) => {
        const response = await api.delete<{ ok: boolean; message?: string }>(`/admin/templates/${id}`);
        if (!response.data.ok) {
            throw new Error(response.data.message || "Failed to delete template.");
        }
    },
};
