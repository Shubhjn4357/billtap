import { api } from "@/lib/api";

export type SubscriptionTier = "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";
export type BillingCycle = "MONTHLY" | "YEARLY" | "THREE_YEAR" | null;
export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "TRIAL" | "CANCELLED" | "GRACE";

export interface AdminSubscriptionRow {
    id: string;
    businessId: string;
    businessName: string;
    businessCode: string | null;
    businessIsActive: boolean;
    ownerUserId: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
    tier: SubscriptionTier;
    billingCycle: BillingCycle;
    status: SubscriptionStatus;
    startDate: string | null;
    endDate: string | null;
    nextRenewalDate: string | null;
    graceEndDate: string | null;
    maxBillsTotal: number | null;
    maxBillsPerMonth: number | null;
    maxStaffUsers: number | null;
    maxBusinesses: number | null;
    maxDevices: number | null;
    maxStorageMb: number | null;
    offlineOnly: boolean;
    cloudSyncAllowed: boolean;
    webDashboardAllowed: boolean;
    featureFlagsEnabled: string[];
    planId: string | null;
    planDisplayName: string;
    monthlyAmount: number | null;
    currency: string;
    createdAt: string;
    updatedAt: string;
}

export interface SubscriptionSummary {
    total: number;
    byStatus: Record<SubscriptionStatus, number>;
    byTier: Record<SubscriptionTier, number>;
    byCycle: Record<"MONTHLY" | "YEARLY" | "THREE_YEAR" | "NONE", number>;
}

export interface SubscriptionListResponse {
    subscriptions: AdminSubscriptionRow[];
    summary: SubscriptionSummary;
}

export interface SubscriptionListFilters {
    status?: SubscriptionStatus;
    tier?: SubscriptionTier;
    billingCycle?: Exclude<BillingCycle, null>;
    businessId?: string;
    search?: string;
    limit?: number;
}

export interface AssignSubscriptionPayload {
    planId: string;
    status: SubscriptionStatus;
    durationDays: number;
}

export const subscriptionService = {
    async list(filters: SubscriptionListFilters = {}): Promise<SubscriptionListResponse> {
        const response = await api.get<{
            ok: boolean;
            subscriptions: AdminSubscriptionRow[];
            summary: SubscriptionSummary;
        }>("/admin/subscriptions", { params: filters });
        return {
            subscriptions: response.data.subscriptions ?? [],
            summary: response.data.summary,
        };
    },

    async assignToBusiness(businessId: string, payload: AssignSubscriptionPayload) {
        const response = await api.post<{ ok: boolean; id: string }>(`/admin/businesses/${businessId}/subscription`, payload);
        return response.data;
    },

    async update(subscriptionId: string, payload: Partial<{
        status: SubscriptionStatus;
        endDate: string | null;
        nextRenewalDate: string | null;
        graceEndDate: string | null;
        maxBillsTotal: number | null;
        maxBillsPerMonth: number | null;
        maxStaffUsers: number | null;
        maxBusinesses: number | null;
        maxDevices: number | null;
        maxStorageMb: number | null;
        offlineOnly: boolean;
        cloudSyncAllowed: boolean;
        webDashboardAllowed: boolean;
        featureFlagsEnabled: string[];
    }>) {
        const response = await api.patch<{ ok: boolean }>(`/admin/subscriptions/${subscriptionId}`, payload);
        return response.data;
    },

    async changePlan(subscriptionId: string, payload: {
        planId: string;
        status: SubscriptionStatus;
        durationDays: number;
    }) {
        const response = await api.post<{ ok: boolean }>(`/admin/subscriptions/${subscriptionId}/change-plan`, payload);
        return response.data;
    },

    async cancel(subscriptionId: string) {
        const response = await api.post<{ ok: boolean }>(`/admin/subscriptions/${subscriptionId}/cancel`, {});
        return response.data;
    },
};

