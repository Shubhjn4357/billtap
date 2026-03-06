import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../store/themeStore';

export function useHaptics() {
    const hapticsEnabled = useThemeStore((s) => s.hapticsEnabled);

    const selection = useCallback(async () => {
        if (!hapticsEnabled) return;
        try {
            await Haptics.selectionAsync();
        } catch {
            // Ignore unsupported devices/platforms.
        }
    }, [hapticsEnabled]);

    const impact = useCallback(async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
        if (!hapticsEnabled) return;
        try {
            await Haptics.impactAsync(style);
        } catch {
            // Ignore unsupported devices/platforms.
        }
    }, [hapticsEnabled]);

    const notify = useCallback(async (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
        if (!hapticsEnabled) return;
        try {
            await Haptics.notificationAsync(type);
        } catch {
            // Ignore unsupported devices/platforms.
        }
    }, [hapticsEnabled]);

    return {
        selection,
        impact,
        notify,
    };
}

