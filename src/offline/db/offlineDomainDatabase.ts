import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

type RecordRow = {
    scopeId: string;
    collection: string;
    recordId: string;
    dataJson: string;
    updatedAt: string;
    deleted: number;
};

type SettingRow = {
    scopeId: string;
    section: string;
    dataJson: string;
    updatedAt: string;
};

type OutboxRow = {
    scopeId: string;
    id: string;
    type: string;
    payloadJson: string;
    createdAt: string;
    attemptCount: number;
    status: string;
    lastErrorCode: string | null;
    nextRetryAt: number | null;
    lastAttemptAt: string | null;
    lastError: string | null;
};

type WebState = {
    records: RecordRow[];
    settings: SettingRow[];
    outbox: OutboxRow[];
};

const DB_NAME = 'vahi-offline-domain.db';
const WEB_STATE_KEY = 'vahi_offline_domain_web_v1';
const DEFAULT_SCOPE_ID = 'default';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const getLocalStorage = (): Storage | null => {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null;
    return globalThis.localStorage;
};

const readWebState = (): WebState => {
    const storage = getLocalStorage();
    if (!storage) {
        return { records: [], settings: [], outbox: [] };
    }

    try {
        const raw = storage.getItem(WEB_STATE_KEY);
        if (!raw) return { records: [], settings: [], outbox: [] };
        const parsed = JSON.parse(raw) as Partial<WebState>;
        return {
            records: Array.isArray(parsed.records) ? parsed.records as RecordRow[] : [],
            settings: Array.isArray(parsed.settings) ? parsed.settings as SettingRow[] : [],
            outbox: Array.isArray(parsed.outbox) ? parsed.outbox as OutboxRow[] : [],
        };
    } catch {
        return { records: [], settings: [], outbox: [] };
    }
};

const writeWebState = (value: WebState) => {
    const storage = getLocalStorage();
    if (!storage) return;
    storage.setItem(WEB_STATE_KEY, JSON.stringify(value));
};

const getDatabaseAsync = async (): Promise<SQLite.SQLiteDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = (async () => {
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        await db.execAsync(`
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS offline_records (
                scope_id TEXT NOT NULL,
                collection TEXT NOT NULL,
                record_id TEXT NOT NULL,
                data_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (scope_id, collection, record_id)
            );
            CREATE INDEX IF NOT EXISTS idx_offline_records_collection
                ON offline_records (scope_id, collection, updated_at DESC);

            CREATE TABLE IF NOT EXISTS offline_settings (
                scope_id TEXT NOT NULL,
                section TEXT NOT NULL,
                data_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (scope_id, section)
            );

            CREATE TABLE IF NOT EXISTS offline_outbox (
                scope_id TEXT NOT NULL,
                id TEXT PRIMARY KEY NOT NULL,
                type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                last_error_code TEXT,
                next_retry_at INTEGER,
                last_attempt_at TEXT,
                last_error TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_offline_outbox_scope_created
                ON offline_outbox (scope_id, created_at ASC);
        `);
        return db;
    })();

    return dbPromise;
};

const parseDataJson = <T>(value: string): T => JSON.parse(value) as T;

const sortByUpdatedAtDesc = <T extends { updatedAt?: string; createdAt?: string }>(rows: T[]) =>
    [...rows].sort((left, right) => {
        const leftKey = left.updatedAt ?? left.createdAt ?? '';
        const rightKey = right.updatedAt ?? right.createdAt ?? '';
        return rightKey.localeCompare(leftKey);
    });

const toScopeId = (scopeId?: string | null) => {
    const normalized = String(scopeId ?? '').trim();
    return normalized || DEFAULT_SCOPE_ID;
};

class OfflineDomainDatabase {
    private async withNativeWrite(
        task: (db: SQLite.SQLiteDatabase) => Promise<void>
    ): Promise<void> {
        const db = await getDatabaseAsync();
        await task(db);
    }

    async listRecords<T>(scopeId: string | null, collection: string): Promise<T[]> {
        const normalizedScopeId = toScopeId(scopeId);
        if (Platform.OS === 'web') {
            const state = readWebState();
            const rows = state.records
                .filter((entry) => entry.scopeId === normalizedScopeId && entry.collection === collection && entry.deleted === 0)
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
            return rows.map((entry) => parseDataJson<T>(entry.dataJson));
        }

        const db = await getDatabaseAsync();
        const rows = await db.getAllAsync<{
            data_json: string;
        }>(
            `SELECT data_json
             FROM offline_records
             WHERE scope_id = ? AND collection = ? AND deleted = 0
             ORDER BY updated_at DESC`,
            normalizedScopeId,
            collection
        );
        return rows.map((entry) => parseDataJson<T>(entry.data_json));
    }

    async replaceRecords<T extends { updatedAt?: string; createdAt?: string }>(
        scopeId: string | null,
        collection: string,
        rows: T[],
        getRecordId: (row: T) => string
    ): Promise<void> {
        const normalizedScopeId = toScopeId(scopeId);
        const orderedRows = sortByUpdatedAtDesc(rows);
        if (Platform.OS === 'web') {
            const state = readWebState();
            state.records = state.records.filter(
                (entry) => !(entry.scopeId === normalizedScopeId && entry.collection === collection)
            );
            state.records.push(
                ...orderedRows.map((row) => ({
                    scopeId: normalizedScopeId,
                    collection,
                    recordId: getRecordId(row),
                    dataJson: JSON.stringify(row),
                    updatedAt: row.updatedAt ?? row.createdAt ?? new Date().toISOString(),
                    deleted: 0,
                }))
            );
            writeWebState(state);
            return;
        }

        await this.withNativeWrite(async (db) => {
            await db.runAsync(
                'DELETE FROM offline_records WHERE scope_id = ? AND collection = ?',
                normalizedScopeId,
                collection
            );
            for (const row of orderedRows) {
                await db.runAsync(
                    `INSERT OR REPLACE INTO offline_records
                        (scope_id, collection, record_id, data_json, updated_at, deleted)
                     VALUES (?, ?, ?, ?, ?, 0)`,
                    normalizedScopeId,
                    collection,
                    getRecordId(row),
                    JSON.stringify(row),
                    row.updatedAt ?? row.createdAt ?? new Date().toISOString()
                );
            }
        });
    }

    async upsertRecord<T extends { updatedAt?: string; createdAt?: string }>(
        scopeId: string | null,
        collection: string,
        recordId: string,
        row: T
    ): Promise<void> {
        const normalizedScopeId = toScopeId(scopeId);
        const updatedAt = row.updatedAt ?? row.createdAt ?? new Date().toISOString();
        if (Platform.OS === 'web') {
            const state = readWebState();
            state.records = state.records.filter(
                (entry) => !(entry.scopeId === normalizedScopeId && entry.collection === collection && entry.recordId === recordId)
            );
            state.records.push({
                scopeId: normalizedScopeId,
                collection,
                recordId,
                dataJson: JSON.stringify(row),
                updatedAt,
                deleted: 0,
            });
            writeWebState(state);
            return;
        }

        await this.withNativeWrite(async (db) => {
            await db.runAsync(
                `INSERT OR REPLACE INTO offline_records
                    (scope_id, collection, record_id, data_json, updated_at, deleted)
                 VALUES (?, ?, ?, ?, ?, 0)`,
                normalizedScopeId,
                collection,
                recordId,
                JSON.stringify(row),
                updatedAt
            );
        });
    }

    async removeRecord(scopeId: string | null, collection: string, recordId: string): Promise<void> {
        const normalizedScopeId = toScopeId(scopeId);
        if (Platform.OS === 'web') {
            const state = readWebState();
            state.records = state.records.filter(
                (entry) => !(entry.scopeId === normalizedScopeId && entry.collection === collection && entry.recordId === recordId)
            );
            writeWebState(state);
            return;
        }

        await this.withNativeWrite(async (db) => {
            await db.runAsync(
                `DELETE FROM offline_records
                 WHERE scope_id = ? AND collection = ? AND record_id = ?`,
                normalizedScopeId,
                collection,
                recordId
            );
        });
    }

    async getSettingsMap(scopeId: string | null): Promise<Record<string, Record<string, unknown>>> {
        const normalizedScopeId = toScopeId(scopeId);
        if (Platform.OS === 'web') {
            const state = readWebState();
            return state.settings
                .filter((entry) => entry.scopeId === normalizedScopeId)
                .reduce<Record<string, Record<string, unknown>>>((result, entry) => {
                    result[entry.section] = parseDataJson<Record<string, unknown>>(entry.dataJson);
                    return result;
                }, {});
        }

        const db = await getDatabaseAsync();
        const rows = await db.getAllAsync<{ section: string; data_json: string }>(
            `SELECT section, data_json
             FROM offline_settings
             WHERE scope_id = ?`,
            normalizedScopeId
        );
        return rows.reduce<Record<string, Record<string, unknown>>>((result, entry) => {
            result[entry.section] = parseDataJson<Record<string, unknown>>(entry.data_json);
            return result;
        }, {});
    }

    async getSettingsSection(scopeId: string | null, section: string): Promise<Record<string, unknown>> {
        const all = await this.getSettingsMap(scopeId);
        return all[section] ?? {};
    }

    async setSettingsSection(scopeId: string | null, section: string, data: Record<string, unknown>): Promise<void> {
        const normalizedScopeId = toScopeId(scopeId);
        const updatedAt = new Date().toISOString();
        if (Platform.OS === 'web') {
            const state = readWebState();
            state.settings = state.settings.filter(
                (entry) => !(entry.scopeId === normalizedScopeId && entry.section === section)
            );
            state.settings.push({
                scopeId: normalizedScopeId,
                section,
                dataJson: JSON.stringify(data),
                updatedAt,
            });
            writeWebState(state);
            return;
        }

        await this.withNativeWrite(async (db) => {
            await db.runAsync(
                `INSERT OR REPLACE INTO offline_settings
                    (scope_id, section, data_json, updated_at)
                 VALUES (?, ?, ?, ?)`,
                normalizedScopeId,
                section,
                JSON.stringify(data),
                updatedAt
            );
        });
    }

    async getOutbox<T extends { id: string }>(scopeId: string | null): Promise<T[]> {
        const normalizedScopeId = toScopeId(scopeId);
        if (Platform.OS === 'web') {
            const state = readWebState();
            return state.outbox
                .filter((entry) => entry.scopeId === normalizedScopeId)
                .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
                .map((entry) => ({
                    id: entry.id,
                    type: entry.type,
                    payload: parseDataJson<unknown>(entry.payloadJson),
                    createdAt: entry.createdAt,
                    attemptCount: entry.attemptCount,
                    status: entry.status,
                    lastErrorCode: entry.lastErrorCode ?? undefined,
                    nextRetryAt: entry.nextRetryAt ?? undefined,
                    lastAttemptAt: entry.lastAttemptAt ?? undefined,
                    lastError: entry.lastError ?? undefined,
                } as unknown as T));
        }

        const db = await getDatabaseAsync();
        const rows = await db.getAllAsync<{
            id: string;
            type: string;
            payload_json: string;
            created_at: string;
            attempt_count: number;
            status: string;
            last_error_code: string | null;
            next_retry_at: number | null;
            last_attempt_at: string | null;
            last_error: string | null;
        }>(
            `SELECT id, type, payload_json, created_at, attempt_count, status, last_error_code, next_retry_at, last_attempt_at, last_error
             FROM offline_outbox
             WHERE scope_id = ?
             ORDER BY created_at ASC`,
            normalizedScopeId
        );
        return rows.map((entry) => ({
            id: entry.id,
            type: entry.type,
            payload: parseDataJson<unknown>(entry.payload_json),
            createdAt: entry.created_at,
            attemptCount: entry.attempt_count,
            status: entry.status,
            lastErrorCode: entry.last_error_code ?? undefined,
            nextRetryAt: entry.next_retry_at ?? undefined,
            lastAttemptAt: entry.last_attempt_at ?? undefined,
            lastError: entry.last_error ?? undefined,
        } as unknown as T));
    }

    async replaceOutbox<T extends {
        id: string;
        type: string;
        payload: unknown;
        createdAt: string;
        attemptCount: number;
        status?: string;
        lastErrorCode?: string;
        nextRetryAt?: number;
        lastAttemptAt?: string;
        lastError?: string;
    }>(scopeId: string | null, entries: T[]): Promise<void> {
        const normalizedScopeId = toScopeId(scopeId);
        const ordered = [...entries].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
        if (Platform.OS === 'web') {
            const state = readWebState();
            state.outbox = state.outbox.filter((entry) => entry.scopeId !== normalizedScopeId);
            state.outbox.push(
                ...ordered.map((entry) => ({
                    scopeId: normalizedScopeId,
                    id: entry.id,
                    type: entry.type,
                    payloadJson: JSON.stringify(entry.payload),
                    createdAt: entry.createdAt,
                    attemptCount: entry.attemptCount,
                    status: entry.status ?? 'pending',
                    lastErrorCode: entry.lastErrorCode ?? null,
                    nextRetryAt: entry.nextRetryAt ?? null,
                    lastAttemptAt: entry.lastAttemptAt ?? null,
                    lastError: entry.lastError ?? null,
                }))
            );
            writeWebState(state);
            return;
        }

        await this.withNativeWrite(async (db) => {
            await db.runAsync('DELETE FROM offline_outbox WHERE scope_id = ?', normalizedScopeId);
            for (const entry of ordered) {
                await db.runAsync(
                    `INSERT OR REPLACE INTO offline_outbox
                        (scope_id, id, type, payload_json, created_at, attempt_count, status, last_error_code, next_retry_at, last_attempt_at, last_error)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    normalizedScopeId,
                    entry.id,
                    entry.type,
                    JSON.stringify(entry.payload),
                    entry.createdAt,
                    entry.attemptCount,
                    entry.status ?? 'pending',
                    entry.lastErrorCode ?? null,
                    entry.nextRetryAt ?? null,
                    entry.lastAttemptAt ?? null,
                    entry.lastError ?? null
                );
            }
        });
    }

    async clearScope(scopeId: string | null): Promise<void> {
        const normalizedScopeId = toScopeId(scopeId);
        if (Platform.OS === 'web') {
            const state = readWebState();
            state.records = state.records.filter((entry) => entry.scopeId !== normalizedScopeId);
            state.settings = state.settings.filter((entry) => entry.scopeId !== normalizedScopeId);
            state.outbox = state.outbox.filter((entry) => entry.scopeId !== normalizedScopeId);
            writeWebState(state);
            return;
        }

        await this.withNativeWrite(async (db) => {
            await db.runAsync('DELETE FROM offline_records WHERE scope_id = ?', normalizedScopeId);
            await db.runAsync('DELETE FROM offline_settings WHERE scope_id = ?', normalizedScopeId);
            await db.runAsync('DELETE FROM offline_outbox WHERE scope_id = ?', normalizedScopeId);
        });
    }
}

export const offlineDomainDatabase = new OfflineDomainDatabase();
