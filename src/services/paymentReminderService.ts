import * as Notifications from 'expo-notifications';
import { transactionService } from '../api/transactionService';
import { useSettingsStore } from '../store';

const REMINDER_TAG = 'billtap_payment_reminder';
const MAX_SCHEDULE = 64;

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

const normalizeDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const paymentReminderService = {
    async syncPendingPaymentReminders(): Promise<void> {
        try {
            const permission = await Notifications.getPermissionsAsync();
            if (!permission.granted) {
                const requested = await Notifications.requestPermissionsAsync();
                if (!requested.granted) return;
            }

            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            const existingReminderIds = scheduled
                .filter((entry) => entry.content.data?.tag === REMINDER_TAG)
                .map((entry) => entry.identifier);

            await Promise.all(existingReminderIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

            const reminders = await transactionService.getPendingReminders();
            const limited = reminders.slice(0, MAX_SCHEDULE);
            const now = Date.now();
            const soundEnabled = useSettingsStore.getState().notificationSoundEnabled;

            for (const reminder of limited) {
                const baseDate = normalizeDate(reminder.nextReminderAt) ?? normalizeDate(reminder.dueDate);
                if (!baseDate) continue;

                const triggerDate = new Date(Math.max(baseDate.getTime(), now + 60 * 1000));
                const title = 'Pending Payment Reminder';
                const body = reminder.partyName
                    ? `Collect ${reminder.currency} ${reminder.dueAmount.toFixed(2)} from ${reminder.partyName}.`
                    : `Collect pending amount ${reminder.currency} ${reminder.dueAmount.toFixed(2)}.`;

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title,
                        body,
                        sound: soundEnabled ? 'default' : undefined,
                        data: {
                            tag: REMINDER_TAG,
                            transactionId: reminder.id,
                            paymentStatus: reminder.paymentStatus,
                            dueAmount: reminder.dueAmount,
                        },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: triggerDate,
                    },
                });
            }
        } catch {
            // Best-effort reminder scheduling only.
        }
    },
};
