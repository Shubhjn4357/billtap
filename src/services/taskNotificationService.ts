import { notifyAppEvent } from './notificationService';

export const taskNotificationService = {
    async notify(title: string, body: string): Promise<void> {
        try {
            await notifyAppEvent(title, body, {
                channelId: 'sync',
                type: 'system',
                data: { tag: 'billtap_task_notification' },
            });
        } catch {
            // Ignore optional task notification failures.
        }
    },
};
