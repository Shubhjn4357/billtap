import { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { offlineSyncService } from '../services/offlineSyncService';

export interface SyncStatus {
    pendingCount: number;
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    error: string | null;
    flush: () => Promise<void>;
}

export function useSyncStatus(): SyncStatus {
    const [pendingCount, setPendingCount] = useState(0);
    const [isOnlineState, setIsOnlineState] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refreshStats = useCallback(async () => {
        const stats = await offlineSyncService.getQueueStats();
        setPendingCount(stats.pendingCount);
    }, []);

    const flush = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setError(null);
        try {
            const result = await offlineSyncService.flushQueue();
            if (result.processed > 0) {
                setLastSyncedAt(new Date());
            }
            await refreshStats();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sync failed');
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, refreshStats]);

    useEffect(() => {
        void refreshStats();
        const unsubscribe = NetInfo.addEventListener((state) => {
            const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
            setIsOnlineState(online);
            offlineSyncService.onNetworkStateChange(online);
            if (online) {
                void flush();
            }
        });
        return unsubscribe;
    }, [flush, refreshStats]);

    return {
        pendingCount,
        isOnline: isOnlineState,
        isSyncing,
        lastSyncedAt,
        error,
        flush,
    };
}

