import { auth } from './firebaseConfig';
import type { PaymentIntent, SubscriptionPlan } from '../types';

interface CheckoutSessionResponse {
    ok: boolean;
    intentId?: string;
    checkoutUrl?: string;
    provider?: 'stripe' | 'razorpay' | 'mock';
    message?: string;
}

const PAYMENT_API_BASE_URL = process.env.EXPO_PUBLIC_PAYMENT_API_BASE_URL?.trim() || '';

const getAuthHeader = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const idToken = await currentUser.getIdToken();
    return `Bearer ${idToken}`;
};

export const paymentService = {
    async createSubscriptionCheckout(plan: SubscriptionPlan): Promise<CheckoutSessionResponse> {
        if (!PAYMENT_API_BASE_URL) {
            return {
                ok: false,
                message: 'Payment API is not configured. Set EXPO_PUBLIC_PAYMENT_API_BASE_URL.',
            };
        }

        const authHeader = await getAuthHeader();
        if (!authHeader) {
            return {
                ok: false,
                message: 'You must be logged in to start checkout.',
            };
        }

        const response = await fetch(`${PAYMENT_API_BASE_URL.replace(/\/$/, '')}/createSubscriptionCheckout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader,
            },
            body: JSON.stringify({
                planId: plan.id,
                planName: plan.name,
                amount: plan.monthlyPrice,
                currency: plan.currency,
            }),
        });

        const json = (await response.json()) as CheckoutSessionResponse;
        if (!response.ok) {
            return {
                ok: false,
                message: json.message || 'Failed to create checkout session.',
            };
        }

        return {
            ok: true,
            intentId: json.intentId,
            checkoutUrl: json.checkoutUrl,
            provider: json.provider,
            message: json.message,
        };
    },

    // TODO(payment): When real provider APIs are integrated, implement status polling only for
    // pending intents that do not receive webhook updates within the expected SLA.
    async getPaymentIntentStatus(intentId: string): Promise<PaymentIntent['status'] | null> {
        if (!PAYMENT_API_BASE_URL || !intentId) return null;
        const authHeader = await getAuthHeader();
        if (!authHeader) return null;

        const response = await fetch(
            `${PAYMENT_API_BASE_URL.replace(/\/$/, '')}/paymentIntentStatus?intentId=${encodeURIComponent(intentId)}`,
            {
                method: 'GET',
                headers: {
                    Authorization: authHeader,
                },
            }
        );

        if (!response.ok) return null;
        const json = (await response.json()) as { status?: PaymentIntent['status'] };
        return json.status ?? null;
    },
};
