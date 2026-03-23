import { api } from "@/lib/api";

export interface ReportingGovernanceSummary {
    totalBusinesses: number;
    gstReadyBusinesses: number;
    pdfExportBusinesses: number;
    thermalReadyBusinesses: number;
    businessCardBusinesses: number;
}

export interface ReportingGovernanceRow {
    businessId: string;
    businessName: string;
    businessCode: string | null;
    businessIsActive: boolean;
    subscriptionTier: string;
    subscriptionStatus: string;
    gstEnabled: boolean;
    exportPdfEnabled: boolean;
    thermalReady: boolean;
    businessCardReady: boolean;
    invoiceTemplateCount: number;
    cardTemplateCount: number;
    updatedAt: string;
}

export const reportingGovernanceService = {
    getOverview: async () => {
        const { data } = await api.get<{
            ok: boolean;
            summary: ReportingGovernanceSummary;
            rows: ReportingGovernanceRow[];
        }>("/admin/reporting/governance");
        return data;
    },
};
