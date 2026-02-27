import { boolean, doublePrecision, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import {
    accountTypeEnum,
    ledgerDirectionEnum,
    movementTypeEnum,
    reconciliationStatusEnum,
    voucherStatusEnum,
    voucherTypeEnum,
} from './enums';
import { createCreatedAt, createOwnerScope, createTimestamps } from './common';

export const accounts = pgTable('accounts', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: accountTypeEnum('type').notNull(),
    parentId: text('parentId'),
    isSystem: boolean('isSystem').default(false).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('accounts_user_idx').on(table.userId),
    codeIndex: index('accounts_code_idx').on(table.code),
    typeIndex: index('accounts_type_idx').on(table.type),
}));

export const journalEntries = pgTable('journal_entries', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    costCenter: text('costCenter'),
    projectCode: text('projectCode'),
    entryDate: timestamp('entryDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    batchNumber: text('batchNumber'),
    referenceType: text('referenceType'),
    referenceId: text('referenceId'),
    narration: text('narration'),
    currency: text('currency').default('INR').notNull(),
    ...createCreatedAt(),
}, (table) => ({
    userIndex: index('journal_entries_user_idx').on(table.userId),
    dateIndex: index('journal_entries_date_idx').on(table.entryDate),
    referenceIndex: index('journal_entries_ref_idx').on(table.referenceType, table.referenceId),
}));

export const journalLines = pgTable('journal_lines', {
    id: text('id').primaryKey(),
    entryId: text('entryId').notNull(),
    ...createOwnerScope(),
    accountId: text('accountId').notNull(),
    partyId: text('partyId'),
    debit: doublePrecision('debit').default(0).notNull(),
    credit: doublePrecision('credit').default(0).notNull(),
    hsn: text('hsn'),
    gstRate: doublePrecision('gstRate').default(0),
    taxType: text('taxType'),
    ...createCreatedAt(),
}, (table) => ({
    userIndex: index('journal_lines_user_idx').on(table.userId),
    entryIndex: index('journal_lines_entry_idx').on(table.entryId),
    accountIndex: index('journal_lines_account_idx').on(table.accountId),
}));

export const inventoryMovements = pgTable('inventory_movements', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    itemId: text('itemId').notNull(),
    transactionId: text('transactionId'),
    movementType: movementTypeEnum('movementType').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    balanceAfter: doublePrecision('balanceAfter'),
    unitCost: doublePrecision('unitCost'),
    ...createCreatedAt(),
}, (table) => ({
    userIndex: index('inventory_movements_user_idx').on(table.userId),
    itemIndex: index('inventory_movements_item_idx').on(table.itemId),
    transactionIndex: index('inventory_movements_txn_idx').on(table.transactionId),
    createdIndex: index('inventory_movements_created_idx').on(table.createdAt),
}));

export const bankAccounts = pgTable('bank_accounts', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    name: text('name').notNull(),
    bankName: text('bankName').notNull(),
    accountNumberMasked: text('accountNumberMasked'),
    ifsc: text('ifsc'),
    openingBalance: doublePrecision('openingBalance').default(0).notNull(),
    currentBalance: doublePrecision('currentBalance').default(0).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('bank_accounts_user_idx').on(table.userId),
}));

export const vouchers = pgTable('vouchers', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    type: voucherTypeEnum('type').notNull(),
    voucherDate: timestamp('voucherDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    amount: doublePrecision('amount').notNull(),
    mode: text('mode').default('CASH').notNull(),
    bankAccountId: text('bankAccountId'),
    partyId: text('partyId'),
    partyName: text('partyName'),
    narration: text('narration'),
    costCenter: text('costCenter'),
    projectCode: text('projectCode'),
    status: voucherStatusEnum('status').default('posted').notNull(),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('vouchers_user_idx').on(table.userId),
    typeIndex: index('vouchers_type_idx').on(table.type),
    dateIndex: index('vouchers_date_idx').on(table.voucherDate),
}));

export const bankLedgerEntries = pgTable('bank_ledger_entries', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    bankAccountId: text('bankAccountId').notNull(),
    entryDate: timestamp('entryDate', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    direction: ledgerDirectionEnum('direction').notNull(),
    amount: doublePrecision('amount').notNull(),
    balanceAfter: doublePrecision('balanceAfter'),
    referenceType: text('referenceType'),
    referenceId: text('referenceId'),
    narration: text('narration'),
    reconciled: boolean('reconciled').default(false).notNull(),
    reconciledAt: timestamp('reconciledAt', { withTimezone: true, mode: 'date' }),
    ...createCreatedAt(),
}, (table) => ({
    userIndex: index('bank_ledger_entries_user_idx').on(table.userId),
    bankIndex: index('bank_ledger_entries_bank_idx').on(table.bankAccountId),
    dateIndex: index('bank_ledger_entries_date_idx').on(table.entryDate),
    reconciledIndex: index('bank_ledger_entries_reconciled_idx').on(table.reconciled),
}));

export const bankReconciliations = pgTable('bank_reconciliations', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    bankAccountId: text('bankAccountId').notNull(),
    statementStart: timestamp('statementStart', { withTimezone: true, mode: 'date' }).notNull(),
    statementEnd: timestamp('statementEnd', { withTimezone: true, mode: 'date' }).notNull(),
    statementClosingBalance: doublePrecision('statementClosingBalance').notNull(),
    bookClosingBalance: doublePrecision('bookClosingBalance').notNull(),
    differenceAmount: doublePrecision('differenceAmount').notNull(),
    notes: text('notes'),
    status: reconciliationStatusEnum('status').default('draft').notNull(),
    createdBy: text('createdBy').notNull(),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('bank_reconciliations_user_idx').on(table.userId),
    bankIndex: index('bank_reconciliations_bank_idx').on(table.bankAccountId),
    periodIndex: index('bank_reconciliations_period_idx').on(table.statementStart, table.statementEnd),
}));

