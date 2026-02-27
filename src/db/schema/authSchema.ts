import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { roleEnum, subscriptionStatusEnum, inviteStatusEnum } from './enums';
import { createCreatedAt, createOptionalOrganizationScope, createTimestamps } from './common';

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
    role: roleEnum('role').default('owner'), // Enum usage
    subscriptionStatus: subscriptionStatusEnum('subscriptionStatus').default('inactive'), // Enum usage
    subscriptionPlanId: text('subscriptionPlanId'),
    subscriptionPlanName: text('subscriptionPlanName'),
    subscriptionAmountMonthly: doublePrecision('subscriptionAmountMonthly'),
    subscriptionCurrency: text('subscriptionCurrency'),
    subscriptionStartsAt: timestamp('subscriptionStartsAt', { withTimezone: true, mode: 'date' }),
    subscriptionEndsAt: timestamp('subscriptionEndsAt', { withTimezone: true, mode: 'date' }),
    ...createTimestamps(),
}, (table) => [
    index('users_role_idx').on(table.role),
    index('users_owner_idx').on(table.ownerId),
    index('users_subscription_status_idx').on(table.subscriptionStatus),
]);

export const phoneVerifications = pgTable('phone_verifications', {
    id: text('id').primaryKey(),
    phoneNumber: text('phoneNumber').notNull(),
    code: text('code').notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
    consumedAt: timestamp('consumedAt', { withTimezone: true, mode: 'date' }),
    attempts: integer('attempts').default(0).notNull(),
    ...createCreatedAt(),
}, (table) => ({
    phoneIndex: index('phone_verifications_phone_idx').on(table.phoneNumber),
}));

export const staffInvites = pgTable('staff_invites', {
    id: text('id').primaryKey(),
    ownerId: text('ownerId').notNull(),
    ...createOptionalOrganizationScope(),
    phoneNumber: text('phoneNumber').notNull(),
    role: roleEnum('role').default('staff'), // Enum usage
    permissions: jsonb('permissions').$type<Record<string, boolean> | null>(),
    status: inviteStatusEnum('status').default('pending'), // Enum usage
    code: text('code').notNull(), // Invite code
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
    ...createCreatedAt(),
}, (table) => ({
    ownerIndex: index('staff_invites_owner_idx').on(table.ownerId),
    phoneIndex: index('staff_invites_phone_idx').on(table.phoneNumber),
}));
