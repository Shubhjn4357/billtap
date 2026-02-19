import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { openDatabaseSync } from 'expo-sqlite';

export const expoDb = openDatabaseSync('vahi.db');
export const db = drizzle(expoDb, { schema });
