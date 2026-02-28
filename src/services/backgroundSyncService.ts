import NetInfo from '@react-native-community/netinfo';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { offlineSyncService } from './offlineSyncService';
import { notifySyncComplete } from './notificationService';

export const BACKGROUND_SYNC_TASK = 'vahi-background-sync';

let foregroundTimer: ReturnType<typeof setInterval> | null = null;

const isTaskDefined =
    typeof (TaskManager as unknown as { isTaskDefined?: (name: string) => boolean }).isTaskDefined === 'function'
        ? (TaskManager as unknown as { isTaskDefined: (name: string) => boolean }).isTaskDefined(BACKGROUND_SYNC_TASK)
        : false;

if (Platform.OS !== 'web' && !isTaskDefined) {
    TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
        try {
            const net = await NetInfo.fetch();
            if (!net.isConnected) return;
            const result = await offlineSyncService.flushQueue();
            if (result.processed > 0) {
                await notifySyncComplete(result.processed);
            }
        } catch {
            // best-effort background sync only
        }
    });
}

export async function registerBackgroundSync(): Promise<void> {
    if (__DEV__ || Platform.OS === 'web') return;
    try {
        const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (registered) return;

        const module = await import('expo-background-task').catch(() => null);
        if (!module) return;
        await module.registerTaskAsync(BACKGROUND_SYNC_TASK, {
            minimumInterval: 15 * 60,
        });
    } catch {
        // ignored
    }
}

export async function unregisterBackgroundSync(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
        const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (!registered) return;
        const module = await import('expo-background-task').catch(() => null);
        if (!module) return;
        await module.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    } catch {
        // ignored
    }
}

export function startForegroundSync(intervalMs = 60_000): void {
    if (foregroundTimer) return;
    foregroundTimer = setInterval(async () => {
        try {
            const net = await NetInfo.fetch();
            if (!net.isConnected) return;
            const result = await offlineSyncService.flushQueue();
            if (result.processed > 0) {
                await notifySyncComplete(result.processed);
            }
        } catch {
            // ignored
        }
    }, intervalMs);
}

export function stopForegroundSync(): void {
    if (!foregroundTimer) return;
    clearInterval(foregroundTimer);
    foregroundTimer = null;
}
