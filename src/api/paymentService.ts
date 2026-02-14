import type { PaymentIntent, SubscriptionPlan } from '../types';
import { apiClient } from './httpClient';

interface CheckoutSessionResponse {
    ok: boolean;
    intentId?: string;
    checkoutUrl?: string;
    provider?: 'stripe' | 'razorpay' | 'mock';
    message?: string;
}

export const paymentService = {
    async createSubscriptionCheckout(plan: SubscriptionPlan): Promise<CheckoutSessionResponse> {
        const response = await apiClient.post<CheckoutSessionResponse>('/payments/subscription-checkout', {
            planId: plan.id,
            planName: plan.name,
            amount: plan.monthlyPrice,
            currency: plan.currency,
        });

        if (!response.ok) {
            return {
                ok: false,
                message: response.message || 'Failed to create checkout session.',
            };
        }

        return {
            ok: true,
            intentId: response.intentId,
            checkoutUrl: response.checkoutUrl,
            provider: response.provider,
            message: response.message,
        };
    },

    async getPaymentIntentStatus(intentId: string): Promise<PaymentIntent['status'] | null> {
        if (!intentId) return null;

        try {
            const response = await apiClient.get<{
                ok: boolean;
                status?: PaymentIntent['status'];
            }>(`/payments/intents/${encodeURIComponent(intentId)}/status`);

            if (!response.ok) return null;
            return response.status ?? null;
        } catch {
            return null;
        }
    },
};
