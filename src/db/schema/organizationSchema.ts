import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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

export const organizationCategories = pgTable('organization_categories', {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    userId: text('userId').notNull(), // owner uid
    name: text('name').notNull(),
    emoji: text('emoji').default('📦').notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    organizationIndex: index('org_categories_org_idx').on(table.organizationId),
    userIndex: index('org_categories_user_idx').on(table.userId),
    nameIndex: index('org_categories_name_idx').on(table.organizationId, table.name),
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

