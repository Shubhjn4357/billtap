import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
    requestNotificationPermissions,
    registerAndroidChannels,
    notifyLowStock,
    setBadgeCount,
} from '../services/notificationService';
import type { Item } from '../types';

interface UseNotificationTriggersOptions {
    items: Item[];
    pendingPaymentsCount?: number;
    enabled?: boolean;
}

/**
 * useNotificationTriggers
 *
 * Observes inventory and payment state and fires appropriate notifications.
 * Re-evaluates whenever items or pendingPaymentsCount changes.
 * Requests permissions on first mount.
 */
export function useNotificationTriggers({
    items,
    pendingPaymentsCount = 0,
    enabled = true,
}: UseNotificationTriggersOptions): void {
    const notifiedItemIds = useRef<Set<string>>(new Set());
    const permissionsGrantedRef = useRef(false);

    useEffect(() => {
        if (!enabled || Platform.OS === 'web') return;

        const setup = async () => {
            const granted = await requestNotificationPermissions();
            permissionsGrantedRef.current = granted;
            if (granted) {
                await registerAndroidChannels();
            }
        };
        void setup();
    }, [enabled]);

    // Watch for new low/out-of-stock items
    useEffect(() => {
        if (!enabled || !permissionsGrantedRef.current) return;

        const trigger = async () => {
            for (const item of items) {
                if (notifiedItemIds.current.has(item.id)) continue;
                if (item.stock <= (item.minimumStock ?? 5)) {
                    notifiedItemIds.current.add(item.id);
                    await notifyLowStock({
                        itemName: item.name,
                        qty: item.stock,
                        unit: item.unit ?? 'units',
                        itemId: item.id,
                    });
                }
            }
        };
        void trigger();
    }, [enabled, items]);

    // Update badge with pending payment count
    useEffect(() => {
        if (!enabled || Platform.OS === 'web') return;
        void setBadgeCount(pendingPaymentsCount);
    }, [enabled, pendingPaymentsCount]);
}
