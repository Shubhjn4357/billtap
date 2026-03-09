import { useAppRuntime } from '../components/providers/AppRuntimeProvider';

export interface SyncStatus {
    pendingCount: number;
    blockedCount: number;
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    error: string | null;
    flush: () => Promise<void>;
    refresh: () => Promise<void>;
}

export function useSyncStatus(): SyncStatus {
    const {
        isOnline,
        isSyncing,
        lastSyncedAt,
        lastSyncError,
        syncStats,
        flushSyncQueue,
        refreshSyncState,
    } = useAppRuntime();

    return {
        pendingCount: syncStats.pendingCount,
        blockedCount: syncStats.blockedCount,
        isOnline,
        isSyncing,
        lastSyncedAt,
        error: lastSyncError,
        flush: async () => {
            await flushSyncQueue();
        },
        refresh: refreshSyncState,
    };
}
