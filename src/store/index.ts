
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/Config';
import type { UserProfile, Party, Transaction, Item } from '../types';

interface UserState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    setUser: (user: UserProfile | null) => void;
    logout: () => void;
    isLoading: boolean;
    setLoading: (loading: boolean) => void;
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
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                // Explicitly exclude isLoading from persistence
            }),
        }
    )
);

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
    notificationSoundEnabled: boolean;
    toggleNotificationSound: (enabled: boolean) => void;
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
            themeMode: 'light',
            setThemeMode: (mode) => set({
                autoTheme: mode === 'auto',
                themeMode: mode === 'auto' ? 'light' : mode,
            }),
            hasSeenOnboarding: false,
            setHasSeenOnboarding: (seen) => set({ hasSeenOnboarding: seen }),
            notificationSoundEnabled: true,
            toggleNotificationSound: (enabled) => set({ notificationSoundEnabled: enabled }),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 1,
            migrate: (persistedState: any, version: number) => {
                if (version === 0) {
                    return { ...persistedState, hasSeenOnboarding: false };
                }
                return persistedState;
            },
        }
    )
);

interface NetworkState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    setNetworkState: (payload: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
    isConnected: true,
    isInternetReachable: true,
    setNetworkState: ({ isConnected, isInternetReachable }) => set({ isConnected, isInternetReachable }),
}));

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
