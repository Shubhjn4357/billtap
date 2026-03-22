import { Platform, type ColorSchemeName } from 'react-native';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';

export const Colors = {
    light: {
        primary: '#315DDC',
        primaryVariant: '#2448AE',
        secondary: '#7B8DB6',
        background: '#EEF2F7',
        surface: '#F8FAFD',
        surfaceVariant: '#E6ECF4',
        error: '#C65353',
        text: '#142033',
        textSecondary: '#617186',
        border: '#D2DBE8',
        success: '#197D57',
        warning: '#C98A18',
        info: '#3C75DA',
        backgroundElement: '#E7EDF7',
        backgroundSelected: '#DCE7FB',
        onPrimary: '#FFFFFF',
        onSurface: '#142033',
        tabBar: '#F7F9FD',
        tabBarBorder: '#D2DBE8',
        card: '#FFFFFF',
        skeleton: '#E4EBF5',
        skeletonHighlight: '#F9FBFE',
        surfaceRaised: '#FCFDFF',
        backdrop: '#0E1625',
        glow: '#86A5F4',
        isDark: false,
    },
    dark: {
        primary: '#6E93FF',
        primaryVariant: '#4C73E6',
        secondary: '#94A7D6',
        background: '#091321',
        surface: '#111C2E',
        surfaceVariant: '#18263B',
        error: '#F08A8A',
        text: '#F4F7FC',
        textSecondary: '#A3B2C7',
        border: '#2A3F5C',
        success: '#45C48A',
        warning: '#F0B356',
        info: '#6AB8FF',
        backgroundElement: '#152238',
        backgroundSelected: '#203454',
        onPrimary: '#081221',
        onSurface: '#F4F7FC',
        tabBar: '#0E1828',
        tabBarBorder: '#273B56',
        card: '#132034',
        skeleton: '#22344B',
        skeletonHighlight: '#304867',
        surfaceRaised: '#18263B',
        backdrop: '#020711',
        glow: '#6F95FF',
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
    sm: 8, md: 14, lg: 18, xl: 28, pill: 999, card: 22, chip: 999,
} as const;

export const Elevation = { none: 0, low: 1, medium: 3, high: 6 } as const;

export const Typography = {
    display: { size: 30, weight: '700' as const, lineHeight: 38 },
    headline: { size: 24, weight: '600' as const, lineHeight: 32 },
    title: { size: 18, weight: '600' as const, lineHeight: 24 },
    body: { size: 14, weight: '400' as const, lineHeight: 20 },
    caption: { size: 12, weight: '400' as const, lineHeight: 16 },
    label: { size: 12, weight: '700' as const, lineHeight: 16 },
    code: { size: 13, weight: '400' as const, lineHeight: 18 },
} as const;

export const Fonts = Platform.select({
    ios: { sans: 'system-ui', serif: 'ui-serif', mono: 'ui-monospace', rounded: 'ui-rounded' },
    default: { sans: 'normal', serif: 'serif', mono: 'monospace', rounded: 'normal' },
    web: { sans: 'var(--font-display)', serif: 'var(--font-serif)', mono: 'var(--font-mono)', rounded: 'var(--font-rounded)' },
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 840;
export const ScreenPadding = Spacing.lg;
export const TouchTargetMin = 48;
export const RowHeight = 50;
export const HeaderHeight = 60;
