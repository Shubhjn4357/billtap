import { boolean, doublePrecision, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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

