import { Platform, type ColorSchemeName } from 'react-native';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';

export const Colors = {
    light: {
        primary: '#0B78FF',
        primaryVariant: '#085FD0',
        secondary: '#F59E0B',
        background: '#F4F7FC',
        surface: '#FFFFFF',
        surfaceVariant: '#EDF3FF',
        error: '#D14343',
        text: '#0F172A',
        textSecondary: '#5F6D82',
        border: '#D6DFED',
        success: '#0E9F6E',
        warning: '#F59E0B',
        info: '#0284C7',
        backgroundElement: '#EAF1FF',
        backgroundSelected: '#DCEAFE',
        onPrimary: '#FFFFFF',
        onSurface: '#0F172A',
        tabBar: '#FFFFFF',
        tabBarBorder: '#D6DFED',
        card: '#FFFFFF',
        skeleton: '#E7EDF8',
        skeletonHighlight: '#F8FBFF',
        surfaceRaised: '#F9FBFF',
        backdrop: '#0F172A',
        glow: '#4DA3FF',
        isDark: false,
    },
    dark: {
        primary: '#56A8FF',
        primaryVariant: '#2E84F6',
        secondary: '#FFB64C',
        background: '#06111F',
        surface: '#0C1A2D',
        surfaceVariant: '#13263E',
        error: '#FF7D7D',
        text: '#F5F8FF',
        textSecondary: '#9FB2CF',
        border: '#223754',
        success: '#34D399',
        warning: '#FFB547',
        info: '#50C4FF',
        backgroundElement: '#102136',
        backgroundSelected: '#173152',
        onPrimary: '#FFFFFF',
        onSurface: '#F5F8FF',
        tabBar: '#0C1A2D',
        tabBarBorder: '#223754',
        card: '#102136',
        skeleton: '#1A304D',
        skeletonHighlight: '#254267',
        surfaceRaised: '#13263E',
        backdrop: '#020711',
        glow: '#5EA9FF',
        isDark: true,
    },
} as const;

type StringColorKeys<T> = {
    [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

export type ThemeColor = StringColorKeys<typeof Colors.light>;
export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';
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
    surfaceRaised: string;
    backdrop: string;
    glow: string;
    isDark: boolean;
};

const normalizeHexColor = (value: string): string | null => {
    const candidate = value.trim();
    if (/^#[0-9a-fA-F]{3}$/.test(candidate)) {
        const hex = candidate.slice(1);
        return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(candidate)) return candidate.toLowerCase();
    if (/^#[0-9a-fA-F]{8}$/.test(candidate)) return candidate.toLowerCase().slice(0, 7);
    return null;
};

const normalizeAlphaHex = (alpha: number | string): string | null => {
    if (typeof alpha === 'number') {
        if (!Number.isFinite(alpha)) return null;
        const clamped = Math.max(0, Math.min(1, alpha));
        return Math.round(clamped * 255).toString(16).padStart(2, '0');
    }
    const hex = alpha.trim().replace(/^#/, '').slice(0, 2);
    return /^[0-9a-fA-F]{2}$/.test(hex) ? hex.toLowerCase() : null;
};

export const withAlpha = (color: string, alpha: number | string): string => {
    const normalized = normalizeHexColor(color);
    const alphaHex = normalizeAlphaHex(alpha);
    if (!normalized || !alphaHex) return color;
    return `${normalized}${alphaHex}`;
};

let themePreference: ThemePreference = 'system';
const THEME_PREFERENCE_STORAGE_KEY = 'vahi_theme_preference_v1';

const normalizeThemePreference = (value: unknown): ThemePreference => {
    const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (candidate === 'light' || candidate === 'dark' || candidate === 'system') {
        return candidate;
    }
    return 'system';
};

export const setThemePreference = (value: unknown) => {
    themePreference = normalizeThemePreference(value);
};

export const getThemePreference = (): ThemePreference => themePreference;

export const loadThemePreference = async (): Promise<ThemePreference> => {
    const stored = await offlineKeyValueStore.getItem(THEME_PREFERENCE_STORAGE_KEY);
    setThemePreference(stored ?? 'system');
    return getThemePreference();
};

export const saveThemePreference = async (value: unknown): Promise<ThemePreference> => {
    setThemePreference(value);
    const normalized = getThemePreference();
    await offlineKeyValueStore.setItem(THEME_PREFERENCE_STORAGE_KEY, normalized);
    return normalized;
};

export function getColors(scheme: ColorSchemeName | null | undefined): ColorPalette {
    const mode: ThemeMode =
        themePreference === 'system'
            ? (scheme === 'dark' ? 'dark' : 'light')
            : themePreference;
    return Colors[mode];
}

export const Spacing = {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
    half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64,
} as const;

export const Radius = {
    sm: 6, md: 12, lg: 18, xl: 24, pill: 999, card: 16, chip: 999,
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
