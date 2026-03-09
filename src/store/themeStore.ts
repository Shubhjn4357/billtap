import { create } from 'zustand';
import { setThemePreference, type ThemePreference } from '../constants/theme';
import type { AppLanguage, InvoiceTemplateMode } from '../constants/appPreferences';

type ThemeStore = {
    themeMode: ThemePreference;
    appLanguage: AppLanguage;
    invoiceTemplateMode: InvoiceTemplateMode;
    hapticsEnabled: boolean;
    richMotionEnabled: boolean;
    biometricLockEnabled: boolean;
    gestureNavigationEnabled: boolean;

    setThemeMode: (mode: ThemePreference) => void;
    setAppLanguage: (language: AppLanguage) => void;
    setInvoiceTemplateMode: (mode: InvoiceTemplateMode) => void;
    setHapticsEnabled: (enabled: boolean) => void;
    setRichMotionEnabled: (enabled: boolean) => void;
    setBiometricLockEnabled: (enabled: boolean) => void;
    setGestureNavigationEnabled: (enabled: boolean) => void;
    hydrate: (prefs: {
        themeMode: ThemePreference;
        appLanguage: AppLanguage;
        invoiceTemplateMode: InvoiceTemplateMode;
        hapticsEnabled: boolean;
        richMotionEnabled: boolean;
        biometricLockEnabled: boolean;
        gestureNavigationEnabled: boolean;
    }) => void;
};

export const useThemeStore = create<ThemeStore>((set) => ({
    themeMode: 'system',
    appLanguage: 'en',
    invoiceTemplateMode: 'BUSINESS',
    hapticsEnabled: true,
    richMotionEnabled: true,
    biometricLockEnabled: false,
    gestureNavigationEnabled: true,

    setThemeMode: (mode) => {
        setThemePreference(mode);
        set({ themeMode: mode });
    },
    setAppLanguage: (appLanguage) => set({ appLanguage }),
    setInvoiceTemplateMode: (invoiceTemplateMode) => set({ invoiceTemplateMode }),

    setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),

    setRichMotionEnabled: (enabled) => set({ richMotionEnabled: enabled }),

    setBiometricLockEnabled: (enabled) => set({ biometricLockEnabled: enabled }),

    setGestureNavigationEnabled: (enabled) => set({ gestureNavigationEnabled: enabled }),

    hydrate: ({
        themeMode,
        appLanguage,
        invoiceTemplateMode,
        hapticsEnabled,
        richMotionEnabled,
        biometricLockEnabled,
        gestureNavigationEnabled,
    }) => {
        setThemePreference(themeMode);
        set({
            themeMode,
            appLanguage,
            invoiceTemplateMode,
            hapticsEnabled,
            richMotionEnabled,
            biometricLockEnabled,
            gestureNavigationEnabled,
        });
    },
}));
