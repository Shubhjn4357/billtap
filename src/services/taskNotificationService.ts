import * as Notifications from 'expo-notifications';
import { useSettingsStore } from '../store';

export const taskNotificationService = {
    async notify(title: string, body: string): Promise<void> {
        try {
            const soundEnabled = useSettingsStore.getState().notificationSoundEnabled;
            if (!soundEnabled) return;

            const permission = await Notifications.getPermissionsAsync();
            if (!permission.granted) {
                const requested = await Notifications.requestPermissionsAsync();
                if (!requested.granted) return;
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: 'default',
                    data: { tag: 'billtap_task_notification' },
                },
                trigger: null,
            });
        } catch {
            // Ignore optional task notification failures.
        }
    },
};
