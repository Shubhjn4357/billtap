import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Users table (store owner profile + auth snapshot)
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
