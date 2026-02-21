/**
 * Vahi Design System — Color Tokens (Material 3 Soft Palette)
 *
 * Philosophy: Soft, sophisticated, readable. Avoid garish primaries.
 * Light: warm off-white surfaces, muted indigo primary, soft teal accent.
 * Dark:  deep navy surfaces, pastel primaries.
 */

export const Colors = {
    light: {
        // Primary — Muted Indigo
        primary: '#5C6BC0',
        onPrimary: '#FFFFFF',
        primaryContainer: '#E8EAF6',
        onPrimaryContainer: '#1A237E',

        // Secondary — Soft Teal
        secondary: '#26A69A',
        onSecondary: '#FFFFFF',
        secondaryContainer: '#E0F2F1',
        onSecondaryContainer: '#004D40',

        // Tertiary — Muted Violet
        tertiary: '#7E57C2',
        onTertiary: '#FFFFFF',
        tertiaryContainer: '#EDE7F6',
        onTertiaryContainer: '#311B92',

        // Error
        error: '#C62828',
        onError: '#FFFFFF',
        errorContainer: '#FFCDD2',
        onErrorContainer: '#B71C1C',

        // Success (custom)
        success: '#2E7D32',
        successContainer: '#E8F5E9',
        onSuccessContainer: '#1B5E20',

        // Warning (custom)
        warning: '#E65100',
        warningContainer: '#FBE9E7',
        onWarningContainer: '#BF360C',

        // Backgrounds & Surfaces
        background: '#F5F6FA',
        onBackground: '#1C1B1F',
        surface: '#FFFFFF',
        onSurface: '#1C1B1F',
        surfaceVariant: '#F0F1F6',
        onSurfaceVariant: '#44464F',

        // Borders
        outline: '#767680',
        outlineVariant: '#CAC4D0',

        // Inverse
        inverseSurface: '#313033',
        inverseOnSurface: '#F4EFF4',
        inversePrimary: '#BABFE8',

        // Scrim / Shadow
        scrim: '#000000',

        elevation: {
            level0: 'transparent',
            level1: '#F2F3FA',
            level2: '#ECEEF6',
            level3: '#E6E8F3',
            level4: '#E4E6F2',
            level5: '#E0E3F0',
        },
    },
    dark: {
        // Primary — Pastel Indigo
        primary: '#9FA8DA',
        onPrimary: '#1A237E',
        primaryContainer: '#283593',
        onPrimaryContainer: '#C5CAE9',

        // Secondary — Pastel Teal
        secondary: '#80CBC4',
        onSecondary: '#004D40',
        secondaryContainer: '#00695C',
        onSecondaryContainer: '#B2DFDB',

        // Tertiary — Pastel Violet
        tertiary: '#CE93D8',
        onTertiary: '#4A148C',
        tertiaryContainer: '#6A1B9A',
        onTertiaryContainer: '#E1BEE7',

        // Error
        error: '#EF9A9A',
        onError: '#B71C1C',
        errorContainer: '#C62828',
        onErrorContainer: '#FFCDD2',

        // Success
        success: '#A5D6A7',
        successContainer: '#1B5E20',
        onSuccessContainer: '#C8E6C9',

        // Warning
        warning: '#FFAB91',
        warningContainer: '#BF360C',
        onWarningContainer: '#FFCCBC',

        // Backgrounds & Surfaces
        background: '#0E1117',
        onBackground: '#E6E1E5',
        surface: '#1C1F2E',
        onSurface: '#E6E1E5',
        surfaceVariant: '#252836',
        onSurfaceVariant: '#CAC4D0',

        // Borders
        outline: '#938F99',
        outlineVariant: '#332D41',

        // Inverse
        inverseSurface: '#E6E1E5',
        inverseOnSurface: '#313033',
        inversePrimary: '#5C6BC0',

        scrim: '#000000',

        elevation: {
            level0: 'transparent',
            level1: '#22253A',
            level2: '#272A42',
            level3: '#2C2F4A',
            level4: '#2E314C',
            level5: '#323552',
        },
    },
} as const;

export type ColorRole = keyof typeof Colors.light;
