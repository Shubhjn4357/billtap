import * as Notifications from 'expo-notifications';
import { randomUUID } from 'expo-crypto';
import { and, desc, eq } from 'drizzle-orm';
import { Platform } from 'react-native';

import { db } from '../db/client';
import { notifications as notificationsTable } from '../db/schema';
import { useSettingsStore } from '../store';

export type NotificationInboxEntry = typeof notificationsTable.$inferSelect;
export type NotificationKind = 'info' | 'alert' | 'success' | 'reminder' | 'system';

const PURCHASE_REMINDER_LINES = [
    'Record today\'s purchase invoices before day close.',
    'Keep your purchase ledger updated for accurate stock cost.',
    'Review inward entries and save pending supplier bills.',
];

const TAGLINE_PRESETS = [
    'Trusted quality, transparent billing.',
    'Fast billing. Better business.',
    'Serving with trust, every transaction.',
    'Reliable stock. Smarter sales.',
    'Your business partner in every bill.',
];

const SCHEDULE_KEYS = {
    purchaseReminder: 'billtap_purchase_daily_reminder_v1',
    taglineReminder: 'billtap_tagline_daily_reminder_v1',
} as const;

Notifications.setNotificationHandler({
    handleNotification: async () => {
        const soundEnabled = useSettingsStore.getState().notificationSoundEnabled;
        return {
            shouldShowAlert: true,
            shouldPlaySound: soundEnabled,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        };
    },
});

const canUseNotifications = (): boolean => Platform.OS !== 'web';

const resolveSound = (): 'default' | undefined => {
    return useSettingsStore.getState().notificationSoundEnabled ? 'default' : undefined;
};

const normalizeKind = (value: unknown): NotificationKind => {
    if (
        value === 'info'
        || value === 'alert'
        || value === 'success'
        || value === 'reminder'
        || value === 'system'
    ) {
        return value;
    }
    return 'info';
};

const upsertInboxNotification = async (entry: {
    id: string;
    title: string;
    message: string;
    type?: NotificationKind;
    isRead?: boolean;
    createdAt?: string;
}): Promise<void> => {
    if (Platform.OS === 'web') return;

    const payload = {
        id: entry.id,
        title: entry.title.trim() || 'Notification',
        message: entry.message.trim() || 'Open app to view details.',
        type: entry.type ?? 'info',
        isRead: entry.isRead ?? false,
        createdAt: entry.createdAt ?? new Date().toISOString(),
    };

    await db
        .insert(notificationsTable)
        .values(payload)
        .onConflictDoUpdate({
            target: notificationsTable.id,
            set: {
                title: payload.title,
                message: payload.message,
                type: payload.type,
                isRead: payload.isRead,
                createdAt: payload.createdAt,
            },
        });
};

export async function saveNotificationInboxEntry(entry: {
    id?: string;
    title: string;
    message: string;
    type?: NotificationKind;
    isRead?: boolean;
    createdAt?: string;
}): Promise<void> {
    await upsertInboxNotification({
        id: entry.id ?? randomUUID(),
        title: entry.title,
        message: entry.message,
        type: entry.type,
        isRead: entry.isRead,
        createdAt: entry.createdAt,
    });
}

const pickPresetByDate = (values: readonly string[]): string => {
    if (values.length === 0) return '';
    const day = new Date().getDate();
    return values[day % values.length];
};

const cancelScheduledByKey = async (scheduleKey: string): Promise<void> => {
    if (!canUseNotifications()) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const targets = scheduled
        .filter((entry) => entry.content.data?.scheduleKey === scheduleKey)
        .map((entry) => entry.identifier);

    if (targets.length === 0) return;
    await Promise.all(targets.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
};

const scheduleCore = async (params: {
    title: string;
    body: string;
    channelId: string;
    trigger?: Notifications.NotificationTriggerInput | null;
    data?: Record<string, unknown>;
    type?: NotificationKind;
    scheduleKey?: string;
    inboxId?: string;
    persistImmediately?: boolean;
}): Promise<string> => {
    const {
        title,
        body,
        channelId,
        trigger = null,
        data = {},
        type = 'info',
        scheduleKey,
        inboxId,
        persistImmediately = trigger === null,
    } = params;

    const entryId = inboxId ?? randomUUID();

    if (!canUseNotifications()) {
        if (persistImmediately) {
            await upsertInboxNotification({
                id: entryId,
                title,
                message: body,
                type,
            });
        }
        return entryId;
    }

    if (scheduleKey) {
        await cancelScheduledByKey(scheduleKey);
    }

    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
        const requested = await Notifications.requestPermissionsAsync();
        if (!requested.granted) {
            if (persistImmediately) {
                await upsertInboxNotification({
                    id: entryId,
                    title,
                    message: body,
                    type,
                });
            }
            return entryId;
        }
    }

    const identifier = await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: resolveSound(),
            ...(Platform.OS === 'android' ? { channelId } : {}),
            data: {
                ...data,
                type,
                scheduleKey,
            },
        } as Notifications.NotificationContentInput,
        trigger,
    });

    if (persistImmediately) {
        await upsertInboxNotification({
            id: inboxId ?? identifier,
            title,
            message: body,
            type,
        });
    }

    return identifier;
};

const persistFromDeliveredNotification = async (
    notification: Notifications.Notification
): Promise<void> => {
    const request = notification.request;
    const content = request.content;
    const title = (content.title ?? '').trim() || 'Notification';
    const body = (content.body ?? '').trim() || 'Open app to view details.';
    const type = normalizeKind(content.data?.type);
    const id = request.identifier || randomUUID();

    await upsertInboxNotification({
        id,
        title,
        message: body,
        type,
        isRead: false,
        createdAt: new Date().toISOString(),
    });
};

export async function requestNotificationPermissions(): Promise<boolean> {
    if (!canUseNotifications()) return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

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
    await Notifications.setNotificationChannelAsync('operations', {
        name: 'Operations Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
    });
}

/**
 * Register listeners that persist delivered notifications to local inbox.
 * Returns cleanup function.
 */
export function registerNotificationListeners(): () => void {
    if (!canUseNotifications()) {
        return () => {};
    }

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
        void persistFromDeliveredNotification(notification);
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        void persistFromDeliveredNotification(response.notification);
    });

    return () => {
        receivedSub.remove();
        responseSub.remove();
    };
}

/**
 * Notify about a payment due from a party.
 */
export async function notifyPaymentDue(params: {
    partyName: string;
    amount: string;
    daysOverdue: number;
    transactionId?: string;
}): Promise<void> {
    await scheduleCore({
        title: `Payment Due - ${params.partyName}`,
        body: `${params.amount} overdue by ${params.daysOverdue} day(s). Tap to view.`,
        channelId: 'billing',
        type: 'reminder',
        data: { transactionId: params.transactionId },
    });
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
    await scheduleCore({
        title: `Low Stock - ${params.itemName}`,
        body: `Only ${params.qty} ${params.unit} remaining. Consider restocking.`,
        channelId: 'stock',
        type: 'alert',
        data: { itemId: params.itemId },
    });
}

/**
 * Schedule the daily sales summary at a given hour.
 */
export async function scheduleDailySummary(params: {
    todaySales: string;
    todayPurchases: string;
    hour?: number;
    minute?: number;
}): Promise<void> {
    await scheduleCore({
        title: 'Daily Business Summary',
        body: `Sales: ${params.todaySales} | Purchases: ${params.todayPurchases}`,
        channelId: 'summary',
        type: 'info',
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: params.hour ?? 20,
            minute: params.minute ?? 0,
        },
        scheduleKey: 'billtap_daily_summary_v1',
        inboxId: 'billtap_daily_summary_v1',
        persistImmediately: false,
    });
}

/**
 * Schedule daily purchase-entry reminder with a pre-made message.
 */
export async function schedulePurchaseReminder(params?: {
    businessName?: string;
    hour?: number;
    minute?: number;
}): Promise<void> {
    const line = pickPresetByDate(PURCHASE_REMINDER_LINES);
    const businessName = params?.businessName?.trim() || 'Your Business';

    await scheduleCore({
        title: 'Purchase Reminder',
        body: `${businessName}: ${line}`,
        channelId: 'operations',
        type: 'reminder',
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: params?.hour ?? 18,
            minute: params?.minute ?? 30,
        },
        scheduleKey: SCHEDULE_KEYS.purchaseReminder,
        inboxId: SCHEDULE_KEYS.purchaseReminder,
        persistImmediately: false,
    });
}

/**
 * Schedule daily tagline suggestion reminder using pre-made tagline presets.
 */
export async function schedulePremadeTaglineReminder(params?: {
    hour?: number;
    minute?: number;
}): Promise<void> {
    const tagline = pickPresetByDate(TAGLINE_PRESETS);

    await scheduleCore({
        title: 'Brand Tagline Suggestion',
        body: `Try this pre-made tagline: "${tagline}"`,
        channelId: 'operations',
        type: 'info',
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: params?.hour ?? 11,
            minute: params?.minute ?? 45,
        },
        scheduleKey: SCHEDULE_KEYS.taglineReminder,
        inboxId: SCHEDULE_KEYS.taglineReminder,
        persistImmediately: false,
    });
}

/**
 * Ensure core daily schedules are present (purchase + tagline presets).
 */
export async function ensureCoreScheduledNotifications(params?: {
    businessName?: string;
}): Promise<void> {
    if (!canUseNotifications()) return;
    await schedulePurchaseReminder({ businessName: params?.businessName });
    await schedulePremadeTaglineReminder();
}

/**
 * Fire an immediate notification when offline data is synced.
 */
export async function notifySyncComplete(pendingCount: number): Promise<void> {
    if (pendingCount === 0) return;
    await scheduleCore({
        title: 'Sync Complete',
        body: `${pendingCount} offline change(s) synced to the cloud.`,
        channelId: 'sync',
        type: 'system',
    });
}

/**
 * Generic app-level event notification helper.
 */
export async function notifyAppEvent(
    title: string,
    body: string,
    options?: {
        channelId?: 'billing' | 'stock' | 'sync' | 'summary' | 'operations';
        type?: NotificationKind;
        data?: Record<string, unknown>;
    }
): Promise<void> {
    await scheduleCore({
        title,
        body,
        channelId: options?.channelId ?? 'sync',
        type: options?.type ?? 'info',
        data: options?.data,
    });
}

export async function getNotificationInbox(limit = 300): Promise<NotificationInboxEntry[]> {
    if (Platform.OS === 'web') return [];
    return await db
        .select()
        .from(notificationsTable)
        .orderBy(desc(notificationsTable.createdAt))
        .limit(Math.max(1, Math.min(limit, 1000)));
}

export async function markNotificationAsRead(id: string): Promise<void> {
    if (Platform.OS === 'web') return;
    await db
        .update(notificationsTable)
        .set({ isRead: true })
        .where(eq(notificationsTable.id, id));
}

export async function markAllNotificationsAsRead(): Promise<void> {
    if (Platform.OS === 'web') return;
    await db
        .update(notificationsTable)
        .set({ isRead: true })
        .where(and(eq(notificationsTable.isRead, false)));
}

export async function setBadgeCount(count: number): Promise<void> {
    if (!canUseNotifications()) return;
    await Notifications.setBadgeCountAsync(Math.max(0, count));
}

export async function clearBadge(): Promise<void> {
    if (!canUseNotifications()) return;
    await Notifications.setBadgeCountAsync(0);
}

export async function cancelAllScheduled(): Promise<void> {
    if (!canUseNotifications()) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
}
