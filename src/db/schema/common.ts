import { text, timestamp } from 'drizzle-orm/pg-core';

const timestampColumnConfig = { withTimezone: true, mode: 'date' } as const;

export const createTimestamps = () => ({
    createdAt: timestamp('createdAt', timestampColumnConfig).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', timestampColumnConfig).defaultNow().notNull(),
});

export const createCreatedAt = () => ({
    createdAt: timestamp('createdAt', timestampColumnConfig).defaultNow().notNull(),
});

export const createOwnerScope = () => ({
    userId: text('userId').notNull(),
});

export const createOptionalOrganizationScope = () => ({
    organizationId: text('organizationId'),
});

export const createOrganizationScope = () => ({
    userId: text('userId').notNull(),
    organizationId: text('organizationId').notNull(),
});

