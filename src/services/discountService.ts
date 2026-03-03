import { api } from "@/lib/api";

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type DiscountScope = 'PLAN' | 'TIER' | 'GLOBAL';
export type SubscriptionTier = 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'YEARLY' | 'THREE_YEAR';

export interface Discount {
    id: string;
    code: string;
    type: DiscountType;
    scope: DiscountScope;
    value: number;
    maxRedemptions: number | null;
    perUserLimit: number | null;
    validFrom: string | null;
    validTo: string | null;
    applicableTiers: SubscriptionTier[];
    applicableBillingCycles: BillingCycle[];
    isActive: boolean;
    redemptionCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface DiscountPayload {
    code: string;
    type: DiscountType;
    scope: DiscountScope;
    value: number;
    maxRedemptions?: number | null;
    perUserLimit?: number | null;
    validFrom?: string | null;
    validTo?: string | null;
    applicableTiers?: SubscriptionTier[];
    applicableBillingCycles?: BillingCycle[];
    isActive?: boolean;
}

export const discountService = {
    getAll: async (includeInactive = true) => {
        const response = await api.get<{ ok: boolean; discounts: Discount[] }>(`/admin/discounts?includeInactive=${includeInactive}`);
        return response.data.discounts ?? [];
    },
    getById: async (id: string) => {
        const response = await api.get<{ ok: boolean; discount: Discount }>(`/admin/discounts/${id}`);
        return response.data.discount;
    },
    create: async (payload: DiscountPayload) => {
        const response = await api.post<{ ok: boolean; id: string }>(`/admin/discounts`, payload);
        return response.data;
    },
    update: async (id: string, payload: Partial<DiscountPayload>) => {
        const response = await api.patch<{ ok: boolean }>(`/admin/discounts/${id}`, payload);
        return response.data;
    },
    deactivate: async (id: string) => {
        const response = await api.delete<{ ok: boolean }>(`/admin/discounts/${id}`);
        return response.data;
    },
};
