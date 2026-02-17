import AsyncStorage from '@react-native-async-storage/async-storage';
import { eq } from 'drizzle-orm';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { offlineKv } from './schema';

type BackendName = 'sqlite-drizzle' | 'async-storage';

const DB_NAME = 'billtap_local.db';
const DB_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS offline_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

let db: ExpoSQLiteDatabase | null = null;
let backendName: BackendName = 'async-storage';
let bootstrapped = false;

const ensureBootstrap = () => {
    if (bootstrapped) return;
    bootstrapped = true;

    try {
        const sqlite = openDatabaseSync(DB_NAME);
        sqlite.execSync(DB_TABLE_SQL);
        db = drizzle(sqlite);
        backendName = 'sqlite-drizzle';
    } catch {
        db = null;
        backendName = 'async-storage';
    }
};

const disableSqlite = () => {
    db = null;
    backendName = 'async-storage';
};

const getSqliteItem = async (key: string): Promise<string | null> => {
    if (!db) return null;
    const rows = await db
        .select({ value: offlineKv.value })
        .from(offlineKv)
        .where(eq(offlineKv.key, key))
        .limit(1);
    return rows[0]?.value ?? null;
};

const setSqliteItem = async (key: string, value: string) => {
    if (!db) return;
    await db
        .insert(offlineKv)
        .values({
            key,
            value,
            updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
            target: offlineKv.key,
            set: {
                value,
                updatedAt: Date.now(),
            },
        });
};

const removeSqliteItem = async (key: string) => {
    if (!db) return;
    await db.delete(offlineKv).where(eq(offlineKv.key, key));
};

export const offlineKeyValueStore = {
    getBackendName(): BackendName {
        ensureBootstrap();
        return backendName;
    },

    async getItem(key: string): Promise<string | null> {
        ensureBootstrap();
        if (db) {
            try {
                return await getSqliteItem(key);
            } catch {
                disableSqlite();
            }
        }
        return await AsyncStorage.getItem(key);
    },

    async setItem(key: string, value: string): Promise<void> {
        ensureBootstrap();
        if (db) {
            try {
                await setSqliteItem(key, value);
                return;
            } catch {
                disableSqlite();
            }
        }
        await AsyncStorage.setItem(key, value);
    },

    async removeItem(key: string): Promise<void> {
        ensureBootstrap();
        if (db) {
            try {
                await removeSqliteItem(key);
                return;
            } catch {
                disableSqlite();
            }
        }
        await AsyncStorage.removeItem(key);
    },

    async multiRemove(keys: string[]): Promise<void> {
        if (keys.length === 0) return;

        ensureBootstrap();
        if (db) {
            try {
                for (const key of keys) {
                    await removeSqliteItem(key);
                }
                return;
            } catch {
                disableSqlite();
            }
        }
        await AsyncStorage.multiRemove(keys);
    },
};
