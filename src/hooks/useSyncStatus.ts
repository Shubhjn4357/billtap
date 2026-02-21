import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { syncService } from '../services/syncService';

interface SyncStatus {
    pendingCount: number;
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    error: string | null;
    flush: () => Promise<void>;
}

/**
 * useSyncStatus — reactive sync queue status with auto-flush on reconnection.
 *
 * Returns real-time pending mutation count, online status, and a manual flush function.
 * Auto-flushes when the device transitions from offline → online.
 */
export function useSyncStatus(): SyncStatus {
    const [pendingCount, setPendingCount] = useState(0);
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const wasOfflineRef = useRef(false);

    // Refresh queue stats
    const refreshStats = useCallback(async () => {
        try {
            const stats = await syncService.getQueueStats();
            setPendingCount(stats.pendingCount);
        } catch {
            // Non-critical
        }
    }, []);

    // Manual flush
    const flush = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setError(null);
        try {
            await syncService.flushQueue();
            setLastSyncedAt(new Date());
            await refreshStats();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Sync failed');
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, refreshStats]);

    // NetInfo listener — auto-flush on reconnect
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            const online = state.isConnected === true;
            setIsOnline(online);

            if (online && wasOfflineRef.current && pendingCount > 0) {
                void flush();
            }
            wasOfflineRef.current = !online;
        });

        void refreshStats();

        return () => unsubscribe();
    }, [flush, pendingCount, refreshStats]);

    return { pendingCount, isOnline, isSyncing, lastSyncedAt, error, flush };
}
