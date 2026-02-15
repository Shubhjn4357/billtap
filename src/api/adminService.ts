import { apiClient } from './httpClient';
import type { MarketingOffer, SubscriptionPlan, UserProfile, UserRole } from '../types';

export const adminService = {
    async getAccess(): Promise<{ canAccess: boolean; role?: string; uid?: string; email?: string | null }> {
        const response = await apiClient.get<{ ok: boolean; canAccess?: boolean; role?: string; uid?: string; email?: string | null; message?: string }>('/admin/access');
        if (!response.ok) {
            throw new Error(response.message || 'Failed to verify admin access.');
        }
        return {
            canAccess: Boolean(response.canAccess),
            role: response.role,
            uid: response.uid,
            email: response.email,
        };
    },

    async getUsers(max = 200): Promise<UserProfile[]> {
        const response = await apiClient.get<{ ok: boolean; users?: UserProfile[]; message?: string }>(`/admin/users?limit=${max}`);
        if (!response.ok || !response.users) {
            throw new Error(response.message || 'Failed to fetch users.');
        }
        return response.users;
    },

    async updateUser(uid: string, payload: Partial<UserProfile>): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/admin/users/${uid}`, payload);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to update user.');
        }
    },

    async replaceUser(uid: string, payload: Partial<UserProfile>): Promise<void> {
        const response = await apiClient.put<{ ok: boolean; message?: string }>(`/admin/users/${uid}`, payload);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to replace user.');
        }
    },

    async deleteUser(uid: string): Promise<void> {
        const response = await apiClient.delete<{ ok: boolean; message?: string }>(`/admin/users/${uid}`);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to delete user.');
        }
    },

    async updateUserRole(uid: string, role: UserRole): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/admin/users/${uid}/role`, { role });
        if (!response.ok) {
            throw new Error(response.message || 'Failed to update user role.');
        }
    },

    async getPlans(includeInactive = true): Promise<SubscriptionPlan[]> {
        const endpoint = includeInactive
            ? '/admin/plans?includeInactive=true'
            : '/subscription/plans?includeInactive=false';
        const response = await apiClient.get<{ ok: boolean; plans?: SubscriptionPlan[]; message?: string }>(endpoint);
        if (!response.ok || !response.plans) {
            throw new Error(response.message || 'Failed to fetch plans.');
        }
        return response.plans.sort((a, b) => a.displayOrder - b.displayOrder);
    },

    async upsertPlan(plan: SubscriptionPlan): Promise<void> {
        const response = await apiClient.put<{ ok: boolean; message?: string }>(`/admin/plans/${plan.id}`, plan);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to save plan.');
        }
    },

    async createPlan(plan: SubscriptionPlan): Promise<void> {
        const response = await apiClient.post<{ ok: boolean; message?: string }>('/admin/plans', plan);
        if (!response.ok) throw new Error(response.message || 'Failed to create plan.');
    },

    async patchPlan(planId: string, payload: Partial<SubscriptionPlan>): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/admin/plans/${planId}`, payload);
        if (!response.ok) throw new Error(response.message || 'Failed to update plan.');
    },

    async deletePlan(planId: string): Promise<void> {
        const response = await apiClient.delete<{ ok: boolean; message?: string }>(`/admin/plans/${planId}`);
        if (!response.ok) throw new Error(response.message || 'Failed to delete plan.');
    },

    async getOffers(includeInactive = true): Promise<MarketingOffer[]> {
        const endpoint = includeInactive
            ? '/admin/offers?includeInactive=true'
            : '/subscription/offers/active';
        const response = await apiClient.get<{ ok: boolean; offers?: MarketingOffer[]; message?: string }>(endpoint);
        if (!response.ok || !response.offers) {
            throw new Error(response.message || 'Failed to fetch offers.');
        }
        return response.offers.sort((a, b) => b.priority - a.priority);
    },

    async upsertOffer(offer: MarketingOffer): Promise<void> {
        const response = await apiClient.put<{ ok: boolean; message?: string }>(`/admin/offers/${offer.id}`, offer);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to save offer.');
        }
    },

    async createOffer(offer: MarketingOffer): Promise<void> {
        const response = await apiClient.post<{ ok: boolean; message?: string }>('/admin/offers', offer);
        if (!response.ok) throw new Error(response.message || 'Failed to create offer.');
    },

    async patchOffer(offerId: string, payload: Partial<MarketingOffer>): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/admin/offers/${offerId}`, payload);
        if (!response.ok) throw new Error(response.message || 'Failed to update offer.');
    },

    async deleteOffer(offerId: string): Promise<void> {
        const response = await apiClient.delete<{ ok: boolean; message?: string }>(`/admin/offers/${offerId}`);
        if (!response.ok) throw new Error(response.message || 'Failed to delete offer.');
    },

    async setOfferActive(offerId: string, isActive: boolean): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/admin/offers/${offerId}/active`, { isActive });
        if (!response.ok) {
            throw new Error(response.message || 'Failed to update offer state.');
        }
    },
};
