import { pgEnum } from 'drizzle-orm/pg-core';

export const subscriptionTierEnum = pgEnum('subscription_tier', [
    'FREE',
    'STARTER',
    'GROWTH',
    'ENTERPRISE',
]);

export const billingCycleEnum = pgEnum('billing_cycle', [
    'MONTHLY',
    'YEARLY',
    'THREE_YEAR',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
    'ACTIVE',
    'EXPIRED',
    'TRIAL',
    'CANCELLED',
    'GRACE',
]);

export const featureFlagEnum = pgEnum('feature_flag', [
    'OFFLINE_BILLING',
    'GST_INVOICES',
    'PURCHASE_MODULE',
    'STOCK_MODULE',
    'PARTY_MANAGEMENT',
    'GST_REPORTS',
    'ADVANCED_REPORTS',
    'E_INVOICE',
    'E_WAY_BILL',
    'MULTI_BUSINESS',
    'STAFF_USERS',
    'CLOUD_SYNC',
    'MULTI_DEVICE',
    'BACKUP_CLOUD',
    'EXPORT_PDF',
    'EXPORT_EXCEL',
    'ACCESS_WEB_DASHBOARD',
    'API_ACCESS',
    'BATCH_EXPIRY',
    'MULTI_GODOWN',
    'POS_MODE',
    'LOYALTY_POINTS',
]);

export const accountTypeEnum = pgEnum('account_type', [
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'INCOME',
    'EXPENSE',
]);

export const voucherTypeEnum = pgEnum('voucher_type', [
    'SALES_INVOICE',
    'POS_SALE',
    'PURCHASE_BILL',
    'PAYMENT_IN',
    'PAYMENT_OUT',
    'CREDIT_NOTE',
    'DEBIT_NOTE',
    'ESTIMATE',
    'PROFORMA_INVOICE',
    'SALE_ORDER',
    'PURCHASE_ORDER',
    'DELIVERY_CHALLAN',
    'GOODS_RETURN_DC',
    'OTHER_INCOME_VOUCHER',
    'FIXED_ASSET_VOUCHER',
    'CONTRA',
    'JOURNAL',
]);

export const partyTypeEnum = pgEnum('party_type', ['CUSTOMER', 'SUPPLIER']);

export const invoiceTypeEnum = pgEnum('invoice_type', [
    'TAX_INVOICE',
    'BILL_OF_SUPPLY',
    'ESTIMATE',
    'PROFORMA',
    'CREDIT_NOTE_DOC',
    'DEBIT_NOTE_DOC',
    'DELIVERY_CHALLAN_DOC',
    'POS_BILL',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
    'UNPAID',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
]);

export const devicePlatformEnum = pgEnum('device_platform', ['ANDROID', 'IOS', 'WEB']);

export const planLimitTypeEnum = pgEnum('plan_limit_type', [
    'MAX_BILLS',
    'MAX_STAFF_USERS',
    'MAX_BUSINESSES',
    'MAX_DEVICES',
    'MAX_STORAGE_MB',
]);

export const discountTypeEnum = pgEnum('discount_type', ['PERCENTAGE', 'FIXED_AMOUNT']);

export const discountScopeEnum = pgEnum('discount_scope', ['PLAN', 'TIER', 'GLOBAL']);

export const notificationChannelEnum = pgEnum('notification_channel', [
    'IN_APP',
    'PUSH',
    'EMAIL',
]);

export const adminRoleEnum = pgEnum('admin_role', [
    'SUPER_ADMIN',
    'SUPPORT_ADMIN',
    'READ_ONLY_ADMIN',
]);

export const memberRoleEnum = pgEnum('member_role', ['OWNER', 'STAFF']);

export const settingsSectionEnum = pgEnum('settings_section', [
    'GENERAL',
    'ITEM_SETTINGS',
    'PARTY_SETTINGS',
    'TAXES_AND_GST',
    'TRANSACTION_HEADER',
    'ITEM_TABLE',
    'TAX_DISCOUNT_TOTAL',
    'MORE_TRANSACTION_FEATURES',
    'INVOICE_PRINT',
    'BACKUP_SETTINGS',
    'MULTI_FIRM',
    'GODOWN_AND_STOCK_TRANSFER',
    'SECURITY',
]);

export const expenseCategoryEnum = pgEnum('expense_category', [
    'MANUFACTURING',
    'PETROL',
    'RENT',
    'SALARY',
    'TEA_AND_REFRESHMENTS',
    'TRANSPORT',
    'MISCELLANEOUS',
]);

export const loanTypeEnum = pgEnum('loan_type', ['BORROWED', 'GIVEN']);
