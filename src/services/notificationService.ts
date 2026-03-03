import { api } from "@/lib/api";

export type NotificationChannel = "IN_APP" | "PUSH" | "EMAIL" | "SMS" | "WHATSAPP";

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
};

