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

export interface StaffInviteRow {
    id: string;
    businessId: string;
    businessName: string;
    ownerUserId: string;
    ownerName: string | null;
    ownerEmail: string | null;
    phoneNumber: string;
    role: "OWNER" | "STAFF";
    status: string;
    code: string;
    expiresAt: string;
    createdAt: string;
}

export interface StaffMemberRow {
    id: string;
    businessId: string;
    businessName: string;
    userId: string;
    userName: string;
    userEmail: string | null;
    userPhone: string | null;
    role: "OWNER" | "STAFF";
    isActive: boolean;
    joinedAt: string;
    updatedAt: string;
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

    getInvites: async (filters?: {
        businessId?: string;
        status?: "pending" | "accepted" | "cancelled" | "expired";
        limit?: number;
    }) => {
        const response = await api.get<{
            ok: boolean;
            invites: StaffInviteRow[];
        }>("/admin/staff/invites", { params: filters ?? {} });
        return response.data.invites ?? [];
    },

    createInvite: async (payload: {
        businessId: string;
        phoneNumber: string;
        role?: "OWNER" | "STAFF";
        expiresInDays?: number;
    }) => {
        const response = await api.post<{
            ok: boolean;
            id: string;
            code: string;
            expiresAt: string;
        }>("/admin/staff/invites", payload);
        return response.data;
    },

    deleteInvite: async (id: string) => {
        const response = await api.delete<{ ok: boolean }>(`/admin/staff/invites/${id}`);
        return response.data;
    },

    getMembers: async (filters?: {
        businessId?: string;
        role?: "OWNER" | "STAFF";
        isActive?: boolean;
        limit?: number;
    }) => {
        const response = await api.get<{
            ok: boolean;
            members: StaffMemberRow[];
        }>("/admin/staff/members", { params: filters ?? {} });
        return response.data.members ?? [];
    },

    updateMember: async (id: string, payload: {
        role?: "OWNER" | "STAFF";
        isActive?: boolean;
    }) => {
        const response = await api.patch<{ ok: boolean }>(`/admin/staff/members/${id}`, payload);
        return response.data;
    },

    removeMember: async (id: string) => {
        const response = await api.delete<{ ok: boolean }>(`/admin/staff/members/${id}`);
        return response.data;
    },
};
