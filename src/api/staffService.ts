import type { StaffInvite, UserProfile } from '../types';
import { apiClient } from './httpClient';

export const staffService = {
    async getStaff(): Promise<{ staff: UserProfile[]; invites: StaffInvite[] }> {
        const response = await apiClient.get<{
            ok: boolean;
            staff?: UserProfile[];
            invites?: StaffInvite[];
            message?: string;
        }>('/staff');
        if (!response.ok) {
            throw new Error(response.message || 'Failed to fetch staff.');
        }
        return {
            staff: response.staff ?? [],
            invites: response.invites ?? [],
        };
    },

    async inviteStaff(phoneNumber: string): Promise<{ inviteId: string; code: string }> {
        const response = await apiClient.post<{
            ok: boolean;
            inviteId?: string;
            code?: string;
            message?: string;
        }>('/staff', { phoneNumber });
        if (!response.ok || !response.inviteId || !response.code) {
            throw new Error(response.message || 'Failed to invite staff.');
        }
        return {
            inviteId: response.inviteId,
            code: response.code,
        };
    },

    async deleteInvite(inviteId: string): Promise<void> {
        const response = await apiClient.delete<{ ok: boolean; message?: string }>(`/staff/invite/${inviteId}`);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to delete invite.');
        }
    },

    async removeStaff(staffId: string): Promise<void> {
        const response = await apiClient.delete<{ ok: boolean; message?: string }>(`/staff/${staffId}`);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to remove staff.');
        }
    },

    async getStaffById(staffId: string): Promise<UserProfile> {
        const response = await apiClient.get<{ ok: boolean; staff?: UserProfile; message?: string }>(`/staff/${staffId}`);
        if (!response.ok || !response.staff) {
            throw new Error(response.message || 'Failed to fetch staff member.');
        }
        return response.staff;
    },

    async updateStaffRelation(
        staffId: string,
        payload: { role?: 'staff' | 'owner'; ownerId?: string | null }
    ): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/staff/${staffId}`, payload);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to update staff relation.');
        }
    }
};
