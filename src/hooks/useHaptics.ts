
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

export const useHaptics = () => {
    const triggerSelection = useCallback(async () => {
        await Haptics.selectionAsync();
    }, []);

    const triggerImpact = useCallback(async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
        await Haptics.impactAsync(style);
    }, []);

    const triggerNotification = useCallback(async (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
        await Haptics.notificationAsync(type);
    }, []);

    return {
        triggerSelection,
        triggerImpact,
        triggerNotification
    };
};
