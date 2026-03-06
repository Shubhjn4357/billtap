/**
 * useAppColors — reactive theme colors hook.
 *
 * Reads themeMode from themeStore and derives effective color scheme,
 * then returns `getColors(scheme)`. Because it subscribes to the Zustand
 * store, any component using this hook will re-render instantly when the
 * user changes the theme — no app restart required.
 *
 * Replace every pattern of:
 *   const scheme = useColorScheme() ?? 'light';
 *   const colors = getColors(scheme);
 * with:
 *   const colors = useAppColors();
 */

import { useColorScheme } from 'react-native';
import { type ColorPalette, getColors } from '../constants/theme';
import { useThemeStore } from '../store/themeStore';

export function useAppColors(): ColorPalette {
    const systemScheme = useColorScheme();
    const themeMode = useThemeStore((s) => s.themeMode);

    const effectiveScheme: 'light' | 'dark' =
        themeMode === 'light'
            ? 'light'
            : themeMode === 'dark'
                ? 'dark'
                : systemScheme === 'dark'
                    ? 'dark'
                    : 'light';

    return getColors(effectiveScheme);
}
