import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import {
    billModeEnum,
    ledgerDirectionEnum,
    ledgerSourceTypeEnum,
    partyTypeEnum,
    paymentDirectionEnum,
    paymentModeEnum,
    paymentStatusEnum,
    transactionTypeEnum,
} from './enums';
import {
    createCreatedAt,
    createOptionalOrganizationScope,
    createOwnerScope,
    createTimestamps,
} from './common';

export const items = pgTable('items', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    ...createOptionalOrganizationScope(),
    name: text('name').notNull(),
    nameLowercase: text('nameLowercase').notNull(),

    price: doublePrecision('price').notNull(),
    purchasePrice: doublePrecision('purchasePrice').default(0),
    mrp: doublePrecision('mrp').default(0),

    hsn: text('hsn'),
    gstPercentage: doublePrecision('gstPercentage').default(0),

    stock: integer('stock').default(0).notNull(),
    minimumStock: integer('minimumStock').default(0),
    openingStock: integer('openingStock').default(0),
    unit: text('unit').default('pcs'),

    category: text('category'),
    subcategory: text('subcategory'),
    description: text('description'),
    location: text('location'),
    barcode: text('barcode'),
    imageUrl: text('imageUrl'),
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }),
    autoDeleteAt: timestamp('autoDeleteAt', { withTimezone: true, mode: 'date' }),
    autoDeleteEnabled: boolean('autoDeleteEnabled').default(false).notNull(),
    isActive: boolean('isActive').default(true),

    ...createTimestamps(),
}, (table) => ({
    userIndex: index('items_user_idx').on(table.userId),
    orgIndex: index('items_org_idx').on(table.organizationId),
    nameIndex: index('items_name_idx').on(table.nameLowercase),
    barcodeIndex: index('items_barcode_idx').on(table.barcode),
    categoryIndex: index('items_category_idx').on(table.category),
    expiresAtIndex: index('items_expires_at_idx').on(table.expiresAt),
    autoDeleteAtIndex: index('items_auto_delete_at_idx').on(table.autoDeleteAt),
}));

export const parties = pgTable('parties', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    ...createOptionalOrganizationScope(),
    name: text('name').notNull(),
    nameLowercase: text('nameLowercase').notNull(),
    type: partyTypeEnum('type').notNull(),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    gstNumber: text('gstNumber'),
    isActive: boolean('isActive').default(true),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('parties_user_idx').on(table.userId),
    orgIndex: index('parties_org_idx').on(table.organizationId),
    nameIndex: index('parties_name_idx').on(table.nameLowercase),
    typeIndex: index('parties_type_idx').on(table.type),
}));

export const transactions = pgTable('transactions', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    ...createOptionalOrganizationScope(),
    type: transactionTypeEnum('type').notNull(),

    partyId: text('partyId'),
    partyName: text('partyName'),
    partyPhone: text('partyPhone'),

    billNumber: text('billNumber'),
    billDate: timestamp('billDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),

    businessName: text('businessName'),
    businessAddress: text('businessAddress'),
    gstNumber: text('gstNumber'),

    currency: text('currency').default('INR'),
    costCenter: text('costCenter'),
    projectCode: text('projectCode'),
    totalAmount: doublePrecision('totalAmount').notNull(),
    discountAmount: doublePrecision('discountAmount').default(0),
    taxAmount: doublePrecision('taxAmount').default(0),
    paidAmount: doublePrecision('paidAmount').default(0),
    paymentMode: paymentModeEnum('paymentMode').default('CASH').notNull(),
    paymentStatus: paymentStatusEnum('paymentStatus').default('PAID').notNull(),
    billMode: billModeEnum('billMode').default('GST').notNull(),
    affectsGst: boolean('affectsGst').default(true).notNull(),
    createdByUid: text('createdByUid'),
    dueDate: timestamp('dueDate', { withTimezone: true, mode: 'date' }),
    reminderEnabled: boolean('reminderEnabled').default(false).notNull(),
    reminderFrequencyDays: integer('reminderFrequencyDays').default(3).notNull(),
    nextReminderAt: timestamp('nextReminderAt', { withTimezone: true, mode: 'date' }),
    lastReminderAt: timestamp('lastReminderAt', { withTimezone: true, mode: 'date' }),

    items: jsonb('items').$type<Array<{
        id: string;
        name: string;
        quantity: number;
        price: number;
        tax: number;
        total: number;
    }>>().notNull(),

    remark: text('remark'),
    deliveryAddress: text('deliveryAddress'),
    deliveryContactName: text('deliveryContactName'),
    deliveryContactPhone: text('deliveryContactPhone'),
    accountId: text('accountId'),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('transactions_user_idx').on(table.userId),
    orgIndex: index('transactions_org_idx').on(table.organizationId),
    userBillNumberIndex: index('transactions_user_bill_number_idx').on(table.userId, table.billNumber),
    orgBillNumberIndex: index('transactions_org_bill_number_idx').on(table.organizationId, table.billNumber),
    typeIndex: index('transactions_type_idx').on(table.type),
    createdIndex: index('transactions_created_idx').on(table.createdAt),
    partyIndex: index('transactions_party_idx').on(table.partyId),
    dueDateIndex: index('transactions_due_date_idx').on(table.dueDate),
    paymentStatusIndex: index('transactions_payment_status_idx').on(table.paymentStatus),
    nextReminderIndex: index('transactions_next_reminder_idx').on(table.nextReminderAt),
}));

export const partyLedgerEntries = pgTable('party_ledger_entries', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    ...createOptionalOrganizationScope(),
    partyId: text('partyId').notNull(),
    sourceType: ledgerSourceTypeEnum('sourceType').notNull(),
    sourceId: text('sourceId'),
    direction: ledgerDirectionEnum('direction').notNull(),
    amount: doublePrecision('amount').notNull(),
    runningBalance: doublePrecision('runningBalance').default(0).notNull(),
    entryDate: timestamp('entryDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    narration: text('narration'),
    createdByUid: text('createdByUid'),
    ...createCreatedAt(),
}, (table) => ({
    userIndex: index('party_ledger_entries_user_idx').on(table.userId),
    orgIndex: index('party_ledger_entries_org_idx').on(table.organizationId),
    partyIndex: index('party_ledger_entries_party_idx').on(table.partyId),
    dateIndex: index('party_ledger_entries_date_idx').on(table.entryDate),
}));

export const paymentEntries = pgTable('payment_entries', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    ...createOptionalOrganizationScope(),
    partyId: text('partyId').notNull(),
    direction: paymentDirectionEnum('direction').notNull(),
    amount: doublePrecision('amount').notNull(),
    paymentDate: timestamp('paymentDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    paymentMode: paymentModeEnum('paymentMode').default('CASH').notNull(),
    referenceNumber: text('referenceNumber'),
    narration: text('narration'),
    createdByUid: text('createdByUid'),
    ...createCreatedAt(),
}, (table) => ({
    userIndex: index('payment_entries_user_idx').on(table.userId),
    orgIndex: index('payment_entries_org_idx').on(table.organizationId),
    partyIndex: index('payment_entries_party_idx').on(table.partyId),
    dateIndex: index('payment_entries_date_idx').on(table.paymentDate),
}));

export const expenses = pgTable('expenses', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    ...createOptionalOrganizationScope(),
    expenseDate: timestamp('expenseDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    category: text('category').notNull(),
    amount: doublePrecision('amount').notNull(),
    paymentMode: paymentModeEnum('paymentMode').default('CASH').notNull(),
    paidToPartyId: text('paidToPartyId'),
    paidToName: text('paidToName'),
    costCenter: text('costCenter'),
    projectCode: text('projectCode'),
    notes: text('notes'),
    attachmentUrl: text('attachmentUrl'),
    createdByUid: text('createdByUid'),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('expenses_user_idx').on(table.userId),
    orgIndex: index('expenses_org_idx').on(table.organizationId),
    dateIndex: index('expenses_date_idx').on(table.expenseDate),
    categoryIndex: index('expenses_category_idx').on(table.category),
}));

