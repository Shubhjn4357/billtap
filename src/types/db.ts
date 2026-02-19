import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { items, parties, transactions, syncQueue, users, accounts } from '../db/schema';

// Select Types (Shape of date returned from DB)
export type DbItem = InferSelectModel<typeof items>;
export type DbParty = InferSelectModel<typeof parties>;
export type DbTransaction = InferSelectModel<typeof transactions>;
export type DbSyncQueue = InferSelectModel<typeof syncQueue>;
export type DbUser = InferSelectModel<typeof users>;

// Insert Types (Shape of data for insertion)
export type NewDbItem = InferInsertModel<typeof items>;
export type NewDbParty = InferInsertModel<typeof parties>;
export type NewDbTransaction = InferInsertModel<typeof transactions>;
export type NewDbSyncQueue = InferInsertModel<typeof syncQueue>;
export type NewDbUser = InferInsertModel<typeof users>;
export type DbAccount = InferSelectModel<typeof accounts>;
export type NewDbAccount = InferInsertModel<typeof accounts>;
