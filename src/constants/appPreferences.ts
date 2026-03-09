import type { ThemePreference } from './theme';

export type AppLanguage = 'en' | 'hi';
export type InvoiceTemplateMode = 'BUSINESS' | 'BRANDED';

export const APP_LANGUAGE_OPTIONS: {
    key: AppLanguage;
    label: string;
    nativeLabel: string;
    emoji: string;
}[] = [
    { key: 'en', label: 'English', nativeLabel: 'English', emoji: 'EN' },
    { key: 'hi', label: 'Hindi', nativeLabel: 'Hindi', emoji: 'हि' },
];

export const INVOICE_TEMPLATE_OPTIONS: {
    key: InvoiceTemplateMode;
    label: string;
    description: string;
}[] = [
    {
        key: 'BUSINESS',
        label: 'Business',
        description: 'Professional GST-first invoice for print and accounts.',
    },
    {
        key: 'BRANDED',
        label: 'Branded',
        description: 'Sharper customer-facing invoice with stronger visual identity.',
    },
];

export const THEME_MODE_OPTIONS: {
    key: ThemePreference;
    label: string;
    icon: string;
}[] = [
    { key: 'system', label: 'System', icon: 'brightness-auto' },
    { key: 'light', label: 'Light', icon: 'white-balance-sunny' },
    { key: 'dark', label: 'Dark', icon: 'weather-night' },
];

export const APP_PREFERENCE_TOGGLES = [
    {
        key: 'richMotionEnabled',
        titleKey: 'settings.rich_motion',
        descriptionKey: 'settings.rich_motion_sub',
        group: 'interaction',
    },
    {
        key: 'hapticsEnabled',
        titleKey: 'settings.haptics',
        descriptionKey: 'settings.haptics_sub',
        group: 'interaction',
    },
    {
        key: 'gestureNavigationEnabled',
        titleKey: 'settings.gesture_navigation',
        descriptionKey: 'settings.gesture_navigation_sub',
        group: 'interaction',
    },
    {
        key: 'biometricLockEnabled',
        titleKey: 'settings.biometric_lock',
        descriptionKey: 'settings.biometric_lock_sub',
        group: 'security',
    },
] as const;

export const APP_PREFERENCE_GROUPS = [
    {
        key: 'appearance',
        titleKey: 'settings.appearance_group',
    },
    {
        key: 'documents',
        titleKey: 'settings.documents_group',
    },
    {
        key: 'interaction',
        titleKey: 'settings.interaction_group',
    },
    {
        key: 'security',
        titleKey: 'settings.security_group',
    },
] as const;
