import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Key-value store for app/local settings
export const settings = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});
