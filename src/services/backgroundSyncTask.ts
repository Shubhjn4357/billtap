import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { offlineSyncService } from './offlineSyncService';
import { isOnline } from '../utils/network';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

// Define the task in the global scope so Expo TaskManager can register it natively
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
        const hasInternet = await isOnline();
        if (!hasInternet) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const queue = await offlineSyncService.getQueue();
        if (queue.length === 0) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Trigger the sync flush
        await offlineSyncService.flushQueue();

        const remainingQueue = await offlineSyncService.getQueue();
        const pendingCount = remainingQueue.filter(item => !item.status || item.status === 'pending' || item.status === 'retrying').length;

        if (pendingCount === 0) {
            return BackgroundFetch.BackgroundFetchResult.NewData;
        } else {
            // Some things failed or are still pending
            return BackgroundFetch.BackgroundFetchResult.Failed;
        }
    } catch (error) {
        console.error('Background sync task failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export const backgroundSyncManager = {
    register: async () => {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
            if (!isRegistered) {
                await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
                    minimumInterval: 15 * 60, // 15 minutes minimum interval between executions
                    stopOnTerminate: false, // Continue running after app is terminated (Android only)
                    startOnBoot: true,      // Start automatically on device boot (Android only)
                });
                console.log('Background sync task registered successfully.');
            }
        } catch (error) {
            console.error('Failed to register background sync task:', error);
        }
    },
    unregister: async () => {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
            if (isRegistered) {
                await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
                console.log('Background sync task unregistered.');
            }
        } catch (error) {
            console.error('Failed to unregister background sync task:', error);
        }
    },
    getStatus: async () => {
        try {
            return await BackgroundFetch.getStatusAsync();
        } catch (_error) {
            return null;
        }
    }
};
