
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/Config';
import type { UserProfile, Party, Transaction, Item } from '../types';

import { createJSONStorage, persist } from 'zustand/middleware';

interface UserState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    setUser: (user: UserProfile | null) => void;
    logout: () => void;
    isLoading: boolean;
    setLoading: (loading: boolean) => void;
    hasHydrated: boolean;
    setHydrated: (hydrated: boolean) => void;
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
            hasHydrated: false,
            setHydrated: (hydrated) => set({ hasHydrated: hydrated }),
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                user: state.user,
                // Explicitly exclude volatile auth/loading flags from persistence.
            }),
            merge: (persistedState, currentState) => {
                const persisted = (persistedState ?? {}) as Partial<UserState>;
                const user = persisted.user ?? null;

                return {
                    ...currentState,
                    user,
                    isAuthenticated: !!user,
                };
            },
            onRehydrateStorage: () => (state) => {
                state?.setHydrated(true);
            },
        }
    )
);

interface SettingsState {
    isBiometricEnabled: boolean;
    toggleBiometric: (enabled: boolean) => void;
    currencySymbol: string;
    setCurrency: (symbol: string) => void;
    autoTheme: boolean;
    themeMode: 'light' | 'dark' | 'system';
    setThemeMode: (mode: 'light' | 'dark' | 'system' | 'auto') => void;
    hasSeenOnboarding: boolean;
    setHasSeenOnboarding: (seen: boolean) => void;
    notificationSoundEnabled: boolean;
    toggleNotificationSound: (enabled: boolean) => void;
    hasHydrated: boolean;
    setHydrated: (hydrated: boolean) => void;
}

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
            themeMode: 'system',
            setThemeMode: (mode) => {
                const resolvedMode = mode === 'auto' ? 'system' : mode;
                set({
                    autoTheme: resolvedMode === 'system',
                    themeMode: resolvedMode,
                });
            },
            hasSeenOnboarding: false,
            setHasSeenOnboarding: (seen) => set({ hasSeenOnboarding: seen }),
            notificationSoundEnabled: true,
            toggleNotificationSound: (enabled) => set({ notificationSoundEnabled: enabled }),
            hasHydrated: false,
            setHydrated: (hydrated) => set({ hasHydrated: hydrated }),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 2,
            partialize: (state) => ({
                isBiometricEnabled: state.isBiometricEnabled,
                currencySymbol: state.currencySymbol,
                themeMode: state.themeMode,
                hasSeenOnboarding: state.hasSeenOnboarding,
                notificationSoundEnabled: state.notificationSoundEnabled,
            }),
            migrate: (persistedState: unknown, version: number) => {
                if (version === 0) {
                    return { ...(persistedState as Partial<SettingsState>), hasSeenOnboarding: false };
                }

                if (version === 1) {
                    const state = persistedState as Partial<SettingsState>;
                    const nextThemeMode = state?.autoTheme
                        ? 'system'
                        : (state?.themeMode === 'dark' ? 'dark' : 'light');

                    return {
                        ...state,
                        themeMode: nextThemeMode,
                    };
                }

                if (!persistedState || typeof persistedState !== 'object') {
                    return persistedState as Partial<SettingsState>;
                }

                const state = persistedState as Partial<SettingsState>;
                return {
                    ...state,
                    themeMode: state.themeMode === 'dark'
                        ? 'dark'
                        : state.themeMode === 'light'
                            ? 'light'
                            : 'system',
                };
            },
            merge: (persistedState, currentState) => {
                const persisted = (persistedState ?? {}) as Partial<SettingsState>;
                const themeMode = persisted.themeMode === 'dark'
                    ? 'dark'
                    : persisted.themeMode === 'light'
                        ? 'light'
                        : 'system';

                return {
                    ...currentState,
                    ...persisted,
                    themeMode,
                    autoTheme: themeMode === 'system',
                };
            },
            onRehydrateStorage: () => (state) => {
                state?.setHydrated(true);
            },
        }
    )
);

interface NetworkState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    syncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
    lastSyncTime: string | null;
    setNetworkState: (payload: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
    setSyncStatus: (status: 'IDLE' | 'SYNCING' | 'ERROR') => void;
    setLastSyncTime: (time: string) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
    isConnected: true,
    isInternetReachable: true,
    syncStatus: 'IDLE',
    lastSyncTime: null,
    setNetworkState: ({ isConnected, isInternetReachable }) => set((state) => {
        if (state.isConnected === isConnected && state.isInternetReachable === isInternetReachable) {
            return state;
        }
        return { isConnected, isInternetReachable };
    }),
    setSyncStatus: (status) => set({ syncStatus: status }),
    setLastSyncTime: (time) => set({ lastSyncTime: time }),
}));

interface OrganizationContextState {
    role: 'owner' | 'manager' | 'salesman' | null;
    ownerUserId: string | null;
    permissions: Record<string, boolean>;
    settings: Record<string, unknown>;
}

interface OrganizationState {
    selectedOrganizationId: string | null;
    context: OrganizationContextState;
    setSelectedOrganizationId: (organizationId: string | null) => void;
    setOrganizationContext: (context: {
        role: 'owner' | 'manager' | 'salesman';
        ownerUserId: string;
        permissions: Record<string, boolean>;
        settings: Record<string, unknown>;
    } | null) => void;
    setOrganizationSettings: (settings: Record<string, unknown>) => void;
    clearOrganizationContext: () => void;
    hasHydrated: boolean;
    setHydrated: (hydrated: boolean) => void;
}

export const useOrganizationStore = create<OrganizationState>()(
    persist(
        (set) => ({
            selectedOrganizationId: null,
            context: {
                role: null,
                ownerUserId: null,
                permissions: {},
                settings: {},
            },
            setSelectedOrganizationId: (organizationId) => set((state) => {
                if (state.selectedOrganizationId === organizationId) {
                    return state;
                }
                return { selectedOrganizationId: organizationId };
            }),
            setOrganizationContext: (context) => set((state) => {
                if (!context) {
                    if (
                        state.context.role === null &&
                        state.context.ownerUserId === null &&
                        Object.keys(state.context.permissions).length === 0 &&
                        Object.keys(state.context.settings).length === 0
                    ) {
                        return state;
                    }
                    return {
                        context: {
                            role: null,
                            ownerUserId: null,
                            permissions: {},
                            settings: {},
                        },
                    };
                }

                return {
                    selectedOrganizationId: state.selectedOrganizationId,
                    context: {
                        role: context.role,
                        ownerUserId: context.ownerUserId,
                        permissions: { ...context.permissions },
                        settings: { ...context.settings },
                    },
                };
            }),
            setOrganizationSettings: (settings) => set((state) => ({
                context: {
                    ...state.context,
                    settings: { ...settings },
                },
            })),
            clearOrganizationContext: () => set((state) => {
                if (
                    state.context.role === null &&
                    state.context.ownerUserId === null &&
                    Object.keys(state.context.permissions).length === 0 &&
                    Object.keys(state.context.settings).length === 0
                ) {
                    return state;
                }
                return {
                    context: {
                        role: null,
                        ownerUserId: null,
                        permissions: {},
                        settings: {},
                    },
                };
            }),
            hasHydrated: false,
            setHydrated: (hydrated) => set({ hasHydrated: hydrated }),
        }),
        {
            name: 'organization-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                selectedOrganizationId: state.selectedOrganizationId,
                context: state.context,
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHydrated(true);
            },
        }
    )
);

export const waitForHydration = async () => {
    const check = () => {
        return useUserStore.getState().hasHydrated &&
            useSettingsStore.getState().hasHydrated &&
            useOrganizationStore.getState().hasHydrated;
    };

    if (check()) return;

    return new Promise<void>((resolve) => {
        const interval = setInterval(() => {
            if (check()) {
                clearInterval(interval);
                resolve();
            }
        }, 200);
        setTimeout(() => {
            clearInterval(interval);
            resolve();
        }, 5000);
    });
};

interface StockState {
    items: Item[];
    loading: boolean;
    setItems: (items: Item[]) => void;
    addItem: (item: Item) => void;
    updateItem: (id: string, updates: Partial<Item>) => void;
    deleteItem: (id: string) => void;
}

export const useStockStore = create<StockState>()(
    persist(
        (set) => ({
            items: [],
            loading: false,
            setItems: (items) => set({ items }),
            addItem: (item) => set((state) => ({ items: [...state.items, item] })),
            updateItem: (id, updates) => set((state) => ({
                items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
            })),
            deleteItem: (id) => set((state) => ({
                items: state.items.filter((i) => i.id !== id),
            })),
        }),
        {
            name: 'stock-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

interface PartyState {
    parties: Party[];
    loading: boolean;
    setParties: (parties: Party[]) => void;
    addParty: (party: Party) => void;
    updateParty: (id: string, party: Partial<Party>) => void;
    deleteParty: (id: string) => void;
    currentParty: Party | null;
    setCurrentParty: (party: Party | null) => void;
}

export const usePartyStore = create<PartyState>()(
    persist(
        (set) => ({
            parties: [],
            loading: false,
            setParties: (parties) => set({ parties }),
            addParty: (party) => set((state) => ({ parties: [...state.parties, party] })),
            updateParty: (id, updates) => set((state) => ({
                parties: state.parties.map((p) => (p.id === id ? { ...p, ...updates } : p)),
            })),
            deleteParty: (id) => set((state) => ({
                parties: state.parties.filter((p) => p.id !== id),
            })),
            currentParty: null,
            setCurrentParty: (party) => set({ currentParty: party }),
        }),
        {
            name: 'party-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ parties: state.parties }), // Don't persist loading or currentParty
        }
    )
);

interface TransactionState {
    transactions: Transaction[];
    loading: boolean;
    addTransaction: (transaction: Transaction) => void;
    setTransactions: (transactions: Transaction[]) => void;
}

export const useTransactionStore = create<TransactionState>()(
    persist(
        (set) => ({
            transactions: [],
            loading: false,
            addTransaction: (transaction) => set((state) => ({ transactions: [transaction, ...state.transactions] })),
            setTransactions: (transactions) => set({ transactions }),
        }),
        {
            name: 'transaction-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
