import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    uid: text('uid').primaryKey(),
    email: text('email'),
    phoneNumber: text('phoneNumber'),
    displayName: text('displayName'),
    photoURL: text('photoURL'),
    businessName: text('businessName'),
    address: text('address'),
    gstEnabled: boolean('gstEnabled').default(false),
    gstNumber: text('gstNumber'),
    currency: text('currency').default('INR'),
    role: text('role').default('owner'),
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
    userId: text('userId').notNull(),
    name: text('name').notNull(),
    nameLowercase: text('nameLowercase').notNull(),
    price: doublePrecision('price').notNull(),
    stock: integer('stock').default(0).notNull(),
    category: text('category'),
    barcode: text('barcode'),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIndex: index('items_user_idx').on(table.userId),
    nameIndex: index('items_name_idx').on(table.nameLowercase),
    barcodeIndex: index('items_barcode_idx').on(table.barcode),
}));

export const orders = pgTable('orders', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    customerName: text('customerName'),
    customerPhone: text('customerPhone'),
    businessName: text('businessName'),
    businessAddress: text('businessAddress'),
    gstNumber: text('gstNumber'),
    currency: text('currency').default('INR'),
    items: jsonb('items').$type<Array<{ id: string; name: string; price: number; quantity: number }>>().notNull(),
    total: doublePrecision('total').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userCreatedIndex: index('orders_user_created_idx').on(table.userId, table.createdAt),
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
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean> | null>(),
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

export type UserRow = typeof users.$inferSelect;
export type PlanRow = typeof plans.$inferSelect;
export type OfferRow = typeof offers.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type AnalyticsEventRow = typeof analyticsEvents.$inferSelect;
export type PaymentIntentRow = typeof paymentIntents.$inferSelect;
