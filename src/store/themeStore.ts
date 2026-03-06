import { create } from 'zustand';
import { setThemePreference, type ThemePreference } from '../constants/theme';

type ThemeStore = {
    themeMode: ThemePreference;
    hapticsEnabled: boolean;
    richMotionEnabled: boolean;

    setThemeMode: (mode: ThemePreference) => void;
    setHapticsEnabled: (enabled: boolean) => void;
    setRichMotionEnabled: (enabled: boolean) => void;
    hydrate: (prefs: { themeMode: ThemePreference; hapticsEnabled: boolean; richMotionEnabled: boolean }) => void;
};

export const useThemeStore = create<ThemeStore>((set) => ({
    themeMode: 'system',
    hapticsEnabled: true,
    richMotionEnabled: true,

    setThemeMode: (mode) => {
        setThemePreference(mode);
        set({ themeMode: mode });
    },

    setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),

    setRichMotionEnabled: (enabled) => set({ richMotionEnabled: enabled }),

    hydrate: ({ themeMode, hapticsEnabled, richMotionEnabled }) => {
        setThemePreference(themeMode);
        set({ themeMode, hapticsEnabled, richMotionEnabled });
    },
}));
