import { Platform, type ViewStyle } from 'react-native';
import { Radius, Spacing, withAlpha, type ColorPalette } from './theme';

type ShadowLevel = 'soft' | 'raised' | 'floating';

export const DESIGN_SPACING = {
    screenX: Spacing.lg,
    sectionGap: Spacing.md,
    cardGap: Spacing.sm,
} as const;

export const getShadowStyle = (
    colors: ColorPalette,
    level: ShadowLevel = 'soft'
): ViewStyle => {
    const recipe =
        level === 'floating'
            ? { opacity: 0.14, radius: 24, y: 14, elevation: 14 }
            : level === 'raised'
                ? { opacity: 0.09, radius: 16, y: 10, elevation: 8 }
                : { opacity: 0.05, radius: 10, y: 6, elevation: 3 };

    return {
        shadowColor: colors.text,
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
        ? withAlpha(accent, options?.floating ? '36' : '28')
        : withAlpha(colors.border, options?.floating ? 'D0' : 'B8');

    return {
        backgroundColor: options?.muted
            ? colors.surfaceVariant
            : options?.floating
                ? withAlpha(colors.surface, colors.isDark ? 'F6' : 'FA')
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
    backgroundColor: accent ? withAlpha(accent, '10') : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: accent ? withAlpha(accent, '2A') : withAlpha(colors.border, '88'),
    borderRadius: Radius.lg,
});

export const getPillStyle = (colors: ColorPalette, accent?: string): ViewStyle => ({
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: accent ? withAlpha(accent, '2C') : withAlpha(colors.border, 'C0'),
    backgroundColor: accent ? withAlpha(accent, '10') : colors.surface,
});
