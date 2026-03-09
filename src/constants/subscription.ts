import { FeatureFlag, SubscriptionTier } from './enums';

export interface TierConfig {
  tier: SubscriptionTier;
  displayName: string;
  maxBillsPerMonth: number | null;
  maxStaffUsers: number | null;
  maxBusinesses: number | null;
  maxDevices: number | null;
  maxStorageMb: number | null;
  cloudSyncAllowed: boolean;
  webDashboardAllowed: boolean;
  enabledFeatures: FeatureFlag[];
  billingOptions: {
    cycle: 'MONTHLY' | 'YEARLY' | 'THREE_YEAR';
    priceInr: number;
  }[];
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  FREE: {
    tier: SubscriptionTier.FREE,
    displayName: 'Free Trial',
    maxBillsPerMonth: 50,
    maxStaffUsers: 0,
    maxBusinesses: 1,
    maxDevices: 1,
    maxStorageMb: 50,
    cloudSyncAllowed: false,
    webDashboardAllowed: false,
    billingOptions: [],
    enabledFeatures: [
      FeatureFlag.OFFLINE_BILLING,
      FeatureFlag.GST_INVOICES,
      FeatureFlag.PURCHASE_MODULE,
      FeatureFlag.STOCK_MODULE,
      FeatureFlag.PARTY_MANAGEMENT,
      FeatureFlag.EXPORT_PDF,
    ],
  },
  STARTER: {
    tier: SubscriptionTier.STARTER,
    displayName: 'Starter',
    maxBillsPerMonth: 2000,
    maxStaffUsers: 2,
    maxBusinesses: 1,
    maxDevices: 2,
    maxStorageMb: 2000,
    cloudSyncAllowed: true,
    webDashboardAllowed: false,
    billingOptions: [
      { cycle: 'MONTHLY', priceInr: 299 },
      { cycle: 'YEARLY', priceInr: 2999 },
    ],
    enabledFeatures: [
      FeatureFlag.OFFLINE_BILLING,
      FeatureFlag.GST_INVOICES,
      FeatureFlag.PURCHASE_MODULE,
      FeatureFlag.STOCK_MODULE,
      FeatureFlag.PARTY_MANAGEMENT,
      FeatureFlag.GST_REPORTS,
      FeatureFlag.CLOUD_SYNC,
      FeatureFlag.MULTI_DEVICE,
      FeatureFlag.BACKUP_CLOUD,
      FeatureFlag.EXPORT_PDF,
      FeatureFlag.EXPORT_EXCEL,
    ],
  },
  GROWTH: {
    tier: SubscriptionTier.GROWTH,
    displayName: 'Growth',
    maxBillsPerMonth: 10000,
    maxStaffUsers: 10,
    maxBusinesses: 3,
    maxDevices: 5,
    maxStorageMb: 10000,
    cloudSyncAllowed: true,
    webDashboardAllowed: true,
    billingOptions: [
      { cycle: 'MONTHLY', priceInr: 699 },
      { cycle: 'YEARLY', priceInr: 6999 },
      { cycle: 'THREE_YEAR', priceInr: 17999 },
    ],
    enabledFeatures: [
      FeatureFlag.OFFLINE_BILLING,
      FeatureFlag.GST_INVOICES,
      FeatureFlag.PURCHASE_MODULE,
      FeatureFlag.STOCK_MODULE,
      FeatureFlag.PARTY_MANAGEMENT,
      FeatureFlag.GST_REPORTS,
      FeatureFlag.ADVANCED_REPORTS,
      FeatureFlag.E_INVOICE,
      FeatureFlag.E_WAY_BILL,
      FeatureFlag.MULTI_BUSINESS,
      FeatureFlag.STAFF_USERS,
      FeatureFlag.CLOUD_SYNC,
      FeatureFlag.MULTI_DEVICE,
      FeatureFlag.BACKUP_CLOUD,
      FeatureFlag.EXPORT_PDF,
      FeatureFlag.EXPORT_EXCEL,
      FeatureFlag.ACCESS_WEB_DASHBOARD,
      FeatureFlag.BATCH_EXPIRY,
      FeatureFlag.MULTI_GODOWN,
      FeatureFlag.POS_MODE,
      FeatureFlag.SMS_NOTIFICATIONS,
      FeatureFlag.WHATSAPP_NOTIFICATIONS,
    ],
  },
  ENTERPRISE: {
    tier: SubscriptionTier.ENTERPRISE,
    displayName: 'Enterprise',
    maxBillsPerMonth: null,
    maxStaffUsers: null,
    maxBusinesses: null,
    maxDevices: null,
    maxStorageMb: null,
    cloudSyncAllowed: true,
    webDashboardAllowed: true,
    billingOptions: [
      { cycle: 'YEARLY', priceInr: 24999 },
      { cycle: 'THREE_YEAR', priceInr: 64999 },
    ],
    enabledFeatures: [
      FeatureFlag.OFFLINE_BILLING,
      FeatureFlag.GST_INVOICES,
      FeatureFlag.PURCHASE_MODULE,
      FeatureFlag.STOCK_MODULE,
      FeatureFlag.PARTY_MANAGEMENT,
      FeatureFlag.GST_REPORTS,
      FeatureFlag.ADVANCED_REPORTS,
      FeatureFlag.E_INVOICE,
      FeatureFlag.E_WAY_BILL,
      FeatureFlag.MULTI_BUSINESS,
      FeatureFlag.STAFF_USERS,
      FeatureFlag.CLOUD_SYNC,
      FeatureFlag.MULTI_DEVICE,
      FeatureFlag.BACKUP_CLOUD,
      FeatureFlag.EXPORT_PDF,
      FeatureFlag.EXPORT_EXCEL,
      FeatureFlag.ACCESS_WEB_DASHBOARD,
      FeatureFlag.API_ACCESS,
      FeatureFlag.BATCH_EXPIRY,
      FeatureFlag.MULTI_GODOWN,
      FeatureFlag.POS_MODE,
      FeatureFlag.SMS_NOTIFICATIONS,
      FeatureFlag.WHATSAPP_NOTIFICATIONS,
      FeatureFlag.LOYALTY_POINTS,
    ],
  },
};

export function hasFeature(enabledFlags: string[], flag: FeatureFlag): boolean {
  return enabledFlags.includes(flag);
}

export const GRACE_PERIOD_DAYS = 7;
export const MAX_PREPAID_YEARS = 3;

// Alias with feature string list for subscription screen UI
export const SUBSCRIPTION_CONFIG: Record<
  SubscriptionTier,
  TierConfig & { features: string[] }
> = {
  [SubscriptionTier.FREE]: {
    ...SUBSCRIPTION_TIERS[SubscriptionTier.FREE],
    features: [
      '50 invoices/month',
      'GST billing',
      'Inventory',
      'PDF export',
      '1 device',
      'Offline mode',
    ],
  },
  [SubscriptionTier.STARTER]: {
    ...SUBSCRIPTION_TIERS[SubscriptionTier.STARTER],
    features: [
      '2000 invoices/month',
      'Cloud sync',
      '2 staff users',
      'Excel export',
      'GST reports',
      'Multi-device',
    ],
  },
  [SubscriptionTier.GROWTH]: {
    ...SUBSCRIPTION_TIERS[SubscriptionTier.GROWTH],
    features: [
      '10,000 invoices/month',
      '10 staff users',
      'e-Invoice & e-Way Bill',
      'POS mode',
      'Multi-godown',
      'Advanced reports',
      'Multi-business (3)',
      'WhatsApp SMS',
    ],
  },
  [SubscriptionTier.ENTERPRISE]: {
    ...SUBSCRIPTION_TIERS[SubscriptionTier.ENTERPRISE],
    features: [
      'Unlimited everything',
      'API access',
      'Custom integrations',
      'Priority support',
      'Loyalty points',
      'Unlimited businesses',
    ],
  },
};
