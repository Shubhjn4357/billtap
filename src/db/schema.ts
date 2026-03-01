export * from './schema/enums';
export * from './schema/coreSchema';

import {
    adminAuditLogs,
    businesses,
    businessSettings,
    expenses,
    godowns,
    loans,
    subscriptions,
    users,
} from './schema/coreSchema';

export type UserRow = typeof users.$inferSelect;
export type BusinessRow = typeof businesses.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type AdminAuditLogRow = typeof adminAuditLogs.$inferSelect;
export type BusinessSettingsRow = typeof businessSettings.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
export type GodownRow = typeof godowns.$inferSelect;
export type LoanRow = typeof loans.$inferSelect;
