import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

const canUseNotifications = () => Platform.OS !== 'web';

export async function requestNotificationPermissions(): Promise<boolean> {
    if (!canUseNotifications()) return false;
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
}

export async function registerAndroidChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('sync', {
        name: 'Sync Notifications',
        importance: Notifications.AndroidImportance.LOW,
    });
    await Notifications.setNotificationChannelAsync('billing', {
        name: 'Billing Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
    });
}

export async function notifySyncComplete(processedCount: number): Promise<void> {
    if (!canUseNotifications()) return;
    if (processedCount <= 0) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Vahi Sync Complete',
            body: `${processedCount} offline change(s) synced.`,
            ...(Platform.OS === 'android' ? { channelId: 'sync' } : {}),
        },
        trigger: null,
    });
}

export async function notifyLowStockAlert(itemName: string, currentStock: number, reorderLevel: number): Promise<void> {
    if (!canUseNotifications()) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Low Stock Alert',
            body: `${itemName} stock has dropped to ${currentStock} (Reorder level: ${reorderLevel}). Please restock.`,
            ...(Platform.OS === 'android' ? { channelId: 'billing' } : {}),
            sound: true,
        },
        trigger: null,
    });
}

export function registerNotificationListeners(): () => void {
    if (!canUseNotifications()) return () => {};
    const received = Notifications.addNotificationReceivedListener(() => {
        // reserved for inbox wiring
    });
    const responded = Notifications.addNotificationResponseReceivedListener(() => {
        // reserved for deep link handling
    });
    return () => {
        received.remove();
        responded.remove();
    };
}

