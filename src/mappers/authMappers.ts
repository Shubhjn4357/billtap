import { SUBSCRIPTION_TIERS, getStatusScopedFeatureFlags } from '../constants/subscription';
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

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

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
  const rawTier = readString(
    profile.subscriptionPlanId ?? profile.subscriptionPlanName,
  );
  if (!rawTier) return null;

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

  const normalizedTier = rawTier.trim().toUpperCase();
  const tier: Subscription['tier'] =
    normalizedTier in SUBSCRIPTION_TIERS
      ? (normalizedTier as Subscription['tier'])
      : 'FREE';
  const tierConfig = SUBSCRIPTION_TIERS[tier];
  const cloudSyncAllowed =
    (status === 'ACTIVE' || status === 'TRIAL') && tierConfig.cloudSyncAllowed;
  const webDashboardAllowed =
    (status === 'ACTIVE' || status === 'TRIAL') && tierConfig.webDashboardAllowed;
  const featureFlagsEnabled = getStatusScopedFeatureFlags(
    status,
    tierConfig.enabledFeatures,
  ) as Subscription['featureFlagsEnabled'];

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
    offlineOnly: !cloudSyncAllowed,
    cloudSyncAllowed,
    webDashboardAllowed,
    featureFlagsEnabled,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const mapApiSubscription = (
  payload: LegacyProfilePayload,
  fallbackBusinessId?: string | null,
): Subscription | null => {
  const tier = readString(payload.tier);
  if (!tier) return null;

  const rawStatus = readStringOrDefault(payload.status, 'TRIAL').toUpperCase();
  const status: Subscription['status'] =
    rawStatus === 'ACTIVE'
      ? 'ACTIVE'
      : rawStatus === 'GRACE'
        ? 'GRACE'
        : rawStatus === 'EXPIRED'
          ? 'EXPIRED'
          : rawStatus === 'CANCELLED'
            ? 'CANCELLED'
            : 'TRIAL';

  const featureFlagsEnabled = readStringArray(payload.featureFlagsEnabled) as Subscription['featureFlagsEnabled'];

  return {
    id: readStringOrDefault(payload.id, `sub_${fallbackBusinessId ?? 'current'}`),
    businessId: readStringOrDefault(payload.businessId, fallbackBusinessId ?? 'current'),
    tier: tier as Subscription['tier'],
    billingCycle:
      (readString(payload.billingCycle)?.toUpperCase() as Subscription['billingCycle']) ??
      null,
    status,
    startDate: readString(payload.startDate),
    endDate: readString(payload.endDate),
    nextRenewalDate: readString(payload.nextRenewalDate),
    renewsAt: readString(payload.renewsAt ?? payload.nextRenewalDate),
    graceEndDate: readString(payload.graceEndDate),
    maxBillsTotal: readNumber(payload.maxBillsTotal),
    maxBillsPerMonth: readNumber(payload.maxBillsPerMonth),
    maxStaffUsers: readNumber(payload.maxStaffUsers),
    maxBusinesses: readNumber(payload.maxBusinesses),
    maxDevices: readNumber(payload.maxDevices),
    maxStorageMb: readNumber(payload.maxStorageMb),
    monthlyInvoiceCount: readNumber(payload.monthlyInvoiceCount) ?? 0,
    offlineOnly: readBoolean(payload.offlineOnly, false),
    cloudSyncAllowed: readBoolean(payload.cloudSyncAllowed, true),
    webDashboardAllowed: readBoolean(payload.webDashboardAllowed, true),
    featureFlagsEnabled,
    createdAt: readStringOrDefault(payload.createdAt, isoNow()),
    updatedAt: readStringOrDefault(payload.updatedAt, isoNow()),
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
