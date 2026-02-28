import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { storeToken, clearToken, storeBusinessId } from '../api/client';
import { authApi } from '../api/endpoints';
import type { User, Business, Subscription } from '../types/domain';
import type { AuthResponse } from '../types/api';

interface AuthState {
    user: User | null;
    business: Business | null;
    subscription: Subscription | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

interface AuthActions {
    setAuth: (res: AuthResponse) => Promise<void>;
    setUser: (user: User) => void;
    setBusiness: (business: Business | null) => void;
    setSubscription: (subscription: Subscription | null) => void;
    refreshUser: () => Promise<void>;
    signOut: () => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
    immer((set, get) => ({
        user: null,
        business: null,
        subscription: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        setAuth: async (res) => {
            await storeToken(res.token);
            if (res.business?.id) await storeBusinessId(res.business.id);
            set((state) => {
                state.isAuthenticated = true;
                state.error = null;
                if (res.user) {
                    state.user = res.user as unknown as User;
                }
            });
        },

        setUser: (user) => set((state) => { state.user = user; }),
        setBusiness: (business) => set((state) => { state.business = business; }),
        setSubscription: (subscription) => set((state) => { state.subscription = subscription; }),

        refreshUser: async () => {
            try {
                const res = await authApi.me();
                if (res.ok && res.data) {
                    set((state) => { state.user = res.data; state.isAuthenticated = true; });
                }
            } catch {
                // Silently fail - handled by TanStack Query
            }
        },

        signOut: async () => {
            await clearToken();
            set((state) => {
                state.user = null;
                state.business = null;
                state.subscription = null;
                state.isAuthenticated = false;
                state.error = null;
            });
        },

        clearError: () => set((state) => { state.error = null; }),
    }))
);

// Selector hooks
export const useUser = () => useAuthStore((s) => s.user);
export const useBusiness = () => useAuthStore((s) => s.business);
export const useSubscription = () => useAuthStore((s) => s.subscription);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useFeatureFlags = () => useAuthStore((s) => s.subscription?.featureFlagsEnabled ?? []);
