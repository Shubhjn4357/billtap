import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/Config';
import type { UserProfile } from '../types';

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
    autoTheme: boolean;
    themeMode: 'light' | 'dark';
    setThemeMode: (mode: 'light' | 'dark' | 'auto') => void;
    hasSeenOnboarding: boolean;
    setHasSeenOnboarding: (seen: boolean) => void;
}

interface NetworkState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    setNetworkState: (payload: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
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
            currencySymbol: Config.defaultCurrency,
            setCurrency: (symbol) =>
                set({
                    currencySymbol: Config.supportedCurrencies.some((entry) => entry.code === symbol.toUpperCase())
                        ? symbol.toUpperCase()
                        : Config.defaultCurrency,
                }),
            autoTheme: true,
            themeMode: 'light',
            setThemeMode: (mode) => set({
                autoTheme: mode === 'auto',
                themeMode: mode === 'auto' ? 'light' : mode,
            }),
            hasSeenOnboarding: false,
            setHasSeenOnboarding: (seen) => set({ hasSeenOnboarding: seen }),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

export const useNetworkStore = create<NetworkState>((set) => ({
    isConnected: true,
    isInternetReachable: true,
    setNetworkState: ({ isConnected, isInternetReachable }) => set({ isConnected, isInternetReachable }),
}));
