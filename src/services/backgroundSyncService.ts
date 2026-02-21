import NetInfo from '@react-native-community/netinfo';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { syncService } from './syncService';

/**
 * backgroundSyncService
 *
 * Registers a background task via expo-task-manager that flushes the offline
 * mutation queue whenever the device is online and the OS grants background time.
 * Also exports startForegroundSync/stopForegroundSync for active-app use.
 *
 * Does NOT import from expo-background-task directly to avoid enum-key issues
 * that vary between Expo SDK versions — instead uses TaskManager.defineTask
 * which is the stable low-level API.
 */

export const BACKGROUND_SYNC_TASK = 'vahi-background-sync';

let foregroundTimer: ReturnType<typeof setInterval> | null = null;

// ── Background Task Definition ─────────────────────────────────────────────────
// Must live at module top-level (not inside a function) for expo-task-manager.

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async (): Promise<void> => {
    try {
        const net = await NetInfo.fetch();
        if (!net.isConnected) return;
        await syncService.flushQueue();
    } catch {
        // Silent — OS will re-schedule on next interval
    }
});

// ── Registration ───────────────────────────────────────────────────────────────

/**
 * Registers the background sync task. Safe to call multiple times — noops if
 * already registered, unavailable on web, or running in dev mode.
 */
export async function registerBackgroundSync(): Promise<void> {
    if (__DEV__ || Platform.OS === 'web') return;

    try {
        const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (alreadyRegistered) return;

        // Use expo-background-task via dynamic import for graceful degradation
        // across SDK versions that differ in BackgroundTask vs BackgroundFetch API.
        const mod = await import('expo-background-task').catch(() => null);
        if (!mod) return;

        await mod.registerTaskAsync(BACKGROUND_SYNC_TASK, {
            minimumInterval: 15 * 60, // 15 minutes in seconds
        });
    } catch {
        // Background task registration may fail silently on some platforms
    }
}

export async function unregisterBackgroundSync(): Promise<void> {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (!isRegistered) return;
        const mod = await import('expo-background-task').catch(() => null);
        if (mod) await mod.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    } catch {
        // Ignore
    }
}

// ── Foreground Periodic Sync ───────────────────────────────────────────────────

/**
 * Start a periodic in-process sync loop (default: every 60 seconds).
 * Automatically flushes the offline queue when the device is online.
 */
export function startForegroundSync(intervalMs = 60_000): void {
    if (foregroundTimer !== null) return; // already running
    foregroundTimer = setInterval(async () => {
        try {
            const net = await NetInfo.fetch();
            if (net.isConnected) {
                await syncService.flushQueue();
            }
        } catch {
            // Silent
        }
    }, intervalMs);
}

export function stopForegroundSync(): void {
    if (foregroundTimer !== null) {
        clearInterval(foregroundTimer);
        foregroundTimer = null;
    }
}
