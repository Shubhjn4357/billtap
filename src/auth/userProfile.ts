import type { UserRow } from '../db/schema';

export const toUserProfile = (row: UserRow) => ({
    uid: row.uid,
    email: row.email,
    phoneNumber: row.phoneNumber,
    displayName: row.displayName,
    photoURL: row.photoURL,
    businessName: row.businessName,
    address: row.address,
    gstEnabled: row.gstEnabled ?? false,
    gstNumber: row.gstNumber,
    currency: row.currency ?? 'INR',
    role: row.role ?? 'owner',
    ownerId: row.ownerId,
    subscriptionStatus: row.subscriptionStatus ?? 'inactive',
    subscriptionPlanId: row.subscriptionPlanId,
    subscriptionPlanName: row.subscriptionPlanName,
    subscriptionAmountMonthly: row.subscriptionAmountMonthly,
    subscriptionCurrency: row.subscriptionCurrency,
    subscriptionStartsAt: row.subscriptionStartsAt,
    subscriptionEndsAt: row.subscriptionEndsAt,
});
