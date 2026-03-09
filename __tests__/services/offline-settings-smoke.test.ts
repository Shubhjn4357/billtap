import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsRepository } from '../../src/repositories/settingsRepository';
import { offlineSyncService } from '../../src/services/offlineSyncService';
import { queryClient } from '../../src/state/queryClient';

const kvMemory = new Map<string, string>();

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPutMock = vi.fn();
const apiPatchMock = vi.fn();
const apiDeleteMock = vi.fn();

vi.mock('../../src/offline/db/offlineKeyValueStore', () => ({
    offlineKeyValueStore: {
        getBackendName: () => 'expo-sqlite-kv-store',
        getItem: async (key: string) => (kvMemory.has(key) ? kvMemory.get(key)! : null),
        setItem: async (key: string, value: string) => {
            kvMemory.set(key, value);
        },
        removeItem: async (key: string) => {
            kvMemory.delete(key);
        },
        multiRemove: async (keys: string[]) => {
            for (const key of keys) kvMemory.delete(key);
        },
    },
}));

vi.mock('../../src/utils/network', () => ({
    isOnline: async () => false,
}));

vi.mock('../../src/api/client', () => ({
    api: {
        get: (...args: unknown[]) => apiGetMock(...args),
        post: (...args: unknown[]) => apiPostMock(...args),
        put: (...args: unknown[]) => apiPutMock(...args),
        patch: (...args: unknown[]) => apiPatchMock(...args),
        delete: (...args: unknown[]) => apiDeleteMock(...args),
    },
    toUserMessage: (error: unknown, fallback = 'Something went wrong') => {
        if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
            return (error as { message: string }).message;
        }
        return fallback;
    },
}));


describe('offline settings smoke', () => {
    beforeEach(async () => {
        kvMemory.clear();
        apiGetMock.mockReset();
        apiPostMock.mockReset();
        apiPutMock.mockReset();
        apiPatchMock.mockReset();
        apiDeleteMock.mockReset();
        queryClient.clear();
        await offlineSyncService.clearAllLocalData();
    });

    it('applies settings immediately locally, merges with cache, and queues merged payload', async () => {
        await offlineSyncService.setCachedSettingsSection('GENERAL', {
            theme_mode: 'DARK',
            sync_auto_interval_sec: 60,
        });

        const result = await settingsRepository.update('GENERAL', {
            data: {
                sync_conflict_policy: 'SERVER_WINS',
            },
        });

        expect(result.ok).toBe(true);
        expect(result.data).toMatchObject({
            theme_mode: 'DARK',
            sync_auto_interval_sec: 60,
            sync_conflict_policy: 'SERVER_WINS',
        });

        const cached = await offlineSyncService.getCachedSettingsSection('GENERAL');
        expect(cached).toMatchObject({
            theme_mode: 'DARK',
            sync_auto_interval_sec: 60,
            sync_conflict_policy: 'SERVER_WINS',
        });

        const queryState = queryClient.getQueryData<{ ok: boolean; data: Record<string, unknown> }>([
            'settings-section',
            'GENERAL',
        ]);
        expect(queryState?.ok).toBe(true);
        expect(queryState?.data).toMatchObject({
            theme_mode: 'DARK',
            sync_auto_interval_sec: 60,
            sync_conflict_policy: 'SERVER_WINS',
        });

        const queue = await offlineSyncService.getQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.type).toBe('update_settings_section');
        if (queue[0]?.type === 'update_settings_section') {
            expect(queue[0].payload.section).toBe('GENERAL');
            expect(queue[0].payload.data).toMatchObject({
                theme_mode: 'DARK',
                sync_auto_interval_sec: 60,
                sync_conflict_policy: 'SERVER_WINS',
            });
        }
    });

    it('falls back to cached section when server get fails and keeps query cache in sync', async () => {
        await offlineSyncService.setCachedSettingsSection('SECURITY', {
            role_access_mode: 'OWNER_ONLY',
        });
        apiGetMock.mockRejectedValueOnce(new Error('network down'));

        const result = await settingsRepository.get('SECURITY');

        expect(result.ok).toBe(true);
        expect(result.data).toMatchObject({
            role_access_mode: 'OWNER_ONLY',
        });

        const queryState = queryClient.getQueryData<{ ok: boolean; data: Record<string, unknown> }>([
            'settings-section',
            'SECURITY',
        ]);
        expect(queryState?.data).toMatchObject({
            role_access_mode: 'OWNER_ONLY',
        });
    });
});
