import { api } from "@/lib/api";

export interface StaffOverviewStats {
    totalPersonnel: number;
    verifiedAdmins: number;
    pendingInvites: number;
    revokedAccess: number;
}

export interface StaffDirectoryRow {
    id: string;
    name: string;
    contact: string;
    role: string;
    organizationName: string;
    status: string;
}

export const staffService = {
    getOverview: async (limit = 200) => {
        const response = await api.get<{
            ok: boolean;
            stats: StaffOverviewStats;
            staff: StaffDirectoryRow[];
        }>(`/admin/staff/overview?limit=${limit}`);
        return response.data;
    },
};
