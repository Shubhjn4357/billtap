import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseSync } from 'expo-sqlite';

type BackendName = 'sqlite' | 'async-storage';

type SQLiteLike = {
    execSync?: (sql: string) => void;
    runAsync?: (sql: string, params?: unknown[]) => Promise<unknown>;
    getFirstAsync?: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | null>;
};

const DB_NAME = 'vahi-offline.db';
const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS offline_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

let db: SQLiteLike | null = null;
let bootstrapped = false;
let backendName: BackendName = 'async-storage';

const ensureBootstrap = () => {
    if (bootstrapped) return;
    bootstrapped = true;
    try {
        const sqliteDb = openDatabaseSync(DB_NAME) as unknown as SQLiteLike;
        sqliteDb.execSync?.(TABLE_SQL);
        db = sqliteDb;
        backendName = 'sqlite';
    } catch {
        db = null;
        backendName = 'async-storage';
    }
};

const fallbackToAsyncStorage = () => {
    db = null;
    backendName = 'async-storage';
};

const getSqliteValue = async (key: string): Promise<string | null> => {
    if (!db?.getFirstAsync) return null;
    const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM offline_kv WHERE key = ? LIMIT 1',
        [key]
    );
    return row?.value ?? null;
};

const setSqliteValue = async (key: string, value: string): Promise<void> => {
    if (!db?.runAsync) return;
    await db.runAsync(
        `
        INSERT INTO offline_kv (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
        `,
        [key, value, Date.now()]
    );
};

const removeSqliteValue = async (key: string): Promise<void> => {
    if (!db?.runAsync) return;
    await db.runAsync('DELETE FROM offline_kv WHERE key = ?', [key]);
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
                return await getSqliteValue(key);
            } catch {
                fallbackToAsyncStorage();
            }
        }
        return AsyncStorage.getItem(key);
    },

    async setItem(key: string, value: string): Promise<void> {
        ensureBootstrap();
        if (db) {
            try {
                await setSqliteValue(key, value);
                return;
            } catch {
                fallbackToAsyncStorage();
            }
        }
        await AsyncStorage.setItem(key, value);
    },

    async removeItem(key: string): Promise<void> {
        ensureBootstrap();
        if (db) {
            try {
                await removeSqliteValue(key);
                return;
            } catch {
                fallbackToAsyncStorage();
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
                    await removeSqliteValue(key);
                }
                return;
            } catch {
                fallbackToAsyncStorage();
            }
        }
        for (const key of keys) {
            await AsyncStorage.removeItem(key);
        }
    },
};

