/* eslint-disable @typescript-eslint/no-redeclare */
export const SubscriptionTier = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  GROWTH: 'GROWTH',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type SubscriptionTier =
  (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export const BillingCycle = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
  THREE_YEAR: 'THREE_YEAR',
} as const;
export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  TRIAL: 'TRIAL',
  CANCELLED: 'CANCELLED',
  GRACE: 'GRACE',
} as const;
export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const FeatureFlag = {
  OFFLINE_BILLING: 'OFFLINE_BILLING',
  GST_INVOICES: 'GST_INVOICES',
  PURCHASE_MODULE: 'PURCHASE_MODULE',
  STOCK_MODULE: 'STOCK_MODULE',
  PARTY_MANAGEMENT: 'PARTY_MANAGEMENT',
  GST_REPORTS: 'GST_REPORTS',
  ADVANCED_REPORTS: 'ADVANCED_REPORTS',
  E_INVOICE: 'E_INVOICE',
  E_WAY_BILL: 'E_WAY_BILL',
  MULTI_BUSINESS: 'MULTI_BUSINESS',
  STAFF_USERS: 'STAFF_USERS',
  CLOUD_SYNC: 'CLOUD_SYNC',
  MULTI_DEVICE: 'MULTI_DEVICE',
  BACKUP_CLOUD: 'BACKUP_CLOUD',
  EXPORT_PDF: 'EXPORT_PDF',
  EXPORT_EXCEL: 'EXPORT_EXCEL',
  ACCESS_WEB_DASHBOARD: 'ACCESS_WEB_DASHBOARD',
  API_ACCESS: 'API_ACCESS',
  BATCH_EXPIRY: 'BATCH_EXPIRY',
  MULTI_GODOWN: 'MULTI_GODOWN',
  POS_MODE: 'POS_MODE',
  LOYALTY_POINTS: 'LOYALTY_POINTS',
  SMS_NOTIFICATIONS: 'SMS_NOTIFICATIONS',
  WHATSAPP_NOTIFICATIONS: 'WHATSAPP_NOTIFICATIONS',
} as const;
export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

export const PartyType = {
  CUSTOMER: 'CUSTOMER',
  SUPPLIER: 'SUPPLIER',
} as const;
export type PartyType = (typeof PartyType)[keyof typeof PartyType];

export const InvoiceType = {
  TAX_INVOICE: 'TAX_INVOICE',
  BILL_OF_SUPPLY: 'BILL_OF_SUPPLY',
  ESTIMATE: 'ESTIMATE',
  PROFORMA: 'PROFORMA',
  CREDIT_NOTE_DOC: 'CREDIT_NOTE_DOC',
  DEBIT_NOTE_DOC: 'DEBIT_NOTE_DOC',
  DELIVERY_CHALLAN_DOC: 'DELIVERY_CHALLAN_DOC',
  POS_BILL: 'POS_BILL',
} as const;
export type InvoiceType = (typeof InvoiceType)[keyof typeof InvoiceType];

export const VoucherType = {
  SALES_INVOICE: 'SALES_INVOICE',
  POS_SALE: 'POS_SALE',
  PURCHASE_BILL: 'PURCHASE_BILL',
  PAYMENT_IN: 'PAYMENT_IN',
  PAYMENT_OUT: 'PAYMENT_OUT',
  CREDIT_NOTE: 'CREDIT_NOTE',
  DEBIT_NOTE: 'DEBIT_NOTE',
  ESTIMATE: 'ESTIMATE',
  PROFORMA_INVOICE: 'PROFORMA_INVOICE',
  SALE_ORDER: 'SALE_ORDER',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  DELIVERY_CHALLAN: 'DELIVERY_CHALLAN',
  GOODS_RETURN_DC: 'GOODS_RETURN_DC',
  OTHER_INCOME_VOUCHER: 'OTHER_INCOME_VOUCHER',
  FIXED_ASSET_VOUCHER: 'FIXED_ASSET_VOUCHER',
  CONTRA: 'CONTRA',
  JOURNAL: 'JOURNAL',
} as const;
export type VoucherType = (typeof VoucherType)[keyof typeof VoucherType];

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const SettingsSection = {
  GENERAL: 'GENERAL',
  ITEM_SETTINGS: 'ITEM_SETTINGS',
  PARTY_SETTINGS: 'PARTY_SETTINGS',
  TAXES_AND_GST: 'TAXES_AND_GST',
  PAYMENT_REMINDERS: 'PAYMENT_REMINDERS',
  TRANSACTION_SMS: 'TRANSACTION_SMS',
  TRANSACTION_HEADER: 'TRANSACTION_HEADER',
  ITEM_TABLE: 'ITEM_TABLE',
  TAX_DISCOUNT_TOTAL: 'TAX_DISCOUNT_TOTAL',
  MORE_TRANSACTION_FEATURES: 'MORE_TRANSACTION_FEATURES',
  INVOICE_PRINT: 'INVOICE_PRINT',
  BACKUP_SETTINGS: 'BACKUP_SETTINGS',
  MULTI_FIRM: 'MULTI_FIRM',
  GODOWN_AND_STOCK_TRANSFER: 'GODOWN_AND_STOCK_TRANSFER',
  SECURITY: 'SECURITY',
} as const;
export type SettingsSection =
  (typeof SettingsSection)[keyof typeof SettingsSection];

export const ExpenseCategory = {
  MANUFACTURING: 'MANUFACTURING',
  PETROL: 'PETROL',
  RENT: 'RENT',
  SALARY: 'SALARY',
  TEA_AND_REFRESHMENTS: 'TEA_AND_REFRESHMENTS',
  TRANSPORT: 'TRANSPORT',
  MISCELLANEOUS: 'MISCELLANEOUS',
} as const;
export type ExpenseCategory =
  (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const PaymentMode = {
  CASH: 'CASH',
  BANK: 'BANK',
  UPI: 'UPI',
  CHEQUE: 'CHEQUE',
  CARD: 'CARD',
} as const;
export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

export const AmountRoundingMode = {
  NEAREST: 'NEAREST',
  UP: 'UP',
  DOWN: 'DOWN',
} as const;
export type AmountRoundingMode =
  (typeof AmountRoundingMode)[keyof typeof AmountRoundingMode];

export const ShareTransactionMode = {
  ASK_EVERY_TIME: 'ASK_EVERY_TIME',
  PDF: 'PDF',
  IMAGE: 'IMAGE',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
} as const;
export type ShareTransactionMode =
  (typeof ShareTransactionMode)[keyof typeof ShareTransactionMode];

export const LoanType = { BORROWED: 'BORROWED', GIVEN: 'GIVEN' } as const;
export type LoanType = (typeof LoanType)[keyof typeof LoanType];

export const DevicePlatform = {
  ANDROID: 'ANDROID',
  IOS: 'IOS',
  WEB: 'WEB',
} as const;
export type DevicePlatform =
  (typeof DevicePlatform)[keyof typeof DevicePlatform];
