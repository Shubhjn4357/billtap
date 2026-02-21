import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * notificationService
 *
 * Wraps expo-notifications with Vahi-specific templates.
 * All templates derive text from static values — no hardcoded strings in callers.
 */

// ── Configuration ─────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

// ── Android Channels ──────────────────────────────────────────────────────────

export async function registerAndroidChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('billing', {
        name: 'Billing Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5C6BC0',
    });
    await Notifications.setNotificationChannelAsync('stock', {
        name: 'Stock Alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync('sync', {
        name: 'Sync Notifications',
        importance: Notifications.AndroidImportance.LOW,
    });
    await Notifications.setNotificationChannelAsync('summary', {
        name: 'Daily Summary',
        importance: Notifications.AndroidImportance.DEFAULT,
    });
}

// ── Shared Helper ─────────────────────────────────────────────────────────────

async function schedule(
    title: string,
    body: string,
    channelId: string,
    trigger?: Notifications.NotificationTriggerInput,
    data?: Record<string, unknown>
): Promise<string> {
    return Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data ?? {},
            ...(Platform.OS === 'android' ? { channelId } : {}),
        } as Notifications.NotificationContentInput,
        trigger: trigger ?? null,
    });
}

// ── Pre-made Templates ────────────────────────────────────────────────────────

/**
 * Notify about a payment due from a party.
 */
export async function notifyPaymentDue(params: {
    partyName: string;
    amount: string;
    daysOverdue: number;
    transactionId?: string;
}): Promise<void> {
    await schedule(
        `💰 Payment Due — ${params.partyName}`,
        `₹${params.amount} overdue by ${params.daysOverdue} day(s). Tap to view.`,
        'billing',
        null,
        { transactionId: params.transactionId }
    );
}

/**
 * Notify about low stock on an item.
 */
export async function notifyLowStock(params: {
    itemName: string;
    qty: number;
    unit: string;
    itemId?: string;
}): Promise<void> {
    await schedule(
        `📦 Low Stock — ${params.itemName}`,
        `Only ${params.qty} ${params.unit} remaining. Consider restocking.`,
        'stock',
        null,
        { itemId: params.itemId }
    );
}

/**
 * Schedule the daily sales summary at a given hour (default 8pm local time).
 */
export async function scheduleDailySummary(params: {
    todaySales: string;
    todayPurchases: string;
    hour?: number;
    minute?: number;
}): Promise<void> {
    await schedule(
        '📊 Daily Business Summary',
        `Sales: ${params.todaySales} · Purchases: ${params.todayPurchases}`,
        'summary',
        {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: params.hour ?? 20,
            minute: params.minute ?? 0,
        }
    );
}

/**
 * Fire an immediate notification when offline data is synced.
 */
export async function notifySyncComplete(pendingCount: number): Promise<void> {
    if (pendingCount === 0) return;
    await schedule(
        '☁️ Sync Complete',
        `${pendingCount} offline change(s) synced to the cloud.`,
        'sync'
    );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

export async function setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
}

export async function clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
}

export async function cancelAllScheduled(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
}
