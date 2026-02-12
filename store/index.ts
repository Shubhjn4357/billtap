import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, AppTheme } from '../types';

interface UserState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    setUser: (user: UserProfile | null) => void;
    logout: () => void;
    isLoading: boolean;
    setLoading: (loading: boolean) => void;
}

interface SettingsState {
    isBiometricEnabled: boolean;
    toggleBiometric: (enabled: boolean) => void;
    currencySymbol: string;
    setCurrency: (symbol: string) => void;
    autoTheme: boolean; // follow system
    themeMode: 'light' | 'dark'; // manual override
    setThemeMode: (mode: 'light' | 'dark' | 'auto') => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,
            setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
            logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
            setLoading: (loading) => set({ isLoading: loading }),
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            isBiometricEnabled: false,
            toggleBiometric: (enabled) => set({ isBiometricEnabled: enabled }),
            currencySymbol: '₹',
            setCurrency: (symbol) => set({ currencySymbol: symbol }),
            autoTheme: true,
            themeMode: 'light',
            setThemeMode: (mode) => set({
                autoTheme: mode === 'auto',
                themeMode: mode === 'auto' ? 'light' : mode
            }),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
