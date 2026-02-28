export * from './schema/enums';
export * from './schema/coreSchema';

import {
    adminAuditLogs,
    businesses,
    subscriptions,
    users,
} from './schema/coreSchema';

export type UserRow = typeof users.$inferSelect;
export type BusinessRow = typeof businesses.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type AdminAuditLogRow = typeof adminAuditLogs.$inferSelect;
