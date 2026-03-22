import type { AuthResponse } from '../types/api';
import type { Business, Subscription, User } from '../types/domain';

export type OrganizationRole = 'owner' | 'manager' | 'salesman' | 'staff';
export type LegacyProfilePayload = Record<string, unknown>;
export type LegacyOrganizationPayload = Record<string, unknown>;
export type AuthSnapshotPayload = {
  user: User | null;
  business: Business | null;
  subscription: Subscription | null;
  organizationRole: OrganizationRole;
};

const isoNow = () => new Date().toISOString();

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const readStringOrDefault = (value: unknown, fallback: string): string =>
  readString(value) ?? fallback;

const readBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const readNumber = (value: unknown): number | null => {
  const numeric =
    typeof value === 'number' ? value : Number(value ?? Number.NaN);
  return Number.isFinite(numeric) ? numeric : null;
};

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const normalizeOrganizationRole = (value: unknown): OrganizationRole => {
  const role = readString(value)?.toLowerCase();
  if (
    role === 'owner' ||
    role === 'manager' ||
    role === 'salesman' ||
    role === 'staff'
  ) {
    return role;
  }
  return 'owner';
};

export const mapLegacyProfileToUser = (profile: LegacyProfilePayload): User => {
  const timestamp = isoNow();
  const id = readStringOrDefault(
    profile.uid ?? profile.id,
    `usr_local_${Date.now()}`,
  );
  const email = readStringOrDefault(profile.email, 'unknown@vahi.app');
  const name = readStringOrDefault(
    profile.displayName ?? profile.name,
    email.split('@')[0] ?? 'Vahi User',
  );

  return {
    id,
    googleSub: readStringOrDefault(profile.googleSub, id),
    name,
    email,
    phone: readString(profile.phoneNumber ?? profile.phone),
    photoUrl: readString(profile.photoURL ?? profile.photoUrl),
    isDisabled: readBoolean(profile.isDisabled, false),
    createdAt: readStringOrDefault(profile.createdAt, timestamp),
    updatedAt: readStringOrDefault(profile.updatedAt, timestamp),
  };
};

export const mapLegacyOrganizationToBusiness = (
  organization: LegacyOrganizationPayload,
  fallbackOwnerId: string,
): Business => {
  const timestamp = isoNow();
  const id = readStringOrDefault(organization.id, `biz_local_${Date.now()}`);

  return {
    id,
    ownerUserId: readStringOrDefault(organization.userId, fallbackOwnerId),
    name: readStringOrDefault(organization.name, 'My Business'),
    legalName: readString(organization.legalName),
    address: readString(organization.address),
    state: readString(organization.state),
    city: readString(organization.city),
    pincode: readString(organization.pincode),
    gstin: readString(organization.gstNumber ?? organization.gstin),
    pan: readString(organization.pan),
    booksStartDate: readString(organization.booksStartDate),
    openingCashInHand: readNumber(organization.openingCashInHand),
    openingCashInBank: readNumber(organization.openingCashInBank),
    logoUrl: readString(organization.logoUrl),
    phone: readString(organization.phoneNumber ?? organization.phone),
    email: readString(organization.email),
    currency: readStringOrDefault(organization.currency, 'INR'),
    category: readString(organization.category),
    code: readString(organization.code),
    isActive:
      typeof organization.isActive === 'boolean' ? organization.isActive : true,
    settings: readRecord(organization.settings),
    createdAt: readStringOrDefault(organization.createdAt, timestamp),
    updatedAt: readStringOrDefault(organization.updatedAt, timestamp),
  };
};

export const mapLegacyProfileToSubscription = (
  profile: LegacyProfilePayload,
  businessId?: string | null,
): Subscription | null => {
  const tier = readString(
    profile.subscriptionPlanId ?? profile.subscriptionPlanName,
  );
  if (!tier) return null;

  const rawStatus = readStringOrDefault(
    profile.subscriptionStatus,
    'inactive',
  ).toLowerCase();
  const status: Subscription['status'] =
    rawStatus === 'active'
      ? 'ACTIVE'
      : rawStatus === 'past_due'
        ? 'GRACE'
        : rawStatus === 'expired'
          ? 'EXPIRED'
          : rawStatus === 'canceled'
            ? 'CANCELLED'
            : 'TRIAL';

  const timestamp = isoNow();
  const resolvedBusinessId = businessId ?? 'local';

  return {
    id: `sub_${resolvedBusinessId}`,
    businessId: resolvedBusinessId,
    tier: tier as Subscription['tier'],
    billingCycle: null,
    status,
    startDate: readString(profile.subscriptionStartsAt),
    endDate: readString(profile.subscriptionEndsAt),
    nextRenewalDate: null,
    renewsAt: null,
    graceEndDate: null,
    maxBillsTotal: null,
    maxBillsPerMonth: null,
    maxStaffUsers: null,
    maxBusinesses: null,
    maxDevices: null,
    maxStorageMb: null,
    monthlyInvoiceCount: 0,
    offlineOnly: false,
    cloudSyncAllowed: true,
    webDashboardAllowed: true,
    featureFlagsEnabled: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const mapAuthResponseToSnapshot = (
  response: AuthResponse,
): AuthSnapshotPayload => {
  const user = response.user
    ? mapLegacyProfileToUser(response.user as unknown as LegacyProfilePayload)
    : null;
  const business = response.business
    ? {
        ...mapLegacyOrganizationToBusiness(
          response.business as unknown as LegacyOrganizationPayload,
          response.user?.id ?? 'owner',
        ),
        name: response.business.name,
      }
    : null;

  const baseSubscription = response.subscription?.tier
    ? mapLegacyProfileToSubscription(
        {
          subscriptionPlanId: response.subscription.tier,
          subscriptionStatus: response.subscription.status,
        },
        business?.id ?? null,
      )
    : null;
  const subscription = baseSubscription
    ? {
        ...baseSubscription,
        tier: response.subscription!.tier as Subscription['tier'],
        status:
          (response.subscription!.status as Subscription['status']) ?? 'TRIAL',
      }
    : null;

  return {
    user,
    business,
    subscription,
    organizationRole: normalizeOrganizationRole(
      (response.user as Record<string, unknown> | undefined)?.role,
    ),
  };
};
