import type { BusinessRow, SubscriptionRow, UserRow } from '../db/schema';

type LegacySubscriptionStatus = 'inactive' | 'active' | 'expired' | 'canceled' | 'past_due';

const toLegacySubscriptionStatus = (status: SubscriptionRow['status'] | null | undefined): LegacySubscriptionStatus => {
    switch (status) {
        case 'ACTIVE':
        case 'TRIAL':
            return 'active';
        case 'GRACE':
            return 'past_due';
        case 'EXPIRED':
            return 'expired';
        case 'CANCELLED':
            return 'canceled';
        default:
            return 'inactive';
    }
};

export const toUserProfile = (
    user: UserRow,
    business?: BusinessRow | null,
    subscription?: SubscriptionRow | null,
    role: 'owner' | 'staff' | 'admin' = 'owner'
) => ({
    uid: user.id,
    email: user.email,
    phoneNumber: user.phone,
    displayName: user.name,
    photoURL: user.photoUrl,
    businessName: business?.name,
    address: business?.address,
    gstEnabled: Boolean(business?.gstin),
    gstNumber: business?.gstin,
    currency: business?.currency ?? 'INR',
    category: business?.category,
    role,
    ownerId: null,
    subscriptionStatus: toLegacySubscriptionStatus(subscription?.status),
    subscriptionPlanId: subscription?.tier,
    subscriptionPlanName: subscription?.tier,
    subscriptionAmountMonthly: undefined,
    subscriptionCurrency: 'INR',
    subscriptionStartsAt: subscription?.startDate,
    subscriptionEndsAt: subscription?.endDate,
});
