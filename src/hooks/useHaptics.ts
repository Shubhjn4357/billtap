
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

export const useHaptics = () => {
    const triggerSelection = useCallback(async () => {
        try {
            await Haptics.selectionAsync();
        } catch {
            // Ignore unsupported platforms.
        }
    }, []);

    const triggerImpact = useCallback(async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
        try {
            await Haptics.impactAsync(style);
        } catch {
            // Ignore unsupported platforms.
        }
    }, []);

    const triggerNotification = useCallback(async (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
        try {
            await Haptics.notificationAsync(type);
        } catch {
            // Ignore unsupported platforms.
        }
    }, []);

    return {
        triggerSelection,
        triggerImpact,
        triggerNotification
    };
};
