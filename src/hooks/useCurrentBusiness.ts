/**
 * useCurrentBusiness — typed, narrowed business/user/subscription context hook.
 *
 * Provides ready-to-use derived values (tier, isFree, isOwner, displayName)
 * so components don't need to compute them from raw Zustand state.
 */

import { useAuthStore } from '../store/authStore';
import type { User, Business, Subscription } from '../types/domain';
import { SubscriptionTier } from '../constants/enums';

export interface CurrentBusiness {
    user: User | null;
    business: Business | null;
    subscription: Subscription | null;
    role: 'owner' | 'manager' | 'salesman' | 'staff';
    /** Subscription tier string, defaults to FREE */
    tier: SubscriptionTier;
    /** True if tier is FREE or subscription is null */
    isFree: boolean;
    /** True if role is owner */
    isOwner: boolean;
    /** Display name — business name or user name fallback */
    displayName: string;
    /** Short formatted tier label for UI badges */
    tierLabel: string;
    /** Refresh user profile and subscription from server */
    refresh: () => Promise<void>;
}

export function useCurrentBusiness(): CurrentBusiness {
    const user = useAuthStore((s) => s.user);
    const business = useAuthStore((s) => s.business);
    const subscription = useAuthStore((s) => s.subscription);
    const role = useAuthStore((s) => s.organizationRole);
    const refresh = useAuthStore((s) => s.refreshUser);

    const tier = (subscription?.tier ?? SubscriptionTier.FREE) as SubscriptionTier;
    const isFree = !subscription || tier === SubscriptionTier.FREE;

    const tierLabel =
        tier === SubscriptionTier.FREE
            ? 'Free'
            : tier === SubscriptionTier.STARTER
                ? 'Starter'
                : tier === SubscriptionTier.GROWTH
                    ? 'Growth'
                    : tier === SubscriptionTier.ENTERPRISE
                        ? 'Enterprise'
                        : tier;

    return {
        user,
        business,
        subscription,
        role,
        tier,
        isFree,
        isOwner: role === 'owner',
        displayName: business?.name ?? user?.name ?? 'My Business',
        tierLabel,
        refresh,
    };
}
