import { apiClient } from './httpClient';
import type { MarketingOffer, SubscriptionPlan, UserProfile, UserRole } from '../types';

export const adminService = {
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

    async updateUserRole(uid: string, role: UserRole): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/admin/users/${uid}/role`, { role });
        if (!response.ok) {
            throw new Error(response.message || 'Failed to update user role.');
        }
    },

    async getPlans(includeInactive = true): Promise<SubscriptionPlan[]> {
        const endpoint = includeInactive ? '/admin/plans?includeInactive=true' : '/plans?includeInactive=false';
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

    async getOffers(includeInactive = true): Promise<MarketingOffer[]> {
        const endpoint = includeInactive ? '/admin/offers?includeInactive=true' : '/offers/active';
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

    async setOfferActive(offerId: string, isActive: boolean): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(`/admin/offers/${offerId}/active`, { isActive });
        if (!response.ok) {
            throw new Error(response.message || 'Failed to update offer state.');
        }
    },
};
