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
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }),
    autoDeleteAt: timestamp('autoDeleteAt', { withTimezone: true, mode: 'date' }),
    autoDeleteEnabled: boolean('autoDeleteEnabled').default(false).notNull(),
    isActive: boolean('isActive').default(true),

    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('items_user_idx').on(table.userId),
    nameIndex: index('items_name_idx').on(table.nameLowercase),
    barcodeIndex: index('items_barcode_idx').on(table.barcode),
    categoryIndex: index('items_category_idx').on(table.category),
    expiresAtIndex: index('items_expires_at_idx').on(table.expiresAt),
    autoDeleteAtIndex: index('items_auto_delete_at_idx').on(table.autoDeleteAt),
}));

export const parties = pgTable('parties', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(), // Owner's ID
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
    nameIndex: index('parties_name_idx').on(table.nameLowercase),
    typeIndex: index('parties_type_idx').on(table.type),
}));

export const transactions = pgTable('transactions', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(), // Owner's ID
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
    totalAmount: doublePrecision('totalAmount').notNull(),
    discountAmount: doublePrecision('discountAmount').default(0),
    taxAmount: doublePrecision('taxAmount').default(0),
    paidAmount: doublePrecision('paidAmount').default(0),
    paymentMode: text('paymentMode').default('CASH').notNull(), // CASH | CREDIT
    paymentStatus: text('paymentStatus').default('PAID').notNull(), // PAID | PARTIAL | PENDING
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
    phoneNumber: text('phoneNumber').notNull(),
    role: text('role').default('staff'),
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
    codeIndex: index('accounts_code_idx').on(table.code),
    typeIndex: index('accounts_type_idx').on(table.type),
}));

export const journalEntries = pgTable('journal_entries', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    entryDate: timestamp('entryDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    batchNumber: text('batchNumber'),
    referenceType: text('referenceType'),
    referenceId: text('referenceId'),
    narration: text('narration'),
    currency: text('currency').default('INR').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('journal_entries_user_idx').on(table.userId),
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
    itemId: text('itemId').notNull(),
    transactionId: text('transactionId'),
    movementType: text('movementType').notNull(), // IN | OUT | ADJUST
    quantity: doublePrecision('quantity').notNull(),
    balanceAfter: doublePrecision('balanceAfter'),
    unitCost: doublePrecision('unitCost'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('inventory_movements_user_idx').on(table.userId),
    itemIndex: index('inventory_movements_item_idx').on(table.itemId),
    transactionIndex: index('inventory_movements_txn_idx').on(table.transactionId),
    createdIndex: index('inventory_movements_created_idx').on(table.createdAt),
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
