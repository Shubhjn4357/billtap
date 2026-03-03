import { api } from "@/lib/api";

export interface BusinessFeatureFlagRecord {
    id: string;
    name: string;
    code: string;
}

export interface FeatureFlagDetails {
    businessId: string;
    moduleControl: {
        appModuleAccess: Record<string, boolean>;
        moduleVisibility: Record<string, boolean>;
    };
    subscription: {
        id: string;
        tier: string;
        billingCycle: string | null;
        status: string;
        featureFlagsEnabled: string[];
    } | null;
}

export interface FeatureFlagPatchPayload {
    appModuleAccess?: Record<string, boolean>;
    moduleVisibility?: Record<string, boolean>;
    featureFlagsEnabled?: string[];
}

const mapOrganizations = (payload: unknown): BusinessFeatureFlagRecord[] => {
    if (!payload || typeof payload !== "object") return [];
    const root = payload as { organizations?: Array<{ id: string; name?: string; code?: string }> };
    return (root.organizations ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name ?? entry.id,
        code: entry.code ?? "",
    }));
};

export const featureFlagService = {
    listBusinesses: async () => {
        const response = await api.get("/admin/organizations");
        return mapOrganizations(response.data);
    },
    getBusinessFlags: async (businessId: string) => {
        const response = await api.get<{ ok: boolean } & FeatureFlagDetails>(`/admin/businesses/${businessId}/feature-flags`);
        return response.data;
    },
    updateBusinessFlags: async (businessId: string, payload: FeatureFlagPatchPayload) => {
        const response = await api.patch<{ ok: boolean }>(`/admin/businesses/${businessId}/feature-flags`, payload);
        return response.data;
    },
};
