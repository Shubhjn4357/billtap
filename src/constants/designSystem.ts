import { Platform, type ViewStyle } from 'react-native';
import { Radius, Spacing, withAlpha, type ColorPalette } from './theme';

type ShadowLevel = 'soft' | 'raised' | 'floating';

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

export const getInsetPanelStyle = (colors: ColorPalette, accent?: string): ViewStyle => ({
    backgroundColor: accent ? withAlpha(accent, colors.isDark ? '18' : '10') : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: accent ? withAlpha(accent, '24') : withAlpha(colors.border, '88'),
    borderRadius: Radius.lg,
});

export const getPillStyle = (colors: ColorPalette, accent?: string): ViewStyle => ({
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: accent ? withAlpha(accent, '26') : withAlpha(colors.border, 'B4'),
    backgroundColor: accent ? withAlpha(accent, colors.isDark ? '18' : '10') : colors.surfaceRaised,
});
