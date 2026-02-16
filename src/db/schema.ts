import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    uid: text('uid').primaryKey(), // Firebase UID
    ownerId: text('ownerId'), // Valid if role is 'staff'. Points to the Owner's UID.
    email: text('email'),
    phoneNumber: text('phoneNumber'),
    displayName: text('displayName'),
    photoURL: text('photoURL'),
    businessName: text('businessName'),
    address: text('address'),
    gstEnabled: boolean('gstEnabled').default(false),
    gstNumber: text('gstNumber'),
    currency: text('currency').default('INR'),
    role: text('role').default('owner'), // 'owner' | 'staff' | 'admin'
    subscriptionStatus: text('subscriptionStatus').default('inactive'),
    subscriptionPlanId: text('subscriptionPlanId'),
    subscriptionPlanName: text('subscriptionPlanName'),
    subscriptionAmountMonthly: doublePrecision('subscriptionAmountMonthly'),
    subscriptionCurrency: text('subscriptionCurrency'),
    subscriptionStartsAt: timestamp('subscriptionStartsAt', { withTimezone: true, mode: 'date' }),
    subscriptionEndsAt: timestamp('subscriptionEndsAt', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    roleIndex: index('users_role_idx').on(table.role),
    ownerIndex: index('users_owner_idx').on(table.ownerId),
    subscriptionStatusIndex: index('users_subscription_status_idx').on(table.subscriptionStatus),
}));

export const phoneVerifications = pgTable('phone_verifications', {
    id: text('id').primaryKey(),
    phoneNumber: text('phoneNumber').notNull(),
    code: text('code').notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
    consumedAt: timestamp('consumedAt', { withTimezone: true, mode: 'date' }),
    attempts: integer('attempts').default(0).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    phoneIndex: index('phone_verifications_phone_idx').on(table.phoneNumber),
}));

export const plans = pgTable('plans', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    monthlyPrice: doublePrecision('monthlyPrice').notNull(),
    currency: text('currency').default('INR').notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    displayOrder: integer('displayOrder').default(0).notNull(),
    features: jsonb('features').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    activeIndex: index('plans_active_idx').on(table.isActive),
}));

export const offers = pgTable('offers', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    bannerUrl: text('bannerUrl'),
    bannerBackground: text('bannerBackground'),
    ctaText: text('ctaText'),
    ctaRoute: text('ctaRoute'),
    audience: text('audience').default('all').notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    priority: integer('priority').default(0).notNull(),
    startsAt: timestamp('startsAt', { withTimezone: true, mode: 'date' }),
    endsAt: timestamp('endsAt', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    activeIndex: index('offers_active_idx').on(table.isActive),
    priorityIndex: index('offers_priority_idx').on(table.priority),
}));

export const items = pgTable('items', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(), // Owner's ID
    organizationId: text('organizationId').notNull(),
    branchId: text('branchId'),
    name: text('name').notNull(),
    nameLowercase: text('nameLowercase').notNull(),

    // Pricing
    price: doublePrecision('price').notNull(), // Selling Price
    purchasePrice: doublePrecision('purchasePrice').default(0),
    mrp: doublePrecision('mrp').default(0),

    // Taxes
    hsn: text('hsn'),
    gstPercentage: doublePrecision('gstPercentage').default(0),

    // Stock
    stock: integer('stock').default(0).notNull(),
    minimumStock: integer('minimumStock').default(0),
    openingStock: integer('openingStock').default(0),
    unit: text('unit').default('pcs'),

    // Meta
    category: text('category'),
    subcategory: text('subcategory'),
    location: text('location'),
    barcode: text('barcode'),
    imageUrl: text('imageUrl'),
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }),
    autoDeleteAt: timestamp('autoDeleteAt', { withTimezone: true, mode: 'date' }),
    autoDeleteEnabled: boolean('autoDeleteEnabled').default(false).notNull(),
    isActive: boolean('isActive').default(true),

    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('items_user_idx').on(table.userId),
    organizationIndex: index('items_org_idx').on(table.organizationId),
    organizationBranchIndex: index('items_org_branch_idx').on(table.organizationId, table.branchId),
    branchIndex: index('items_branch_idx').on(table.branchId),
    nameIndex: index('items_name_idx').on(table.nameLowercase),
    barcodeIndex: index('items_barcode_idx').on(table.barcode),
    categoryIndex: index('items_category_idx').on(table.category),
    expiresAtIndex: index('items_expires_at_idx').on(table.expiresAt),
    autoDeleteAtIndex: index('items_auto_delete_at_idx').on(table.autoDeleteAt),
}));

export const parties = pgTable('parties', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(), // Owner's ID
    organizationId: text('organizationId'),
    name: text('name').notNull(),
    nameLowercase: text('nameLowercase').notNull(),
    type: text('type').notNull(), // 'customer' | 'supplier'
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    gstNumber: text('gstNumber'),
    isActive: boolean('isActive').default(true),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('parties_user_idx').on(table.userId),
    organizationIndex: index('parties_org_idx').on(table.organizationId),
    nameIndex: index('parties_name_idx').on(table.nameLowercase),
    typeIndex: index('parties_type_idx').on(table.type),
}));

export const transactions = pgTable('transactions', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(), // Owner's ID
    organizationId: text('organizationId'),
    branchId: text('branchId'),
    type: text('type').notNull(), // 'SALE' | 'PURCHASE'

    // Party Details
    partyId: text('partyId'), // Optional link to parties table
    partyName: text('partyName'),
    partyPhone: text('partyPhone'),

    // Bill Details
    billNumber: text('billNumber'),
    billDate: timestamp('billDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),

// Business Details (Snapshot)
    businessName: text('businessName'),
    businessAddress: text('businessAddress'),
    gstNumber: text('gstNumber'),

    // Financials
    currency: text('currency').default('INR'),
    costCenter: text('costCenter'),
    projectCode: text('projectCode'),
    totalAmount: doublePrecision('totalAmount').notNull(),
    discountAmount: doublePrecision('discountAmount').default(0),
    taxAmount: doublePrecision('taxAmount').default(0),
    paidAmount: doublePrecision('paidAmount').default(0),
    paymentMode: text('paymentMode').default('CASH').notNull(), // CASH | CREDIT
    paymentStatus: text('paymentStatus').default('PAID').notNull(), // PAID | PARTIAL | PENDING
    billMode: text('billMode').default('GST').notNull(), // GST | ESTIMATE
    affectsGst: boolean('affectsGst').default(true).notNull(),
    createdByUid: text('createdByUid'),
    dueDate: timestamp('dueDate', { withTimezone: true, mode: 'date' }),
    reminderEnabled: boolean('reminderEnabled').default(false).notNull(),
    reminderFrequencyDays: integer('reminderFrequencyDays').default(3).notNull(),
    nextReminderAt: timestamp('nextReminderAt', { withTimezone: true, mode: 'date' }),
    lastReminderAt: timestamp('lastReminderAt', { withTimezone: true, mode: 'date' }),

    // Items Snapshot
    items: jsonb('items').$type<Array<{
        id: string;
        name: string;
        quantity: number;
        price: number; // Unit Price
        tax: number;
        total: number;
    }>>().notNull(),

    remark: text('remark'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('transactions_user_idx').on(table.userId),
    organizationIndex: index('transactions_org_idx').on(table.organizationId),
    branchIndex: index('transactions_branch_idx').on(table.branchId),
    typeIndex: index('transactions_type_idx').on(table.type),
    createdIndex: index('transactions_created_idx').on(table.createdAt),
    partyIndex: index('transactions_party_idx').on(table.partyId),
    dueDateIndex: index('transactions_due_date_idx').on(table.dueDate),
    paymentStatusIndex: index('transactions_payment_status_idx').on(table.paymentStatus),
    nextReminderIndex: index('transactions_next_reminder_idx').on(table.nextReminderAt),
}));

export const staffInvites = pgTable('staff_invites', {
    id: text('id').primaryKey(),
    ownerId: text('ownerId').notNull(),
    organizationId: text('organizationId'),
    phoneNumber: text('phoneNumber').notNull(),
    role: text('role').default('staff'),
    permissions: jsonb('permissions').$type<Record<string, boolean> | null>(),
    status: text('status').default('pending'), // 'pending' | 'accepted' | 'rejected'
    code: text('code').notNull(), // Invite code
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    ownerIndex: index('staff_invites_owner_idx').on(table.ownerId),
    phoneIndex: index('staff_invites_phone_idx').on(table.phoneNumber),
}));

export const analyticsEvents = pgTable('analytics_events', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    eventType: text('eventType').notNull(),
    source: text('source'),
    planId: text('planId'),
    offerId: text('offerId'),
    value: doublePrecision('value'),
    currency: text('currency'),
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null> | null>(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    createdIndex: index('analytics_events_created_idx').on(table.createdAt),
    typeIndex: index('analytics_events_type_idx').on(table.eventType),
}));

export const paymentIntents = pgTable('payment_intents', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    planId: text('planId').notNull(),
    planName: text('planName').notNull(),
    amount: doublePrecision('amount').notNull(),
    currency: text('currency').notNull(),
    provider: text('provider').default('mock').notNull(),
    status: text('status').default('pending').notNull(),
    checkoutUrl: text('checkoutUrl'),
    providerReference: text('providerReference'),
    failureReason: text('failureReason'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('payment_intents_user_idx').on(table.userId),
    statusIndex: index('payment_intents_status_idx').on(table.status),
}));

// Accounting master chart of accounts per business
export const accounts = pgTable('accounts', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    branchId: text('branchId'),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(), // ASSET | LIABILITY | EQUITY | INCOME | EXPENSE
    parentId: text('parentId'),
    isSystem: boolean('isSystem').default(false).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('accounts_user_idx').on(table.userId),
    branchIndex: index('accounts_branch_idx').on(table.branchId),
    codeIndex: index('accounts_code_idx').on(table.code),
    typeIndex: index('accounts_type_idx').on(table.type),
}));

export const journalEntries = pgTable('journal_entries', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    branchId: text('branchId'),
    costCenter: text('costCenter'),
    projectCode: text('projectCode'),
    entryDate: timestamp('entryDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    batchNumber: text('batchNumber'),
    referenceType: text('referenceType'),
    referenceId: text('referenceId'),
    narration: text('narration'),
    currency: text('currency').default('INR').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('journal_entries_user_idx').on(table.userId),
    branchIndex: index('journal_entries_branch_idx').on(table.branchId),
    dateIndex: index('journal_entries_date_idx').on(table.entryDate),
    referenceIndex: index('journal_entries_ref_idx').on(table.referenceType, table.referenceId),
}));

export const journalLines = pgTable('journal_lines', {
    id: text('id').primaryKey(),
    entryId: text('entryId').notNull(),
    userId: text('userId').notNull(),
    accountId: text('accountId').notNull(),
    partyId: text('partyId'),
    debit: doublePrecision('debit').default(0).notNull(),
    credit: doublePrecision('credit').default(0).notNull(),
    hsn: text('hsn'),
    gstRate: doublePrecision('gstRate').default(0),
    taxType: text('taxType'), // CGST | SGST | IGST | CESS
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('journal_lines_user_idx').on(table.userId),
    entryIndex: index('journal_lines_entry_idx').on(table.entryId),
    accountIndex: index('journal_lines_account_idx').on(table.accountId),
}));

export const inventoryMovements = pgTable('inventory_movements', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    branchId: text('branchId'),
    itemId: text('itemId').notNull(),
    transactionId: text('transactionId'),
    movementType: text('movementType').notNull(), // IN | OUT | ADJUST
    quantity: doublePrecision('quantity').notNull(),
    balanceAfter: doublePrecision('balanceAfter'),
    unitCost: doublePrecision('unitCost'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('inventory_movements_user_idx').on(table.userId),
    branchIndex: index('inventory_movements_branch_idx').on(table.branchId),
    itemIndex: index('inventory_movements_item_idx').on(table.itemId),
    transactionIndex: index('inventory_movements_txn_idx').on(table.transactionId),
    createdIndex: index('inventory_movements_created_idx').on(table.createdAt),
}));

export const businessControls = pgTable('business_controls', {
    userId: text('userId').primaryKey().notNull(),
    makerCheckerEnabled: boolean('makerCheckerEnabled').default(true).notNull(),
    journalApprovalRequired: boolean('journalApprovalRequired').default(true).notNull(),
    stockAdjustmentApprovalRequired: boolean('stockAdjustmentApprovalRequired').default(true).notNull(),
    periodLockEnabled: boolean('periodLockEnabled').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('business_controls_user_idx').on(table.userId),
}));

export const approvalRequests = pgTable('approval_requests', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    module: text('module').notNull(), // inventory | billing | accounting | admin
    requestType: text('requestType').notNull(), // JOURNAL_ENTRY | STOCK_ADJUSTMENT
    requestedBy: text('requestedBy').notNull(),
    requestedByRole: text('requestedByRole'),
    status: text('status').default('pending').notNull(), // pending | approved | rejected
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    reason: text('reason'),
    reviewedBy: text('reviewedBy'),
    reviewedAt: timestamp('reviewedAt', { withTimezone: true, mode: 'date' }),
    reviewNote: text('reviewNote'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userStatusIndex: index('approval_requests_user_status_idx').on(table.userId, table.status),
    moduleIndex: index('approval_requests_module_idx').on(table.module),
    requesterIndex: index('approval_requests_requester_idx').on(table.requestedBy),
    createdIndex: index('approval_requests_created_idx').on(table.createdAt),
}));

export const auditLogs = pgTable('audit_logs', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    actorUid: text('actorUid').notNull(),
    actorRole: text('actorRole'),
    module: text('module').notNull(),
    action: text('action').notNull(),
    entityType: text('entityType'),
    entityId: text('entityId'),
    before: jsonb('before').$type<Record<string, unknown> | null>(),
    after: jsonb('after').$type<Record<string, unknown> | null>(),
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null> | null>(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('audit_logs_user_idx').on(table.userId),
    moduleIndex: index('audit_logs_module_idx').on(table.module),
    actorIndex: index('audit_logs_actor_idx').on(table.actorUid),
    createdIndex: index('audit_logs_created_idx').on(table.createdAt),
}));

export const accountingPeriods = pgTable('accounting_periods', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    periodStart: timestamp('periodStart', { withTimezone: true, mode: 'date' }).notNull(),
    periodEnd: timestamp('periodEnd', { withTimezone: true, mode: 'date' }).notNull(),
    status: text('status').default('open').notNull(), // open | locked | closed
    lockedBy: text('lockedBy'),
    lockedAt: timestamp('lockedAt', { withTimezone: true, mode: 'date' }),
    closedBy: text('closedBy'),
    closedAt: timestamp('closedAt', { withTimezone: true, mode: 'date' }),
    notes: text('notes'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('accounting_periods_user_idx').on(table.userId),
    rangeIndex: index('accounting_periods_range_idx').on(table.periodStart, table.periodEnd),
    statusIndex: index('accounting_periods_status_idx').on(table.status),
}));

export const branches = pgTable('branches', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    address: text('address'),
    isPrimary: boolean('isPrimary').default(false).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('branches_user_idx').on(table.userId),
    codeIndex: index('branches_code_idx').on(table.code),
}));

export const attendanceRecords = pgTable('attendance_records', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    staffUid: text('staffUid').notNull(),
    branchId: text('branchId'),
    shiftName: text('shiftName'),
    checkInAt: timestamp('checkInAt', { withTimezone: true, mode: 'date' }).notNull(),
    checkOutAt: timestamp('checkOutAt', { withTimezone: true, mode: 'date' }),
    overtimeMinutes: integer('overtimeMinutes').default(0).notNull(),
    status: text('status').default('present').notNull(), // present | absent | half-day | leave
    notes: text('notes'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('attendance_records_user_idx').on(table.userId),
    staffIndex: index('attendance_records_staff_idx').on(table.staffUid),
    dateIndex: index('attendance_records_checkin_idx').on(table.checkInAt),
}));

export const payrollComponents = pgTable('payroll_components', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(), // earning | deduction | statutory
    amountType: text('amountType').default('fixed').notNull(), // fixed | percent
    value: doublePrecision('value').default(0).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('payroll_components_user_idx').on(table.userId),
    codeIndex: index('payroll_components_code_idx').on(table.code),
    categoryIndex: index('payroll_components_category_idx').on(table.category),
}));

export const salaryRuns = pgTable('salary_runs', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    branchId: text('branchId'),
    periodStart: timestamp('periodStart', { withTimezone: true, mode: 'date' }).notNull(),
    periodEnd: timestamp('periodEnd', { withTimezone: true, mode: 'date' }).notNull(),
    status: text('status').default('draft').notNull(), // draft | finalized
    totalGross: doublePrecision('totalGross').default(0).notNull(),
    totalDeductions: doublePrecision('totalDeductions').default(0).notNull(),
    totalNet: doublePrecision('totalNet').default(0).notNull(),
    journalEntryId: text('journalEntryId'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('salary_runs_user_idx').on(table.userId),
    periodIndex: index('salary_runs_period_idx').on(table.periodStart, table.periodEnd),
    statusIndex: index('salary_runs_status_idx').on(table.status),
}));

export const salaryRunItems = pgTable('salary_run_items', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    runId: text('runId').notNull(),
    staffUid: text('staffUid').notNull(),
    attendanceDays: doublePrecision('attendanceDays').default(0).notNull(),
    overtimeMinutes: integer('overtimeMinutes').default(0).notNull(),
    grossPay: doublePrecision('grossPay').default(0).notNull(),
    deductions: doublePrecision('deductions').default(0).notNull(),
    netPay: doublePrecision('netPay').default(0).notNull(),
    componentBreakdown: jsonb('componentBreakdown').$type<Array<{
        componentId: string;
        code: string;
        name: string;
        category: 'earning' | 'deduction' | 'statutory';
        amount: number;
    }>>().default([]).notNull(),
    payslipData: jsonb('payslipData').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('salary_run_items_user_idx').on(table.userId),
    runIndex: index('salary_run_items_run_idx').on(table.runId),
    staffIndex: index('salary_run_items_staff_idx').on(table.staffUid),
}));

export const gstNotes = pgTable('gst_notes', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    type: text('type').notNull(), // CREDIT | DEBIT
    relatedTransactionId: text('relatedTransactionId'),
    noteNumber: text('noteNumber'),
    noteDate: timestamp('noteDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    partyId: text('partyId'),
    partyName: text('partyName'),
    partyGstNumber: text('partyGstNumber'),
    reason: text('reason'),
    taxableAmount: doublePrecision('taxableAmount').default(0).notNull(),
    taxAmount: doublePrecision('taxAmount').default(0).notNull(),
    totalAmount: doublePrecision('totalAmount').default(0).notNull(),
    status: text('status').default('open').notNull(), // open | applied | canceled
    items: jsonb('items').$type<Array<{
        itemId?: string;
        name: string;
        quantity: number;
        price: number;
        tax: number;
        total: number;
    }>>().default([]).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('gst_notes_user_idx').on(table.userId),
    typeIndex: index('gst_notes_type_idx').on(table.type),
    dateIndex: index('gst_notes_date_idx').on(table.noteDate),
}));

export const bankAccounts = pgTable('bank_accounts', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    branchId: text('branchId'),
    name: text('name').notNull(),
    bankName: text('bankName').notNull(),
    accountNumberMasked: text('accountNumberMasked'),
    ifsc: text('ifsc'),
    openingBalance: doublePrecision('openingBalance').default(0).notNull(),
    currentBalance: doublePrecision('currentBalance').default(0).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('bank_accounts_user_idx').on(table.userId),
    branchIndex: index('bank_accounts_branch_idx').on(table.branchId),
}));

export const vouchers = pgTable('vouchers', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    branchId: text('branchId'),
    type: text('type').notNull(), // RECEIPT | PAYMENT
    voucherDate: timestamp('voucherDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    amount: doublePrecision('amount').notNull(),
    mode: text('mode').default('CASH').notNull(), // CASH | BANK
    bankAccountId: text('bankAccountId'),
    partyId: text('partyId'),
    partyName: text('partyName'),
    narration: text('narration'),
    costCenter: text('costCenter'),
    projectCode: text('projectCode'),
    status: text('status').default('posted').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('vouchers_user_idx').on(table.userId),
    typeIndex: index('vouchers_type_idx').on(table.type),
    dateIndex: index('vouchers_date_idx').on(table.voucherDate),
    branchIndex: index('vouchers_branch_idx').on(table.branchId),
}));

export const bankLedgerEntries = pgTable('bank_ledger_entries', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    bankAccountId: text('bankAccountId').notNull(),
    entryDate: timestamp('entryDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    direction: text('direction').notNull(), // DEBIT | CREDIT
    amount: doublePrecision('amount').notNull(),
    balanceAfter: doublePrecision('balanceAfter'),
    referenceType: text('referenceType'),
    referenceId: text('referenceId'),
    narration: text('narration'),
    reconciled: boolean('reconciled').default(false).notNull(),
    reconciledAt: timestamp('reconciledAt', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('bank_ledger_entries_user_idx').on(table.userId),
    bankIndex: index('bank_ledger_entries_bank_idx').on(table.bankAccountId),
    dateIndex: index('bank_ledger_entries_date_idx').on(table.entryDate),
    reconciledIndex: index('bank_ledger_entries_reconciled_idx').on(table.reconciled),
}));

export const bankReconciliations = pgTable('bank_reconciliations', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    bankAccountId: text('bankAccountId').notNull(),
    statementStart: timestamp('statementStart', { withTimezone: true, mode: 'date' }).notNull(),
    statementEnd: timestamp('statementEnd', { withTimezone: true, mode: 'date' }).notNull(),
    statementClosingBalance: doublePrecision('statementClosingBalance').notNull(),
    bookClosingBalance: doublePrecision('bookClosingBalance').notNull(),
    differenceAmount: doublePrecision('differenceAmount').notNull(),
    notes: text('notes'),
    status: text('status').default('draft').notNull(), // draft | matched | mismatched
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('bank_reconciliations_user_idx').on(table.userId),
    bankIndex: index('bank_reconciliations_bank_idx').on(table.bankAccountId),
    periodIndex: index('bank_reconciliations_period_idx').on(table.statementStart, table.statementEnd),
}));

export const branchTransfers = pgTable('branch_transfers', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    fromBranchId: text('fromBranchId').notNull(),
    toBranchId: text('toBranchId').notNull(),
    itemId: text('itemId').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    unitCost: doublePrecision('unitCost').default(0).notNull(),
    transferDate: timestamp('transferDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    status: text('status').default('completed').notNull(), // draft | completed | canceled
    referenceNote: text('referenceNote'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('branch_transfers_user_idx').on(table.userId),
    fromBranchIndex: index('branch_transfers_from_idx').on(table.fromBranchId),
    toBranchIndex: index('branch_transfers_to_idx').on(table.toBranchId),
    itemIndex: index('branch_transfers_item_idx').on(table.itemId),
}));

export const costCenters = pgTable('cost_centers', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('cost_centers_user_idx').on(table.userId),
    codeIndex: index('cost_centers_code_idx').on(table.code),
}));

export const projects = pgTable('projects', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('projects_user_idx').on(table.userId),
    codeIndex: index('projects_code_idx').on(table.code),
}));

export const organizations = pgTable('organizations', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(), // owner uid
    name: text('name').notNull(),
    code: text('code').notNull(),
    gstNumber: text('gstNumber'),
    address: text('address'),
    phoneNumber: text('phoneNumber'),
    email: text('email'),
    currency: text('currency').default('INR').notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('organizations_user_idx').on(table.userId),
    codeIndex: index('organizations_code_idx').on(table.code),
    activeIndex: index('organizations_active_idx').on(table.isActive),
}));

export const organizationMembers = pgTable('organization_members', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId').notNull(),
    role: text('role').default('salesman').notNull(), // owner | manager | salesman
    permissions: jsonb('permissions').$type<Record<string, boolean>>().default({}).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    invitedBy: text('invitedBy'),
    phoneNumberSnapshot: text('phoneNumberSnapshot'),
    joinedAt: timestamp('joinedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('organization_members_user_idx').on(table.userId),
    organizationIndex: index('organization_members_org_idx').on(table.organizationId),
    roleIndex: index('organization_members_role_idx').on(table.role),
    activeIndex: index('organization_members_active_idx').on(table.isActive),
}));

export const organizationSettings = pgTable('organization_settings', {
    organizationId: text('organizationId').primaryKey(),
    userId: text('userId').notNull(),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('organization_settings_user_idx').on(table.userId),
}));

export const ownerUsageSnapshots = pgTable('owner_usage_snapshots', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    billsCreated: integer('billsCreated').default(0).notNull(),
    storesCount: integer('storesCount').default(0).notNull(),
    staffCount: integer('staffCount').default(0).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('owner_usage_snapshots_user_idx').on(table.userId),
    monthYearIndex: index('owner_usage_snapshots_month_year_idx').on(table.year, table.month),
}));

export const partyLedgerEntries = pgTable('party_ledger_entries', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    partyId: text('partyId').notNull(),
    sourceType: text('sourceType').notNull(), // BILL | PAYMENT | RETURN | ADJUSTMENT
    sourceId: text('sourceId'),
    direction: text('direction').notNull(), // DEBIT | CREDIT
    amount: doublePrecision('amount').notNull(),
    runningBalance: doublePrecision('runningBalance').default(0).notNull(),
    entryDate: timestamp('entryDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    narration: text('narration'),
    createdByUid: text('createdByUid'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('party_ledger_entries_user_idx').on(table.userId),
    organizationIndex: index('party_ledger_entries_org_idx').on(table.organizationId),
    partyIndex: index('party_ledger_entries_party_idx').on(table.partyId),
    dateIndex: index('party_ledger_entries_date_idx').on(table.entryDate),
}));

export const paymentEntries = pgTable('payment_entries', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    partyId: text('partyId').notNull(),
    direction: text('direction').notNull(), // IN | OUT
    amount: doublePrecision('amount').notNull(),
    paymentDate: timestamp('paymentDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    paymentMode: text('paymentMode').default('CASH').notNull(), // CASH | BANK | UPI | CARD
    referenceNumber: text('referenceNumber'),
    narration: text('narration'),
    createdByUid: text('createdByUid'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('payment_entries_user_idx').on(table.userId),
    organizationIndex: index('payment_entries_org_idx').on(table.organizationId),
    partyIndex: index('payment_entries_party_idx').on(table.partyId),
    dateIndex: index('payment_entries_date_idx').on(table.paymentDate),
}));

export const expenses = pgTable('expenses', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    branchId: text('branchId'),
    expenseDate: timestamp('expenseDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    category: text('category').notNull(),
    amount: doublePrecision('amount').notNull(),
    paymentMode: text('paymentMode').default('CASH').notNull(), // CASH | BANK | UPI | CARD
    paidToPartyId: text('paidToPartyId'),
    paidToName: text('paidToName'),
    costCenter: text('costCenter'),
    projectCode: text('projectCode'),
    notes: text('notes'),
    attachmentUrl: text('attachmentUrl'),
    createdByUid: text('createdByUid'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('expenses_user_idx').on(table.userId),
    organizationIndex: index('expenses_org_idx').on(table.organizationId),
    branchIndex: index('expenses_branch_idx').on(table.branchId),
    dateIndex: index('expenses_date_idx').on(table.expenseDate),
    categoryIndex: index('expenses_category_idx').on(table.category),
}));

export const mediaAssets = pgTable('media_assets', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    assetType: text('assetType').notNull(), // PRODUCT_IMAGE | PROFILE_IMAGE | BILL_ATTACHMENT | OTHER
    entityType: text('entityType'),
    entityId: text('entityId'),
    url: text('url').notNull(),
    mimeType: text('mimeType'),
    sizeBytes: integer('sizeBytes'),
    createdByUid: text('createdByUid'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('media_assets_user_idx').on(table.userId),
    organizationIndex: index('media_assets_org_idx').on(table.organizationId),
    entityIndex: index('media_assets_entity_idx').on(table.entityType, table.entityId),
}));

export const signatures = pgTable('signatures', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    name: text('name'),
    signatureData: text('signatureData'), // base64/canvas payload
    signatureUrl: text('signatureUrl'),
    isDefault: boolean('isDefault').default(false).notNull(),
    createdByUid: text('createdByUid'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('signatures_user_idx').on(table.userId),
    organizationIndex: index('signatures_org_idx').on(table.organizationId),
    defaultIndex: index('signatures_default_idx').on(table.isDefault),
}));

export const billTemplates = pgTable('bill_templates', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    templateKey: text('templateKey').notNull(),
    name: text('name').notNull(),
    isPremium: boolean('isPremium').default(false).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    layoutConfig: jsonb('layoutConfig').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('bill_templates_user_idx').on(table.userId),
    organizationIndex: index('bill_templates_org_idx').on(table.organizationId),
    keyIndex: index('bill_templates_key_idx').on(table.templateKey),
}));

export const printProfiles = pgTable('print_profiles', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    name: text('name').notNull(),
    printerType: text('printerType').notNull(), // THERMAL | STANDARD
    paperSize: text('paperSize').notNull(), // 2INCH | 3INCH | A4 | A5
    isDefault: boolean('isDefault').default(false).notNull(),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('print_profiles_user_idx').on(table.userId),
    organizationIndex: index('print_profiles_org_idx').on(table.organizationId),
    defaultIndex: index('print_profiles_default_idx').on(table.isDefault),
}));

export const messageLogs = pgTable('message_logs', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    channel: text('channel').notNull(), // WHATSAPP | SMS | EMAIL
    recipient: text('recipient').notNull(),
    message: text('message').notNull(),
    mediaUrl: text('mediaUrl'),
    providerMessageId: text('providerMessageId'),
    status: text('status').default('pending').notNull(), // pending | sent | failed
    errorMessage: text('errorMessage'),
    sentByUid: text('sentByUid'),
    sentAt: timestamp('sentAt', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('message_logs_user_idx').on(table.userId),
    organizationIndex: index('message_logs_org_idx').on(table.organizationId),
    channelIndex: index('message_logs_channel_idx').on(table.channel),
    statusIndex: index('message_logs_status_idx').on(table.status),
}));

export const institutionStudents = pgTable('institution_students', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    name: text('name').notNull(),
    className: text('className'),
    admissionNumber: text('admissionNumber'),
    guardianName: text('guardianName'),
    phoneNumber: text('phoneNumber'),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('institution_students_user_idx').on(table.userId),
    organizationIndex: index('institution_students_org_idx').on(table.organizationId),
    phoneIndex: index('institution_students_phone_idx').on(table.phoneNumber),
}));

export const feeInvoices = pgTable('fee_invoices', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    studentId: text('studentId').notNull(),
    invoiceNumber: text('invoiceNumber'),
    amount: doublePrecision('amount').notNull(),
    paidAmount: doublePrecision('paidAmount').default(0).notNull(),
    dueAmount: doublePrecision('dueAmount').default(0).notNull(),
    dueDate: timestamp('dueDate', { withTimezone: true, mode: 'date' }),
    status: text('status').default('DUE').notNull(), // DUE | PARTIAL | PAID
    paymentMode: text('paymentMode'),
    barcodeValue: text('barcodeValue'),
    notes: text('notes'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('fee_invoices_user_idx').on(table.userId),
    organizationIndex: index('fee_invoices_org_idx').on(table.organizationId),
    studentIndex: index('fee_invoices_student_idx').on(table.studentId),
    dueDateIndex: index('fee_invoices_due_date_idx').on(table.dueDate),
    statusIndex: index('fee_invoices_status_idx').on(table.status),
}));

export const feeReminderLogs = pgTable('fee_reminder_logs', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    organizationId: text('organizationId'),
    feeInvoiceId: text('feeInvoiceId').notNull(),
    channel: text('channel').default('WHATSAPP').notNull(),
    recipient: text('recipient'),
    message: text('message'),
    status: text('status').default('pending').notNull(),
    sentByUid: text('sentByUid'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('fee_reminder_logs_user_idx').on(table.userId),
    organizationIndex: index('fee_reminder_logs_org_idx').on(table.organizationId),
    invoiceIndex: index('fee_reminder_logs_invoice_idx').on(table.feeInvoiceId),
    statusIndex: index('fee_reminder_logs_status_idx').on(table.status),
}));

export type UserRow = typeof users.$inferSelect;
export type PlanRow = typeof plans.$inferSelect;
export type OfferRow = typeof offers.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type PartyRow = typeof parties.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type StaffInviteRow = typeof staffInvites.$inferSelect;
export type AnalyticsEventRow = typeof analyticsEvents.$inferSelect;
export type PaymentIntentRow = typeof paymentIntents.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type JournalEntryRow = typeof journalEntries.$inferSelect;
export type JournalLineRow = typeof journalLines.$inferSelect;
export type InventoryMovementRow = typeof inventoryMovements.$inferSelect;
export type BusinessControlRow = typeof businessControls.$inferSelect;
export type ApprovalRequestRow = typeof approvalRequests.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type AccountingPeriodRow = typeof accountingPeriods.$inferSelect;
export type BranchRow = typeof branches.$inferSelect;
export type AttendanceRecordRow = typeof attendanceRecords.$inferSelect;
export type PayrollComponentRow = typeof payrollComponents.$inferSelect;
export type SalaryRunRow = typeof salaryRuns.$inferSelect;
export type SalaryRunItemRow = typeof salaryRunItems.$inferSelect;
export type GstNoteRow = typeof gstNotes.$inferSelect;
export type BankAccountRow = typeof bankAccounts.$inferSelect;
export type VoucherRow = typeof vouchers.$inferSelect;
export type BankLedgerEntryRow = typeof bankLedgerEntries.$inferSelect;
export type BankReconciliationRow = typeof bankReconciliations.$inferSelect;
export type BranchTransferRow = typeof branchTransfers.$inferSelect;
export type CostCenterRow = typeof costCenters.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type OrganizationRow = typeof organizations.$inferSelect;
export type OrganizationMemberRow = typeof organizationMembers.$inferSelect;
export type OrganizationSettingsRow = typeof organizationSettings.$inferSelect;
export type OwnerUsageSnapshotRow = typeof ownerUsageSnapshots.$inferSelect;
export type PartyLedgerEntryRow = typeof partyLedgerEntries.$inferSelect;
export type PaymentEntryRow = typeof paymentEntries.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type SignatureRow = typeof signatures.$inferSelect;
export type BillTemplateRow = typeof billTemplates.$inferSelect;
export type PrintProfileRow = typeof printProfiles.$inferSelect;
export type MessageLogRow = typeof messageLogs.$inferSelect;
export type InstitutionStudentRow = typeof institutionStudents.$inferSelect;
export type FeeInvoiceRow = typeof feeInvoices.$inferSelect;
export type FeeReminderLogRow = typeof feeReminderLogs.$inferSelect;
