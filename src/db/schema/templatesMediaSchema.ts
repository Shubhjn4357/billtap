import { boolean, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { assetTypeEnum, templateTypeEnum } from './enums';
import {
    createCreatedAt,
    createOptionalOrganizationScope,
    createOwnerScope,
    createTimestamps,
} from './common';

export const templates = pgTable('templates', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: templateTypeEnum('type').notNull(),
    content: jsonb('content').notNull(),
    isDefault: boolean('isDefault').default(false).notNull(),
    thumbnailUrl: text('thumbnailUrl'),
    isActive: boolean('isActive').default(true).notNull(),
    ...createTimestamps(),
}, (table) => ({
    typeIndex: index('templates_type_idx').on(table.type),
    defaultIndex: index('templates_default_idx').on(table.isDefault),
}));

export const mediaAssets = pgTable('media_assets', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    ...createOptionalOrganizationScope(),
    assetType: assetTypeEnum('assetType').notNull(),
    entityType: text('entityType'),
    entityId: text('entityId'),
    url: text('url').notNull(),
    mimeType: text('mimeType'),
    sizeBytes: integer('sizeBytes'),
    createdByUid: text('createdByUid'),
    ...createCreatedAt(),
}, (table) => ({
    userIndex: index('media_assets_user_idx').on(table.userId),
    orgIndex: index('media_assets_org_idx').on(table.organizationId),
    entityIndex: index('media_assets_entity_idx').on(table.entityType, table.entityId),
}));

