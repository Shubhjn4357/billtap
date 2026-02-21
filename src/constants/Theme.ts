import { MD3LightTheme, MD3DarkTheme, type MD3Theme } from 'react-native-paper';
import { Colors } from './Colors';

/**
 * Vahi Material 3 Theme Configuration
 * Exports lightTheme and darkTheme for PaperProvider.
 * All color tokens sourced from Colors.ts — no hardcoded hex here.
 */

export const lightTheme: MD3Theme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        // Primary
        primary: Colors.light.primary,
        onPrimary: Colors.light.onPrimary,
        primaryContainer: Colors.light.primaryContainer,
        onPrimaryContainer: Colors.light.onPrimaryContainer,

        // Secondary
        secondary: Colors.light.secondary,
        onSecondary: Colors.light.onSecondary,
        secondaryContainer: Colors.light.secondaryContainer,
        onSecondaryContainer: Colors.light.onSecondaryContainer,

        // Tertiary
        tertiary: Colors.light.tertiary,
        onTertiary: Colors.light.onTertiary,
        tertiaryContainer: Colors.light.tertiaryContainer,
        onTertiaryContainer: Colors.light.onTertiaryContainer,

        // Error
        error: Colors.light.error,
        onError: Colors.light.onError,
        errorContainer: Colors.light.errorContainer,
        onErrorContainer: Colors.light.onErrorContainer,

        // Background / Surface
        background: Colors.light.background,
        onBackground: Colors.light.onBackground,
        surface: Colors.light.surface,
        onSurface: Colors.light.onSurface,
        surfaceVariant: Colors.light.surfaceVariant,
        onSurfaceVariant: Colors.light.onSurfaceVariant,

        // Borders
        outline: Colors.light.outline,
        outlineVariant: Colors.light.outlineVariant,

        // Inverse
        inverseSurface: Colors.light.inverseSurface,
        inverseOnSurface: Colors.light.inverseOnSurface,
        inversePrimary: Colors.light.inversePrimary,

        // Scrim
        scrim: Colors.light.scrim,

        // Elevation surfaces (used internally by RNP components)
        elevation: Colors.light.elevation,
    },
};

export const darkTheme: MD3Theme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: Colors.dark.primary,
        onPrimary: Colors.dark.onPrimary,
        primaryContainer: Colors.dark.primaryContainer,
        onPrimaryContainer: Colors.dark.onPrimaryContainer,

        secondary: Colors.dark.secondary,
        onSecondary: Colors.dark.onSecondary,
        secondaryContainer: Colors.dark.secondaryContainer,
        onSecondaryContainer: Colors.dark.onSecondaryContainer,

        tertiary: Colors.dark.tertiary,
        onTertiary: Colors.dark.onTertiary,
        tertiaryContainer: Colors.dark.tertiaryContainer,
        onTertiaryContainer: Colors.dark.onTertiaryContainer,

        error: Colors.dark.error,
        onError: Colors.dark.onError,
        errorContainer: Colors.dark.errorContainer,
        onErrorContainer: Colors.dark.onErrorContainer,

        background: Colors.dark.background,
        onBackground: Colors.dark.onBackground,
        surface: Colors.dark.surface,
        onSurface: Colors.dark.onSurface,
        surfaceVariant: Colors.dark.surfaceVariant,
        onSurfaceVariant: Colors.dark.onSurfaceVariant,

        outline: Colors.dark.outline,
        outlineVariant: Colors.dark.outlineVariant,

        inverseSurface: Colors.dark.inverseSurface,
        inverseOnSurface: Colors.dark.inverseOnSurface,
        inversePrimary: Colors.dark.inversePrimary,

        scrim: Colors.dark.scrim,

        elevation: Colors.dark.elevation,
    },
};

/** Utility: pick theme by mode string */
export function getThemeByMode(mode: 'light' | 'dark' | 'system', systemIsDark: boolean): MD3Theme {
    if (mode === 'system') return systemIsDark ? darkTheme : lightTheme;
    return mode === 'dark' ? darkTheme : lightTheme;
}
