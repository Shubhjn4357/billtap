import type { MarketingOffer, SubscriptionPlan } from '../types';
import { apiClient } from './httpClient';

export const subscriptionService = {
    async getPlans(): Promise<{ plans: SubscriptionPlan[] }> {
        const response = await apiClient.get<{
            ok: boolean;
            plans?: SubscriptionPlan[];
            message?: string;
        }>('/subscription/plans?includeInactive=false');
        if (!response.ok) {
            throw new Error(response.message || 'Failed to fetch plans.');
        }
        return {
            plans: response.plans ?? [],
        };
    },

    async createCheckoutSession(plan: SubscriptionPlan) {
        const response = await apiClient.post<{
            ok: boolean;
            intentId?: string;
            checkoutUrl?: string;
            provider?: string;
            providerOrderId?: string;
            razorpayKeyId?: string;
            message?: string;
        }>('/subscription/checkout', {
            planId: plan.id,
            planName: plan.name,
            amount: plan.monthlyPrice,
            currency: plan.currency
        });
        if (!response.ok) {
            throw new Error(response.message || 'Failed to create checkout session.');
        }
        return response;
    },

    async getActiveOffers(): Promise<MarketingOffer[]> {
        const response = await apiClient.get<{
            ok: boolean;
            offers?: MarketingOffer[];
            message?: string;
        }>('/subscription/offers/active');
        if (!response.ok) {
            throw new Error(response.message || 'Failed to fetch offers.');
        }
        return (response.offers ?? []).sort((a, b) => b.priority - a.priority);
    },
};
