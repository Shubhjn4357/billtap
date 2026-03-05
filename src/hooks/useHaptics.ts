import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

export function useHaptics() {
    const selection = useCallback(async () => {
        try {
            await Haptics.selectionAsync();
        } catch {
            // Ignore unsupported devices/platforms.
        }
    }, []);

    const impact = useCallback(async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
        try {
            await Haptics.impactAsync(style);
        } catch {
            // Ignore unsupported devices/platforms.
        }
    }, []);

    const notify = useCallback(async (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
        try {
            await Haptics.notificationAsync(type);
        } catch {
            // Ignore unsupported devices/platforms.
        }
    }, []);

    return {
        selection,
        impact,
        notify,
    };
}

