import { api } from "@/lib/api";

export type NotificationChannel = "IN_APP" | "PUSH" | "EMAIL";

export interface NotificationTemplate {
    id: string;
    name: string;
    eventKey: string;
    channel: NotificationChannel;
    subject: string | null;
    body: string;
    variables: string[];
    isActive: boolean;
    createdByAdminId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface NotificationCampaign {
    id: string;
    title: string;
    templateId: string | null;
    channel: NotificationChannel;
    audience: string;
    targetFilter: Record<string, unknown>;
    status: string;
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdByAdminId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface NotificationDelivery {
    id: string;
    campaignId: string | null;
    templateId: string | null;
    businessId: string | null;
    userId: string | null;
    channel: NotificationChannel;
    status: string;
    errorMessage: string | null;
    metadata: Record<string, unknown>;
    sentAt: string | null;
    createdAt: string;
}

export interface LiveSnapshot {
    ts: string;
    signupsLast24h: number;
    billingEventsLast24h: number;
    errorSpikesLast24h: number;
    upgradesLast24h: number;
    downgradesLast24h: number;
    queueSpikes: number;
}

export interface MasterDataPayload {
    categories: {
        defaults: string[];
        configured: string[];
        discovered: string[];
        all: string[];
    };
    units: {
        defaults: string[];
        configured: string[];
        discovered: string[];
        all: string[];
    };
    templates: Array<{
        id: string;
        name: string;
        type: string;
        businessId: string | null;
        isDefault: boolean;
        isActive: boolean;
        updatedAt: string;
    }>;
}

export const notificationService = {
    getTemplates: async (includeInactive = true) => {
        const { data } = await api.get<{ ok: boolean; templates: NotificationTemplate[] }>("/admin/notifications/templates", {
            params: { includeInactive },
        });
        return data.templates;
    },
    createTemplate: async (payload: {
        name: string;
        eventKey: string;
        channel: NotificationChannel;
        subject?: string | null;
        body: string;
        variables?: string[];
        isActive?: boolean;
    }) => {
        const { data } = await api.post<{ ok: boolean; id: string }>("/admin/notifications/templates", payload);
        return data;
    },
    updateTemplate: async (id: string, payload: Partial<{
        name: string;
        eventKey: string;
        channel: NotificationChannel;
        subject: string | null;
        body: string;
        variables: string[];
        isActive: boolean;
    }>) => {
        const { data } = await api.patch<{ ok: boolean }>(`/admin/notifications/templates/${id}`, payload);
        return data;
    },
    deleteTemplate: async (id: string) => {
        const { data } = await api.delete<{ ok: boolean }>(`/admin/notifications/templates/${id}`);
        return data;
    },
    bulkTemplateAction: async (payload: {
        ids: string[];
        action: "ACTIVATE" | "DEACTIVATE" | "DELETE";
    }) => {
        const { data } = await api.post<{ ok: boolean; affected: number }>("/admin/notifications/templates/bulk", payload);
        return data;
    },
    getCampaigns: async (status?: string) => {
        const { data } = await api.get<{ ok: boolean; campaigns: NotificationCampaign[] }>("/admin/notifications/campaigns", {
            params: status ? { status } : {},
        });
        return data.campaigns;
    },
    createCampaign: async (payload: {
        title: string;
        templateId?: string | null;
        channel: NotificationChannel;
        audience?: string;
        targetFilter?: Record<string, unknown>;
        status?: string;
        scheduledAt?: string | null;
    }) => {
        const { data } = await api.post<{ ok: boolean; id: string }>("/admin/notifications/campaigns", payload);
        return data;
    },
    updateCampaign: async (id: string, payload: Partial<{
        title: string;
        templateId: string | null;
        channel: NotificationChannel;
        audience: string;
        targetFilter: Record<string, unknown>;
        status: string;
        scheduledAt: string | null;
    }>) => {
        const { data } = await api.patch<{ ok: boolean }>(`/admin/notifications/campaigns/${id}`, payload);
        return data;
    },
    deleteCampaign: async (id: string) => {
        const { data } = await api.delete<{ ok: boolean }>(`/admin/notifications/campaigns/${id}`);
        return data;
    },
    bulkCampaignAction: async (payload: {
        ids: string[];
        action: "TRIGGER" | "CANCEL" | "DELETE";
    }) => {
        const { data } = await api.post<{ ok: boolean; affected: number; deliveriesQueued: number }>("/admin/notifications/campaigns/bulk", payload);
        return data;
    },
    triggerCampaign: async (id: string) => {
        const { data } = await api.post<{ ok: boolean; deliveriesQueued: number }>(`/admin/notifications/campaigns/${id}/trigger`, {});
        return data;
    },
    cancelCampaign: async (id: string) => {
        const { data } = await api.post<{ ok: boolean }>(`/admin/notifications/campaigns/${id}/cancel`, {});
        return data;
    },
    runScheduledCampaigns: async () => {
        const { data } = await api.post<{ ok: boolean; processed: number; deliveriesQueued: number }>("/admin/notifications/campaigns/run-scheduled", {});
        return data;
    },
    getDeliveries: async (limit = 300) => {
        const { data } = await api.get<{ ok: boolean; deliveries: NotificationDelivery[] }>("/admin/notifications/deliveries", {
            params: { limit },
        });
        return data.deliveries;
    },
    getLiveSnapshot: async () => {
        const { data } = await api.get<{ ok: boolean; snapshot?: LiveSnapshot }>("/admin/live/snapshot");
        return data.snapshot ?? null;
    },
    getMasterData: async () => {
        const { data } = await api.get<{ ok: boolean } & MasterDataPayload>("/admin/master-data");
        return data;
    },
    updateMasterData: async (payload: {
        categories?: string[];
        units?: string[];
    }) => {
        const { data } = await api.patch<{
            ok: boolean;
            categories: string[];
            units: string[];
        }>("/admin/master-data", payload);
        return data;
    },
    seedMasterDataDefaults: async () => {
        const { data } = await api.post<{
            ok: boolean;
            seededTemplates: number;
            categories: string[];
            units: string[];
        }>("/admin/master-data/seed-defaults", {});
        return data;
    },
};
