import { api } from "@/lib/api";
import type { LiveSnapshot } from "./notificationService";

export interface SyncDiagnosticsSummary {
    totalBusinesses: number;
    syncAllowedBusinesses: number;
    syncRestrictedBusinesses: number;
    graceBusinesses: number;
    expiredBusinesses: number;
    queuedDeliveries: number;
}

export interface SyncDiagnosticsRow {
    businessId: string;
    businessName: string;
    businessCode: string | null;
    businessIsActive: boolean;
    subscriptionTier: string;
    subscriptionStatus: string;
    cloudSyncAllowed: boolean;
    hasCloudSyncFlag: boolean;
    restrictionReason: string | null;
    updatedAt: string;
}

export const syncDiagnosticsAdminService = {
    getOverview: async () => {
        const { data } = await api.get<{
            ok: boolean;
            summary: SyncDiagnosticsSummary;
            liveSnapshot: LiveSnapshot | null;
            rows: SyncDiagnosticsRow[];
        }>("/admin/sync/diagnostics");
        return data;
    },
};
