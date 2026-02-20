import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { openDatabaseSync } from 'expo-sqlite';
export const DATABASENAME='vahi.db'
export const expoDb = openDatabaseSync(DATABASENAME);
export const db = drizzle(expoDb, { schema });
