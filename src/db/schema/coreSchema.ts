import { sql } from 'drizzle-orm';
import {
    boolean,
    date,
    doublePrecision,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
    accountTypeEnum,
    adminRoleEnum,
    billingCycleEnum,
    devicePlatformEnum,
    discountScopeEnum,
    discountTypeEnum,
    expenseCategoryEnum,
    invoiceTypeEnum,
    loanTypeEnum,
    memberRoleEnum,
    notificationChannelEnum,
    partyTypeEnum,
    paymentStatusEnum,
    settingsSectionEnum,
    subscriptionStatusEnum,
    subscriptionTierEnum,
    voucherTypeEnum,
} from './enums';

const ts = { withTimezone: true, mode: 'date' } as const;
const emptyTextArray = sql`ARRAY[]::text[]`;

const createTimestamps = () => ({
    createdAt: timestamp('created_at', ts).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', ts).defaultNow().notNull(),
});

// ─── Core Users & Auth ────────────────────────────────────────────────────────

export const users = pgTable('users', {
    id: text('id').primaryKey(),
    googleSub: text('google_sub').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    photoUrl: text('photo_url'),
    isDisabled: boolean('is_disabled').default(false).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    ...createTimestamps(),
}, (table) => ({
    googleSubIdx: index('users_google_sub_idx').on(table.googleSub),
    emailIdx: index('users_email_idx').on(table.email),
}));

// ─── Businesses ───────────────────────────────────────────────────────────────

export const businesses = pgTable('businesses', {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id').notNull(),
    name: text('name').notNull(),
    legalName: text('legal_name'),
    address: text('address'),
    state: text('state'),
    gstin: text('gstin'),
    pan: text('pan'),
    booksStartDate: date('books_start_date', { mode: 'date' }),
    logoUrl: text('logo_url'),
    phone: text('phone'),
    email: text('email'),
    currency: text('currency').default('INR').notNull(),
    category: text('category'),
    code: text('code'),
    isActive: boolean('is_active').default(true).notNull(),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    ...createTimestamps(),
}, (table) => ({
    ownerIdx: index('businesses_owner_idx').on(table.ownerUserId),
    activeIdx: index('businesses_active_idx').on(table.isActive),
}));

export const businessMembers = pgTable('business_members', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    userId: text('user_id').notNull(),
    role: memberRoleEnum('role').default('STAFF').notNull(),
    permissions: jsonb('permissions').$type<Record<string, boolean>>().default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    invitedByUserId: text('invited_by_user_id'),
    phoneSnapshot: text('phone_snapshot'),
    joinedAt: timestamp('joined_at', ts).defaultNow().notNull(),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('business_members_business_idx').on(table.businessId),
    userIdx: index('business_members_user_idx').on(table.userId),
}));

// ─── Subscriptions & Plans ────────────────────────────────────────────────────

export const subscriptions = pgTable('subscriptions', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    tier: subscriptionTierEnum('tier').default('FREE').notNull(),
    billingCycle: billingCycleEnum('billing_cycle'),
    status: subscriptionStatusEnum('status').default('TRIAL').notNull(),
    startDate: date('start_date', { mode: 'date' }),
    endDate: date('end_date', { mode: 'date' }),
    nextRenewalDate: date('next_renewal_date', { mode: 'date' }),
    graceEndDate: date('grace_end_date', { mode: 'date' }),
    maxBillsTotal: integer('max_bills_total'),
    maxBillsPerMonth: integer('max_bills_per_month'),
    maxStaffUsers: integer('max_staff_users'),
    maxBusinesses: integer('max_businesses'),
    maxDevices: integer('max_devices'),
    maxStorageMb: integer('max_storage_mb'),
    offlineOnly: boolean('offline_only').default(false).notNull(),
    cloudSyncAllowed: boolean('cloud_sync_allowed').default(false).notNull(),
    webDashboardAllowed: boolean('web_dashboard_allowed').default(false).notNull(),
    featureFlagsEnabled: text('feature_flags_enabled').array().default(emptyTextArray).notNull(),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('subscriptions_business_idx').on(table.businessId),
    statusIdx: index('subscriptions_status_idx').on(table.status),
}));

export const plans = pgTable('plans', {
    id: text('id').primaryKey(),
    tier: subscriptionTierEnum('tier').notNull(),
    billingCycle: billingCycleEnum('billing_cycle'),
    displayName: text('display_name').notNull(),
    description: text('description').notNull(),
    pricePerCycle: doublePrecision('price_per_cycle').notNull(),
    currency: text('currency').default('INR').notNull(),
    effectiveDiscountVsMonthlyPercent: integer('effective_discount_vs_monthly_percent'),
    isVisible: boolean('is_visible').default(true).notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    maxBillsTotal: integer('max_bills_total'),
    maxBillsPerMonth: integer('max_bills_per_month'),
    maxStaffUsers: integer('max_staff_users'),
    maxBusinesses: integer('max_businesses'),
    maxDevices: integer('max_devices'),
    maxStorageMb: integer('max_storage_mb'),
    offlineOnly: boolean('offline_only').default(false).notNull(),
    cloudSyncAllowed: boolean('cloud_sync_allowed').default(false).notNull(),
    webDashboardAllowed: boolean('web_dashboard_allowed').default(false).notNull(),
    enabledFeatures: text('enabled_features').array().default(emptyTextArray).notNull(),
    disabledFeatures: text('disabled_features').array().default(emptyTextArray).notNull(),
    ...createTimestamps(),
}, (table) => ({
    tierIdx: index('plans_tier_idx').on(table.tier),
    visibleIdx: index('plans_visible_idx').on(table.isVisible),
}));

export const discounts = pgTable('discounts', {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    type: discountTypeEnum('type').notNull(),
    scope: discountScopeEnum('scope').notNull(),
    value: doublePrecision('value').notNull(),
    maxRedemptions: integer('max_redemptions'),
    perUserLimit: integer('per_user_limit'),
    validFrom: timestamp('valid_from', ts),
    validTo: timestamp('valid_to', ts),
    applicableTiers: text('applicable_tiers').array().default(emptyTextArray).notNull(),
    applicableBillingCycles: text('applicable_billing_cycles').array().default(emptyTextArray).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdByAdminId: text('created_by_admin_id'),
    redemptionCount: integer('redemption_count').default(0).notNull(),
    ...createTimestamps(),
}, (table) => ({
    codeIdx: index('discounts_code_idx').on(table.code),
    activeIdx: index('discounts_active_idx').on(table.isActive),
}));

// ─── Parties & Items ──────────────────────────────────────────────────────────

export const parties = pgTable('parties', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    type: partyTypeEnum('type').notNull(),
    name: text('name').notNull(),
    nameLowercase: text('name_lowercase').notNull(),
    phone: text('phone'),
    email: text('email'),
    billingAddress: text('billing_address'),
    shippingAddress: text('shipping_address'),
    gstin: text('gstin'),
    openingBalance: doublePrecision('opening_balance').default(0).notNull(),
    creditLimit: doublePrecision('credit_limit').default(0).notNull(),
    loyaltyPoints: integer('loyalty_points').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('parties_business_idx').on(table.businessId),
    nameIdx: index('parties_name_idx').on(table.nameLowercase),
}));

export const items = pgTable('items', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    name: text('name').notNull(),
    nameLowercase: text('name_lowercase').notNull(),
    sku: text('sku'),
    barcode: text('barcode'),
    hsnCode: text('hsn_code'),
    unit: text('unit').default('pcs'),
    category: text('category'),
    mrp: doublePrecision('mrp').default(0),
    purchasePrice: doublePrecision('purchase_price').default(0),
    salePrice: doublePrecision('sale_price').default(0),
    gstRate: doublePrecision('gst_rate').default(0),
    openingStock: doublePrecision('opening_stock').default(0),
    stock: doublePrecision('stock').default(0).notNull(),
    reorderLevel: doublePrecision('reorder_level').default(0),
    description: text('description'),
    location: text('location'),
    imageUrl: text('image_url'),
    expiresAt: timestamp('expires_at', ts),
    autoDeleteAt: timestamp('auto_delete_at', ts),
    autoDeleteEnabled: boolean('auto_delete_enabled').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('items_business_idx').on(table.businessId),
    nameIdx: index('items_name_idx').on(table.nameLowercase),
    barcodeIdx: index('items_barcode_idx').on(table.barcode),
}));

export const inventoryMovements = pgTable('inventory_movements', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    itemId: text('item_id').notNull(),
    movementType: text('movement_type').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    balanceAfter: doublePrecision('balance_after'),
    reason: text('reason'),
    referenceId: text('reference_id'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', ts).defaultNow().notNull(),
}, (table) => ({
    businessIdx: index('inventory_movements_business_idx').on(table.businessId),
    itemIdx: index('inventory_movements_item_idx').on(table.itemId),
    createdIdx: index('inventory_movements_created_idx').on(table.createdAt),
}));

// ─── Accounting ───────────────────────────────────────────────────────────────

export const accounts = pgTable('accounts', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    type: accountTypeEnum('type').notNull(),
    parentAccountId: text('parent_account_id'),
    isDefault: boolean('is_default').default(false).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('accounts_business_idx').on(table.businessId),
    codeIdx: index('accounts_code_idx').on(table.code),
}));

export const vouchers = pgTable('vouchers', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    voucherType: voucherTypeEnum('voucher_type').notNull(),
    date: timestamp('date', ts).defaultNow().notNull(),
    number: text('number').notNull(),
    partyId: text('party_id'),
    totalAmount: doublePrecision('total_amount').default(0).notNull(),
    narration: text('narration'),
    status: text('status').default('POSTED').notNull(),
    createdByUserId: text('created_by_user_id'),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('vouchers_business_idx').on(table.businessId),
    dateIdx: index('vouchers_date_idx').on(table.date),
}));

export const voucherLines = pgTable('voucher_lines', {
    id: text('id').primaryKey(),
    voucherId: text('voucher_id').notNull(),
    accountId: text('account_id').notNull(),
    debit: doublePrecision('debit').default(0).notNull(),
    credit: doublePrecision('credit').default(0).notNull(),
    createdAt: timestamp('created_at', ts).defaultNow().notNull(),
}, (table) => ({
    voucherIdx: index('voucher_lines_voucher_idx').on(table.voucherId),
    accountIdx: index('voucher_lines_account_idx').on(table.accountId),
}));

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoices = pgTable('invoices', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    invoiceType: invoiceTypeEnum('invoice_type').notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    invoiceDate: timestamp('invoice_date', ts).defaultNow().notNull(),
    partyId: text('party_id'),
    placeOfSupply: text('place_of_supply'),
    totalTaxableValue: doublePrecision('total_taxable_value').default(0).notNull(),
    totalTaxAmount: doublePrecision('total_tax_amount').default(0).notNull(),
    totalInvoiceValue: doublePrecision('total_invoice_value').default(0).notNull(),
    discountAmount: doublePrecision('discount_amount').default(0).notNull(),
    roundOffAmount: doublePrecision('round_off_amount').default(0).notNull(),
    additionalCharges: doublePrecision('additional_charges').default(0).notNull(),
    reverseCharge: boolean('reverse_charge').default(false).notNull(),
    gstRateBreakupJson: jsonb('gst_rate_breakup_json').$type<Record<string, unknown>>().default({}).notNull(),
    eInvoiceIrn: text('e_invoice_irn'),
    eInvoiceStatus: text('e_invoice_status'),
    eWayBillNumber: text('e_way_bill_number'),
    paymentStatus: paymentStatusEnum('payment_status').default('UNPAID').notNull(),
    paidAmount: doublePrecision('paid_amount').default(0).notNull(),
    dueDate: timestamp('due_date', ts),
    notes: text('notes'),
    termsAndConditions: text('terms_and_conditions'),
    transportDetails: jsonb('transport_details').$type<Record<string, unknown>>().default({}).notNull(),
    createdByUserId: text('created_by_user_id'),
    // Source reference (e.g., converted from estimate)
    sourceVoucherType: text('source_voucher_type'),
    sourceVoucherId: text('source_voucher_id'),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('invoices_business_idx').on(table.businessId),
    numberIdx: index('invoices_number_idx').on(table.invoiceNumber),
    dateIdx: index('invoices_date_idx').on(table.invoiceDate),
    partyIdx: index('invoices_party_idx').on(table.partyId),
    statusIdx: index('invoices_payment_status_idx').on(table.paymentStatus),
}));

export const invoiceItems = pgTable('invoice_items', {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id').notNull(),
    itemId: text('item_id'),
    description: text('description').notNull(),
    quantity: doublePrecision('quantity').default(0).notNull(),
    unit: text('unit'),
    rate: doublePrecision('rate').default(0).notNull(),
    discountPercent: doublePrecision('discount_percent').default(0).notNull(),
    discountAmount: doublePrecision('discount_amount').default(0).notNull(),
    taxableValue: doublePrecision('taxable_value').default(0).notNull(),
    cgstRate: doublePrecision('cgst_rate').default(0).notNull(),
    cgstAmount: doublePrecision('cgst_amount').default(0).notNull(),
    sgstRate: doublePrecision('sgst_rate').default(0).notNull(),
    sgstAmount: doublePrecision('sgst_amount').default(0).notNull(),
    igstRate: doublePrecision('igst_rate').default(0).notNull(),
    igstAmount: doublePrecision('igst_amount').default(0).notNull(),
    cessRate: doublePrecision('cess_rate').default(0).notNull(),
    cessAmount: doublePrecision('cess_amount').default(0).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', ts).defaultNow().notNull(),
}, (table) => ({
    invoiceIdx: index('invoice_items_invoice_idx').on(table.invoiceId),
    itemIdx: index('invoice_items_item_idx').on(table.itemId),
}));

// ─── Payment Receipts (link payments to invoices) ─────────────────────────────

export const paymentReceipts = pgTable('payment_receipts', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    invoiceId: text('invoice_id').notNull(),
    voucherId: text('voucher_id').notNull(),
    amount: doublePrecision('amount').notNull(),
    paymentMode: text('payment_mode').default('CASH').notNull(),
    paymentDate: timestamp('payment_date', ts).defaultNow().notNull(),
    notes: text('notes'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', ts).defaultNow().notNull(),
}, (table) => ({
    invoiceIdx: index('payment_receipts_invoice_idx').on(table.invoiceId),
    voucherIdx: index('payment_receipts_voucher_idx').on(table.voucherId),
    businessIdx: index('payment_receipts_business_idx').on(table.businessId),
}));

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const expenses = pgTable('expenses', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    category: expenseCategoryEnum('category').notNull(),
    accountId: text('account_id'),
    amount: doublePrecision('amount').notNull(),
    date: timestamp('date', ts).defaultNow().notNull(),
    description: text('description'),
    paymentMode: text('payment_mode').default('CASH').notNull(),
    partyId: text('party_id'),
    voucherId: text('voucher_id'),
    receiptUrl: text('receipt_url'),
    createdByUserId: text('created_by_user_id'),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('expenses_business_idx').on(table.businessId),
    dateIdx: index('expenses_date_idx').on(table.date),
    categoryIdx: index('expenses_category_idx').on(table.category),
}));

// ─── Loans ────────────────────────────────────────────────────────────────────

export const loans = pgTable('loans', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    lenderBorrowerName: text('lender_borrower_name').notNull(),
    loanType: loanTypeEnum('loan_type').notNull(),
    openingDate: date('opening_date', { mode: 'date' }).notNull(),
    openingBalance: doublePrecision('opening_balance').default(0).notNull(),
    currentBalance: doublePrecision('current_balance').default(0).notNull(),
    interestRatePercent: doublePrecision('interest_rate_percent').default(0).notNull(),
    emiAmount: doublePrecision('emi_amount'),
    accountId: text('account_id'),
    partyId: text('party_id'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdByUserId: text('created_by_user_id'),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('loans_business_idx').on(table.businessId),
}));

export const loanTransactions = pgTable('loan_transactions', {
    id: text('id').primaryKey(),
    loanId: text('loan_id').notNull(),
    businessId: text('business_id').notNull(),
    transactionType: text('transaction_type').notNull(), // DISBURSEMENT | REPAYMENT | INTEREST
    amount: doublePrecision('amount').notNull(),
    balanceAfter: doublePrecision('balance_after').notNull(),
    date: timestamp('date', ts).defaultNow().notNull(),
    notes: text('notes'),
    voucherId: text('voucher_id'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', ts).defaultNow().notNull(),
}, (table) => ({
    loanIdx: index('loan_transactions_loan_idx').on(table.loanId),
    businessIdx: index('loan_transactions_business_idx').on(table.businessId),
}));

// ─── Godowns ─────────────────────────────────────────────────────────────────

export const godowns = pgTable('godowns', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    name: text('name').notNull(),
    address: text('address'),
    isDefault: boolean('is_default').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdByUserId: text('created_by_user_id'),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('godowns_business_idx').on(table.businessId),
}));

export const godownStock = pgTable('godown_stock', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    godownId: text('godown_id').notNull(),
    itemId: text('item_id').notNull(),
    quantity: doublePrecision('quantity').default(0).notNull(),
    ...createTimestamps(),
}, (table) => ({
    godownItemUniqueIdx: uniqueIndex('godown_stock_godown_item_uidx').on(table.godownId, table.itemId),
    businessIdx: index('godown_stock_business_idx').on(table.businessId),
}));

export const stockTransfers = pgTable('stock_transfers', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    fromGodownId: text('from_godown_id').notNull(),
    toGodownId: text('to_godown_id').notNull(),
    itemId: text('item_id').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    date: timestamp('date', ts).defaultNow().notNull(),
    notes: text('notes'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', ts).defaultNow().notNull(),
}, (table) => ({
    businessIdx: index('stock_transfers_business_idx').on(table.businessId),
    itemIdx: index('stock_transfers_item_idx').on(table.itemId),
}));

// ─── Business Settings ────────────────────────────────────────────────────────

export const businessSettings = pgTable('business_settings', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    section: settingsSectionEnum('section').notNull(),
    dataJson: jsonb('data_json').$type<Record<string, unknown>>().default({}).notNull(),
    updatedAt: timestamp('updated_at', ts).defaultNow().notNull(),
}, (table) => ({
    businessSectionIdx: index('business_settings_business_section_idx').on(table.businessId, table.section),
}));

// ─── Devices & Plan Usage ─────────────────────────────────────────────────────

export const devices = pgTable('devices', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    userId: text('user_id').notNull(),
    platform: devicePlatformEnum('platform').notNull(),
    deviceInfo: jsonb('device_info').$type<Record<string, unknown>>().default({}).notNull(),
    lastSeenAt: timestamp('last_seen_at', ts),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('devices_business_idx').on(table.businessId),
    userIdx: index('devices_user_idx').on(table.userId),
}));

export const planUsage = pgTable('plan_usage', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    subscriptionId: text('subscription_id').notNull(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    billsCreatedInMonth: integer('bills_created_in_month').default(0).notNull(),
    storageUsedMb: doublePrecision('storage_used_mb').default(0).notNull(),
    staffUsersCount: integer('staff_users_count').default(0).notNull(),
    devicesCount: integer('devices_count').default(0).notNull(),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('plan_usage_business_idx').on(table.businessId),
    monthYearIdx: index('plan_usage_month_year_idx').on(table.year, table.month),
}));

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminAuditLogs = pgTable('admin_audit_logs', {
    id: text('id').primaryKey(),
    adminEmail: text('admin_email').notNull(),
    adminRole: adminRoleEnum('admin_role').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', ts).defaultNow().notNull(),
}, (table) => ({
    adminIdx: index('admin_audit_logs_admin_idx').on(table.adminEmail),
    createdIdx: index('admin_audit_logs_created_idx').on(table.createdAt),
}));

export const adminSettings = pgTable('admin_settings', {
    id: text('id').primaryKey(),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    updatedAt: timestamp('updated_at', ts).defaultNow().notNull(),
});

// ─── Staff & Invites ──────────────────────────────────────────────────────────

export const staffInvites = pgTable('staff_invites', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    ownerUserId: text('owner_user_id').notNull(),
    phoneNumber: text('phone_number').notNull(),
    role: memberRoleEnum('role').default('STAFF').notNull(),
    status: text('status').default('pending').notNull(),
    code: text('code').notNull(),
    expiresAt: timestamp('expires_at', ts).notNull(),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('staff_invites_business_idx').on(table.businessId),
    phoneIdx: index('staff_invites_phone_idx').on(table.phoneNumber),
}));

// ─── Templates & Signatures ───────────────────────────────────────────────────

export const templates = pgTable('templates', {
    id: text('id').primaryKey(),
    businessId: text('business_id'),
    name: text('name').notNull(),
    type: text('type').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().default({}).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    thumbnailUrl: text('thumbnail_url'),
    isActive: boolean('is_active').default(true).notNull(),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('templates_business_idx').on(table.businessId),
    typeIdx: index('templates_type_idx').on(table.type),
}));

export const signatures = pgTable('signatures', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    name: text('name'),
    signatureData: text('signature_data'),
    signatureUrl: text('signature_url'),
    isDefault: boolean('is_default').default(false).notNull(),
    createdByUserId: text('created_by_user_id'),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('signatures_business_idx').on(table.businessId),
}));

// ─── Analytics & Events ───────────────────────────────────────────────────────

export const analyticsEvents = pgTable('analytics_events', {
    id: text('id').primaryKey(),
    businessId: text('business_id'),
    userId: text('user_id'),
    eventType: text('event_type').notNull(),
    source: text('source'),
    planId: text('plan_id'),
    offerId: text('offer_id'),
    value: doublePrecision('value'),
    currency: text('currency'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', ts).defaultNow().notNull(),
}, (table) => ({
    eventIdx: index('analytics_events_type_idx').on(table.eventType),
    createdIdx: index('analytics_events_created_idx').on(table.createdAt),
}));

export const paymentIntents = pgTable('payment_intents', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    planId: text('plan_id').notNull(),
    planName: text('plan_name').notNull(),
    amount: doublePrecision('amount').notNull(),
    currency: text('currency').notNull(),
    provider: text('provider').notNull(),
    status: text('status').default('pending').notNull(),
    checkoutUrl: text('checkout_url'),
    providerReference: text('provider_reference'),
    failureReason: text('failure_reason'),
    ...createTimestamps(),
}, (table) => ({
    businessIdx: index('payment_intents_business_idx').on(table.businessId),
    statusIdx: index('payment_intents_status_idx').on(table.status),
}));

// ─── Offers & Notifications ───────────────────────────────────────────────────

export const offers = pgTable('offers', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    bannerUrl: text('banner_url'),
    bannerBackground: text('banner_background'),
    ctaText: text('cta_text'),
    ctaRoute: text('cta_route'),
    audience: text('audience').default('all').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    priority: integer('priority').default(0).notNull(),
    startsAt: timestamp('starts_at', ts),
    endsAt: timestamp('ends_at', ts),
    ...createTimestamps(),
}, (table) => ({
    activeIdx: index('offers_active_idx').on(table.isActive),
    priorityIdx: index('offers_priority_idx').on(table.priority),
}));

export const notificationTemplates = pgTable('notification_templates', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    eventKey: text('event_key').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    variables: text('variables').array().default(emptyTextArray).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdByAdminId: text('created_by_admin_id'),
    ...createTimestamps(),
}, (table) => ({
    eventIdx: index('notification_templates_event_idx').on(table.eventKey),
    channelIdx: index('notification_templates_channel_idx').on(table.channel),
    activeIdx: index('notification_templates_active_idx').on(table.isActive),
}));

export const notificationCampaigns = pgTable('notification_campaigns', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    templateId: text('template_id'),
    channel: notificationChannelEnum('channel').notNull(),
    audience: text('audience').default('all').notNull(),
    targetFilter: jsonb('target_filter').$type<Record<string, unknown>>().default({}).notNull(),
    status: text('status').default('DRAFT').notNull(),
    scheduledAt: timestamp('scheduled_at', ts),
    startedAt: timestamp('started_at', ts),
    completedAt: timestamp('completed_at', ts),
    createdByAdminId: text('created_by_admin_id'),
    ...createTimestamps(),
}, (table) => ({
    statusIdx: index('notification_campaigns_status_idx').on(table.status),
    channelIdx: index('notification_campaigns_channel_idx').on(table.channel),
    scheduledIdx: index('notification_campaigns_scheduled_idx').on(table.scheduledAt),
}));

export const notificationDeliveries = pgTable('notification_deliveries', {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id'),
    templateId: text('template_id'),
    businessId: text('business_id'),
    userId: text('user_id'),
    channel: notificationChannelEnum('channel').notNull(),
    status: text('status').default('QUEUED').notNull(),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    sentAt: timestamp('sent_at', ts),
    createdAt: timestamp('created_at', ts).defaultNow().notNull(),
}, (table) => ({
    campaignIdx: index('notification_deliveries_campaign_idx').on(table.campaignId),
    statusIdx: index('notification_deliveries_status_idx').on(table.status),
    userIdx: index('notification_deliveries_user_idx').on(table.userId),
}));
