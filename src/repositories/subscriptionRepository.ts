import { api, getStoredBusinessId } from '../api/client';
import { mapLegacyProfileToSubscription } from '../mappers/authMappers';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';
import { getRuntimeSubscription } from '../services/runtimeSession';
import { queryClient } from '../state/queryClient';
import { subscriptionQueryKeys } from '../state/domainQueryKeys';
import type {
    ApiListResponse,
    ApiResponse,
} from '../types/api';
import type {
    Offer,
    Plan,
    Subscription,
} from '../types/domain';

type CheckoutSessionData = {
    intentId: string;
    checkoutUrl: string;
    provider: string;
    amount: number;
    appliedDiscount: { id: string; code: string; type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: number } | null;
};

type IntentStatusData = {
    status: 'pending' | 'succeeded' | 'failed' | 'canceled';
    provider: string;
};

type DiscountValidationData = {
    discount: { id: string; code: string; type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: number } | undefined;
    plan: { id: string; tier: string; billingCycle: string | null; pricePerCycle: number } | null;
};

const SUBSCRIPTION_CACHE_KEYS = {
    current: (businessId: string) => `vahi_subscription_current_v1::${businessId}`,
    plans: 'vahi_subscription_plans_v1',
    offers: 'vahi_subscription_offers_v1',
};

const readCachedJson = async <T>(key: string): Promise<T | null> => {
    const raw = await offlineKeyValueStore.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

const writeCachedJson = async (key: string, value: unknown) => {
    await offlineKeyValueStore.setItem(key, JSON.stringify(value));
};

const mapPlanRecord = (value: Record<string, unknown>): Plan => ({
    id: String(value.id ?? ''),
    tier: String(value.tier ?? 'FREE') as Plan['tier'],
    billingCycle: (value.billingCycle ?? null) as Plan['billingCycle'],
    displayName: String(value.displayName ?? value.name ?? value.tier ?? 'Plan'),
    description: String(value.description ?? ''),
    pricePerCycle: Number(value.pricePerCycle ?? value.monthlyPrice ?? 0) || 0,
    currency: String(value.currency ?? 'INR'),
    isVisible: typeof value.isVisible === 'boolean' ? value.isVisible : Boolean(value.isActive ?? true),
    displayOrder: Number(value.displayOrder ?? 0) || 0,
    enabledFeatures: Array.isArray(value.enabledFeatures)
        ? (value.enabledFeatures.filter((entry): entry is string => typeof entry === 'string') as Plan['enabledFeatures'])
        : Array.isArray(value.features)
            ? (value.features.filter((entry): entry is string => typeof entry === 'string') as Plan['enabledFeatures'])
            : [],
});

const mapOfferRecord = (value: Record<string, unknown>): Offer => ({
    id: String(value.id ?? ''),
    title: String(value.title ?? ''),
    message: String(value.message ?? ''),
    bannerUrl: typeof value.bannerUrl === 'string' ? value.bannerUrl : null,
    bannerBackground: typeof value.bannerBackground === 'string' ? value.bannerBackground : null,
    ctaText: typeof value.ctaText === 'string' ? value.ctaText : null,
    ctaRoute: typeof value.ctaRoute === 'string' ? value.ctaRoute : null,
    audience: typeof value.audience === 'string' ? value.audience : 'all',
    isActive: typeof value.isActive === 'boolean' ? value.isActive : true,
    priority: Number(value.priority ?? 0) || 0,
    startsAt: typeof value.startsAt === 'string' ? value.startsAt : null,
    endsAt: typeof value.endsAt === 'string' ? value.endsAt : null,
});

export const subscriptionRepository = {
    get: async (): Promise<ApiResponse<Subscription | null>> => {
        const businessId = (await getStoredBusinessId()) ?? 'current';
        try {
            const response = await api.get<{ ok: boolean; user?: Record<string, unknown>; message?: string }>('/api/users/me');
            if (!response.ok || !response.user) {
                throw new Error(response.message ?? 'Failed to load subscription.');
            }
            const subscription = mapLegacyProfileToSubscription(response.user, businessId);
            await writeCachedJson(SUBSCRIPTION_CACHE_KEYS.current(businessId), subscription);
            return {
                ok: true,
                data: subscription,
                message: response.message,
            };
        } catch (error) {
            const authSubscription = getRuntimeSubscription();
            if (authSubscription) {
                return {
                    ok: true,
                    data: authSubscription,
                    message: 'Loaded from local session snapshot.',
                };
            }
            const cached = await readCachedJson<Subscription | null>(SUBSCRIPTION_CACHE_KEYS.current(businessId));
            if (cached !== null) {
                return {
                    ok: true,
                    data: cached,
                    message: 'Loaded from offline cache.',
                };
            }
            throw error;
        }
    },

    getPlans: async (): Promise<ApiListResponse<Plan>> => {
        try {
            const response = await api.get<{ ok: boolean; plans?: Record<string, unknown>[]; message?: string }>('/api/subscription/plans');
            if (!response.ok) {
                throw new Error(response.message ?? 'Failed to load subscription plans.');
            }
            const data = (response.plans ?? []).map(mapPlanRecord);
            await writeCachedJson(SUBSCRIPTION_CACHE_KEYS.plans, data);
            queryClient.setQueryData(subscriptionQueryKeys.plans(), {
                ok: true,
                data,
                message: response.message,
            });
            return {
                ok: true,
                data,
                message: response.message,
            };
        } catch (error) {
            const cached = await readCachedJson<Plan[]>(SUBSCRIPTION_CACHE_KEYS.plans);
            if (cached) {
                return {
                    ok: true,
                    data: cached,
                    message: 'Loaded subscription plans from offline cache.',
                };
            }
            throw error;
        }
    },

    createCheckoutSession: async (data: { planId: string; discountCode?: string }): Promise<ApiResponse<CheckoutSessionData>> => {
        const response = await api.post<{
            ok: boolean;
            intentId?: string;
            checkoutUrl?: string;
            provider?: string;
            amount?: number;
            appliedDiscount?: CheckoutSessionData['appliedDiscount'];
            message?: string;
        }>('/api/subscription/checkout', data);
        if (!response.ok || !response.intentId || !response.checkoutUrl || !response.provider || typeof response.amount !== 'number') {
            throw new Error(response.message ?? 'Failed to start checkout.');
        }
        return {
            ok: true,
            data: {
                intentId: response.intentId,
                checkoutUrl: response.checkoutUrl,
                provider: response.provider,
                amount: response.amount,
                appliedDiscount: response.appliedDiscount ?? null,
            },
            message: response.message,
        };
    },

    getIntentStatus: async (intentId: string): Promise<ApiResponse<IntentStatusData>> => {
        const response = await api.get<{
            ok: boolean;
            status?: IntentStatusData['status'];
            provider?: string;
            message?: string;
        }>(`/api/subscription/intents/${intentId}/status`);
        if (!response.ok || !response.status || !response.provider) {
            throw new Error(response.message ?? 'Failed to fetch checkout status.');
        }
        return {
            ok: true,
            data: {
                status: response.status,
                provider: response.provider,
            },
            message: response.message,
        };
    },

    validateDiscount: async (data: { code: string; planId?: string }): Promise<ApiResponse<DiscountValidationData>> => {
        const response = await api.post<{
            ok: boolean;
            discount?: DiscountValidationData['discount'];
            plan?: DiscountValidationData['plan'];
            message?: string;
        }>('/api/subscription/discounts/validate', data);
        if (!response.ok) {
            throw new Error(response.message ?? 'Failed to validate discount.');
        }
        return {
            ok: true,
            data: {
                discount: response.discount,
                plan: response.plan ?? null,
            },
            message: response.message,
        };
    },

    getActiveOffers: async (): Promise<ApiResponse<Offer[]>> => {
        try {
            const response = await api.get<{ ok: boolean; offers?: Record<string, unknown>[]; message?: string }>('/api/subscription/offers/active');
            if (!response.ok) {
                throw new Error(response.message ?? 'Failed to load active offers.');
            }
            const data = (response.offers ?? []).map(mapOfferRecord);
            await writeCachedJson(SUBSCRIPTION_CACHE_KEYS.offers, data);
            queryClient.setQueryData(subscriptionQueryKeys.offers(), {
                ok: true,
                data,
                message: response.message,
            });
            return {
                ok: true,
                data,
                message: response.message,
            };
        } catch (error) {
            const cached = await readCachedJson<Offer[]>(SUBSCRIPTION_CACHE_KEYS.offers);
            if (cached) {
                return {
                    ok: true,
                    data: cached,
                    message: 'Loaded active offers from offline cache.',
                };
            }
            throw error;
        }
    },

    getOfferList: async (): Promise<ApiListResponse<Offer>> => {
        const response = await subscriptionRepository.getActiveOffers();
        return {
            ok: response.ok,
            data: response.data,
            message: response.message,
        };
    },
};
