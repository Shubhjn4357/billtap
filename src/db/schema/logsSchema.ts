import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Local sync action log / queue for background sync
export const syncQueue = sqliteTable('sync_queue', {
    id: text('id').primaryKey(),
    action: text('action').notNull(),
    data: text('data').notNull(),
    status: text('status').default('PENDING'),
    retryCount: integer('retryCount').default(0),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
});

// Local notifications/event log history
export const notifications = sqliteTable('notifications', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').default('info'),
    isRead: integer('isRead', { mode: 'boolean' }).default(false),
    createdAt: text('createdAt').notNull(),
});
