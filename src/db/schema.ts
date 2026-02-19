import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Users table (Stores owner profile)
export const users = sqliteTable('users', {
    uid: text('uid').primaryKey(),
    email: text('email'),
    displayName: text('displayName'),
    businessName: text('businessName'),
    address: text('address'),
    gstNumber: text('gstNumber'),
    currency: text('currency').default('INR'),
    role: text('role').default('owner'),
    subscriptionStatus: text('subscriptionStatus').default('inactive'),
    createdAt: text('createdAt'),
    updatedAt: text('updatedAt'),
});

// Items/Products table
export const items = sqliteTable('items', {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    name: text('name').notNull(),
    nameLowercase: text('nameLowercase').notNull(),
    price: real('price').notNull(),
    purchasePrice: real('purchasePrice').default(0),
    mrp: real('mrp').default(0),
    hsn: text('hsn'),
    gstPercentage: real('gstPercentage').default(0),
    stock: integer('stock').default(0),
    minimumStock: integer('minimumStock').default(0),
    unit: text('unit').default('pcs'),
    category: text('category'),
    image: text('imageUrl'),
    barcode: text('barcode'),
    isActive: integer('isActive', { mode: 'boolean' }).default(true),
    updatedAt: text('updatedAt'),
    createdAt: text('createdAt'),
});

// Parties (Customers/Suppliers) table
export const parties = sqliteTable('parties', {
    id: text('id').primaryKey(), // UUID
    organizationId: text('organizationId'),
    name: text('name').notNull(),
    nameLowercase: text('nameLowercase').notNull(),
    type: text('type').notNull(), // 'customer' | 'supplier'
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    gstNumber: text('gstNumber'),
    isActive: integer('isActive', { mode: 'boolean' }).default(true),
    updatedAt: text('updatedAt'),
    createdAt: text('createdAt'),
});

// Transactions (Invoices/Bills) table
export const transactions = sqliteTable('transactions', {
    id: text('id').primaryKey(),
    organizationId: text('organizationId'),
    accountId: text('accountId'), // Link to accounts table (Cash/Bank) - NEW
    type: text('type').notNull(), // 'SALE' | 'PURCHASE'
    partyId: text('partyId'),
    partyName: text('partyName'),
    billNumber: text('billNumber'),
    billDate: text('billDate').notNull(),
    currency: text('currency').default('INR'),
    totalAmount: real('totalAmount').notNull(),
    discountAmount: real('discountAmount').default(0),
    taxAmount: real('taxAmount').default(0),
    paidAmount: real('paidAmount').default(0),
    paymentMode: text('paymentMode').default('CASH'),
    paymentStatus: text('paymentStatus').default('PAID'), // PAID, PARTIAL, PENDING
    billMode: text('billMode').default('ESTIMATE'), // GST, ESTIMATE
    dueDate: text('dueDate'),
    remark: text('remark'),
    deliveryAddress: text('deliveryAddress'), // NEW: Delivery location
    deliveryContactName: text('deliveryContactName'), // NEW: Delivery contact name
    deliveryContactPhone: text('deliveryContactPhone'), // NEW: Delivery contact phone
    itemsSnapshot: text('itemsSnapshot'), // JSON string of items snapshot
    createdAt: text('createdAt'),
    updatedAt: text('updatedAt'),
});

// Sync Queue table (Action Log)
export const syncQueue = sqliteTable('sync_queue', {
    id: text('id').primaryKey(),
    action: text('action').notNull(), // CREATE_INVOICE, UPDATE_ITEM, etc.
    data: text('data').notNull(), // JSON payload
    status: text('status').default('PENDING'), // PENDING, SYNCING, FAILED
    retryCount: integer('retryCount').default(0),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
});

// Key-Value Settings (Local only)
export const settings = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});

// Accounts table (Cash/Bank) - NEW
export const accounts = sqliteTable('accounts', {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'CASH' | 'BANK'
    balance: real('balance').default(0),
    isDefault: integer('isDefault', { mode: 'boolean' }).default(false),
    isActive: integer('isActive', { mode: 'boolean' }).default(true), // NEW
    isSystem: integer('isSystem', { mode: 'boolean' }).default(false), // NEW
    details: text('details'), // JSON for bank details (acc no, ifsc)
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
});
