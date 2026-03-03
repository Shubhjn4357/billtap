import { Platform, type ColorSchemeName } from 'react-native';

export const Colors = {
    light: {
        primary: '#007B83',
        primaryVariant: '#005A60',
        secondary: '#FFB300',
        background: '#F4F5F7',
        surface: '#FFFFFF',
        surfaceVariant: '#F0F2F5',
        error: '#D32F2F',
        text: '#111827',
        textSecondary: '#6B7280',
        border: '#E5E7EB',
        success: '#16A34A',
        warning: '#F97316',
        info: '#0284C7',
        backgroundElement: '#F0F0F3',
        backgroundSelected: '#E0E1E6',
        onPrimary: '#FFFFFF',
        onSurface: '#111827',
        tabBar: '#FFFFFF',
        tabBarBorder: '#E5E7EB',
        card: '#FFFFFF',
        skeleton: '#E5E7EB',
        skeletonHighlight: '#F9FAFB',
    },
    dark: {
        primary: '#00B4C0',
        primaryVariant: '#007B83',
        secondary: '#FFB300',
        background: '#020617',
        surface: '#111827',
        surfaceVariant: '#1E293B',
        error: '#EF4444',
        text: '#F9FAFB',
        textSecondary: '#9CA3AF',
        border: '#374151',
        success: '#22C55E',
        warning: '#FB923C',
        info: '#38BDF8',
        backgroundElement: '#1E293B',
        backgroundSelected: '#2E3135',
        onPrimary: '#FFFFFF',
        onSurface: '#F9FAFB',
        tabBar: '#111827',
        tabBarBorder: '#374151',
        card: '#1E293B',
        skeleton: '#1E293B',
        skeletonHighlight: '#374151',
    },
} as const;

export type ThemeColor = keyof typeof Colors.light;
export type ThemeMode = 'light' | 'dark';
// Widened palette type: compatible with both light and dark, usable as component prop
export type ColorPalette = {
    primary: string;
    primaryVariant: string;
    secondary: string;
    background: string;
    surface: string;
    surfaceVariant: string;
    error: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    info: string;
    backgroundElement: string;
    backgroundSelected: string;
    onPrimary: string;
    onSurface: string;
    tabBar: string;
    tabBarBorder: string;
    card: string;
    skeleton: string;
    skeletonHighlight: string;
};
export function getColors(scheme: ColorSchemeName | null | undefined): ColorPalette {
    const mode: ThemeMode = scheme === 'dark' ? 'dark' : 'light';
    return Colors[mode];
}

export const Spacing = {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
    half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64,
} as const;

export const Radius = {
    sm: 6, md: 10, lg: 16, xl: 24, pill: 999, card: 12, chip: 999,
} as const;

export const Elevation = { none: 0, low: 2, medium: 4, high: 8 } as const;

export const Typography = {
    display: { size: 26, weight: '700' as const, lineHeight: 34 },
    headline: { size: 22, weight: '600' as const, lineHeight: 30 },
    title: { size: 18, weight: '600' as const, lineHeight: 24 },
    body: { size: 14, weight: '400' as const, lineHeight: 20 },
    caption: { size: 12, weight: '400' as const, lineHeight: 16 },
    label: { size: 12, weight: '500' as const, lineHeight: 16 },
    code: { size: 13, weight: '400' as const, lineHeight: 18 },
} as const;

export const Fonts = Platform.select({
    ios: { sans: 'system-ui', serif: 'ui-serif', mono: 'ui-monospace', rounded: 'ui-rounded' },
    default: { sans: 'normal', serif: 'serif', mono: 'monospace', rounded: 'normal' },
    web: { sans: 'var(--font-display)', serif: 'var(--font-serif)', mono: 'var(--font-mono)', rounded: 'var(--font-rounded)' },
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
export const ScreenPadding = Spacing.lg;
export const TouchTargetMin = 48;
export const RowHeight = 48;
export const HeaderHeight = 56;
