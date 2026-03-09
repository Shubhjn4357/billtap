import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { subscriptionRepository } from '../repositories/subscriptionRepository';
import { subscriptionQueryKeys } from '../state/domainQueryKeys';
import { useAuthStore } from '../store/authStore';
import type { Subscription } from '../types/domain';
import type { BillingCycleTab, MockCheckoutOutcome } from '../constants/subscriptionOptions';

type PlanLike = {
    id: string;
    tier?: string;
    billingCycle?: BillingCycleTab | null;
};

type StartCheckoutInput = {
    plan: PlanLike;
    canCheckout: boolean;
    livePaymentsEnabled: boolean;
    mockOutcome: MockCheckoutOutcome;
    discountCode?: string;
};

type CheckoutResult = {
    intentId: string;
    status: MockCheckoutOutcome;
    plan: PlanLike;
};

const computeRenewalDate = (billingCycle: PlanLike['billingCycle']) => {
    const next = new Date();
    if (billingCycle === 'YEARLY') {
        next.setFullYear(next.getFullYear() + 1);
    } else if (billingCycle === 'THREE_YEAR') {
        next.setFullYear(next.getFullYear() + 3);
    } else {
        next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString();
};

export function useSubscriptionMutations() {
    const queryClient = useQueryClient();
    const subscription = useAuthStore((state) => state.subscription);
    const business = useAuthStore((state) => state.business);
    const setSubscription = useAuthStore((state) => state.setSubscription);

    const validateDiscountMutation = useMutation({
        mutationFn: async (payload: { code: string; planId?: string }) =>
            subscriptionRepository.validateDiscount(payload),
    });

    const checkoutMutation = useMutation({
        mutationFn: async (input: StartCheckoutInput): Promise<CheckoutResult> => {
            if (!input.canCheckout) {
                throw new Error('Your role cannot start subscription checkout.');
            }

            if (!input.livePaymentsEnabled) {
                const intentId = `mock_${Date.now()}`;
                await new Promise((resolve) => setTimeout(resolve, 400));
                return { intentId, status: input.mockOutcome, plan: input.plan };
            }

            const response = await subscriptionRepository.createCheckoutSession({
                planId: input.plan.id,
                discountCode: input.discountCode?.trim() || undefined,
            });
            const data = response.data;
            if (!data?.checkoutUrl || !data.intentId) {
                throw new Error('Checkout URL is unavailable for this plan.');
            }

            await WebBrowser.openBrowserAsync(data.checkoutUrl);

            let status: MockCheckoutOutcome = 'pending';
            try {
                const statusRes = await subscriptionRepository.getIntentStatus(data.intentId);
                const nextStatus = statusRes.data?.status ?? 'pending';
                status = nextStatus === 'canceled' ? 'failed' : nextStatus;
            } catch {
                status = 'pending';
            }

            return { intentId: data.intentId, status, plan: input.plan };
        },
        onSuccess: async (result, input) => {
            if (!input.livePaymentsEnabled && result.status === 'succeeded') {
                const nowIso = new Date().toISOString();
                const renewalIso = computeRenewalDate(result.plan.billingCycle);
                const nextTier = result.plan.tier ?? subscription?.tier ?? 'FREE';
                const nextCycle = result.plan.billingCycle ?? subscription?.billingCycle ?? 'MONTHLY';

                const nextSubscription: Subscription = {
                    id: subscription?.id ?? `sub_mock_${Date.now()}`,
                    businessId: subscription?.businessId ?? business?.id ?? 'local',
                    tier: nextTier as Subscription['tier'],
                    billingCycle: nextCycle as Subscription['billingCycle'],
                    status: 'ACTIVE',
                    startDate: subscription?.startDate ?? nowIso,
                    endDate: renewalIso,
                    nextRenewalDate: renewalIso,
                    renewsAt: renewalIso,
                    graceEndDate: subscription?.graceEndDate ?? null,
                    maxBillsTotal: subscription?.maxBillsTotal ?? null,
                    maxBillsPerMonth: subscription?.maxBillsPerMonth ?? null,
                    maxStaffUsers: subscription?.maxStaffUsers ?? null,
                    maxBusinesses: subscription?.maxBusinesses ?? null,
                    maxDevices: subscription?.maxDevices ?? null,
                    maxStorageMb: subscription?.maxStorageMb ?? null,
                    monthlyInvoiceCount: subscription?.monthlyInvoiceCount ?? 0,
                    offlineOnly: subscription?.offlineOnly ?? false,
                    cloudSyncAllowed: subscription?.cloudSyncAllowed ?? true,
                    webDashboardAllowed: subscription?.webDashboardAllowed ?? true,
                    featureFlagsEnabled: subscription?.featureFlagsEnabled ?? [],
                    createdAt: subscription?.createdAt ?? nowIso,
                    updatedAt: nowIso,
                };

                setSubscription(nextSubscription);
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.all() }),
            ]);
        },
    });

    return {
        validateDiscount: validateDiscountMutation.mutateAsync,
        isValidatingDiscount: validateDiscountMutation.isPending,
        startCheckout: checkoutMutation.mutateAsync,
        isStartingCheckout: checkoutMutation.isPending,
    };
}
