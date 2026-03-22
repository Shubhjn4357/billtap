import { Platform, type ViewStyle } from 'react-native';
import { Radius, withAlpha, type ColorPalette } from './theme';

type ShadowLevel = 'soft' | 'raised' | 'floating';
type GlowLevel = 'soft' | 'medium';

export const DESIGN_SPACING = {
    screenX: 18,
    sectionGap: 18,
    cardGap: 10,
} as const;

export const getShadowStyle = (
    colors: ColorPalette,
    level: ShadowLevel = 'soft'
): ViewStyle => {
    const recipe =
        level === 'floating'
            ? { opacity: 0.12, radius: 20, y: 12, elevation: 10 }
            : level === 'raised'
                ? { opacity: 0.08, radius: 14, y: 8, elevation: 5 }
                : { opacity: 0.04, radius: 8, y: 4, elevation: 2 };

    return {
        shadowColor: colors.isDark ? '#000000' : withAlpha(colors.primaryVariant, '60'),
        shadowOpacity: recipe.opacity,
        shadowRadius: recipe.radius,
        shadowOffset: { width: 0, height: recipe.y },
        elevation: Platform.OS === 'android' ? recipe.elevation : 0,
    };
};

export const getSurfaceStyle = (
    colors: ColorPalette,
    options?: {
        accent?: string;
        elevated?: boolean;
        muted?: boolean;
        floating?: boolean;
    }
): ViewStyle => {
    const accent = options?.accent;
    const borderColor = accent
        ? withAlpha(accent, options?.floating ? '28' : '20')
        : withAlpha(colors.border, options?.floating ? 'D0' : 'A8');

    return {
        backgroundColor: options?.muted
            ? withAlpha(colors.surfaceVariant, colors.isDark ? 'F4' : 'F8')
            : options?.floating
                ? withAlpha(colors.surfaceRaised, colors.isDark ? 'F2' : 'FC')
                : colors.card,
        borderColor,
        borderWidth: 1,
        borderRadius: Radius.card,
        ...(options?.floating
            ? getShadowStyle(colors, 'floating')
            : options?.elevated
                ? getShadowStyle(colors, 'raised')
                : getShadowStyle(colors, 'soft')),
    };
};

export const getGlowStyle = (
    colors: ColorPalette,
    accent?: string,
    level: GlowLevel = 'soft'
): ViewStyle => {
    const glowColor = accent ?? colors.glow;
    const recipe = level === 'medium'
        ? { opacity: colors.isDark ? 0.28 : 0.18, radius: 14, y: 6, elevation: 6 }
        : { opacity: colors.isDark ? 0.18 : 0.12, radius: 9, y: 4, elevation: 3 };

    return {
        shadowColor: glowColor,
        shadowOpacity: recipe.opacity,
        shadowRadius: recipe.radius,
        shadowOffset: { width: 0, height: recipe.y },
        elevation: Platform.OS === 'android' ? recipe.elevation : 0,
    };
};

export const getIconAccentStyle = (
    colors: ColorPalette,
    accent: string,
    options?: { rounded?: number; mediumGlow?: boolean }
): ViewStyle => {
    const mediumGlow = options?.mediumGlow ?? false;

    return {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: options?.rounded ?? Radius.md,
        borderWidth: 1,
        borderColor: withAlpha(accent, colors.isDark ? '28' : '1A'),
        backgroundColor: withAlpha(accent, colors.isDark ? '18' : '10'),
        shadowColor: accent,
        shadowOpacity: mediumGlow
            ? (colors.isDark ? 0.2 : 0.12)
            : (colors.isDark ? 0.12 : 0.08),
        shadowRadius: mediumGlow ? 12 : 7,
        shadowOffset: { width: 0, height: 0 },
        elevation: Platform.OS === 'android' ? 0 : 0,
    };
};

export const getInsetPanelStyle = (colors: ColorPalette, accent?: string): ViewStyle => {
    const backgroundColor = accent
        ? withAlpha(colors.surfaceRaised, colors.isDark ? 'EE' : 'FC')
        : withAlpha(colors.surfaceVariant, colors.isDark ? 'A8' : '72');

    const borderColor = accent
        ? withAlpha(accent, colors.isDark ? '1E' : '12')
        : withAlpha(colors.border, colors.isDark ? '7A' : '5C');

    return {
        backgroundColor,
        borderWidth: 0.8,
        borderColor,
        borderRadius: Radius.lg,
    };
};

export const getPillStyle = (colors: ColorPalette, accent?: string): ViewStyle => ({
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: accent ? withAlpha(accent, '26') : withAlpha(colors.border, 'B4'),
    backgroundColor: accent ? withAlpha(accent, colors.isDark ? '18' : '10') : colors.surfaceRaised,
});
