import { useCallback, useState } from 'react';
import { useAppRuntime } from '../components/providers/AppRuntimeProvider';
import { offlineSyncService } from '../services/offlineSyncService';

export function useSyncQueueActions() {
    const { flushSyncQueue, refreshSyncState } = useAppRuntime();
    const [isFlushing, setIsFlushing] = useState(false);

    const flushNow = useCallback(async () => {
        setIsFlushing(true);
        try {
            await offlineSyncService.retryBlockedUpgradeMutations();
            const result = await flushSyncQueue();
            await refreshSyncState();
            return result;
        } finally {
            setIsFlushing(false);
        }
    }, [flushSyncQueue, refreshSyncState]);

    return {
        flushNow,
        isFlushing,
    };
}
