import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const templates = pgTable('templates', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'invoice' | 'card' | 'email'
    content: jsonb('content').notNull(), // HTML string or structured JSON
    isDefault: boolean('isDefault').default(false).notNull(),
    thumbnailUrl: text('thumbnailUrl'),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    typeIndex: index('templates_type_idx').on(table.type),
    defaultIndex: index('templates_default_idx').on(table.isDefault),
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

