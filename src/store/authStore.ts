import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
    storeToken,
    clearToken,
    clearStoredBusinessId,
    storeBusinessId,
    isUnauthorizedError,
    toUserMessage,
} from '../api/client';
import type { User, Business, Subscription } from '../types/domain';
import type { AuthResponse } from '../types/api';
import { authRepository } from '../repositories/authRepository';
import { businessRepository } from '../repositories/businessRepository';
import { secureStorage } from '../services/secureStorage';
import {
    clearRuntimeSessionSnapshot,
    replaceRuntimeSessionSnapshot,
    type RuntimeSessionSnapshot,
} from '../services/runtimeSession';
import {
    mapAuthResponseToSnapshot,
    type OrganizationRole,
} from '../mappers/authMappers';

interface AuthState {
    user: User | null;
    business: Business | null;
    subscription: Subscription | null;
    organizationRole: OrganizationRole;
    isAuthenticated: boolean;
    isBootstrapped: boolean;
    isLoading: boolean;
    error: string | null;
}

interface AuthActions {
    setAuth: (res: AuthResponse) => Promise<void>;
    setUser: (user: User) => void;
    setBusiness: (business: Business | null) => void;
    setSubscription: (subscription: Subscription | null) => void;
    refreshUser: () => Promise<void>;
    restoreCachedSession: () => Promise<void>;
    markBootstrapped: () => void;
    signOut: () => Promise<void>;
    clearError: () => void;
}

type AuthSnapshot = {
    user: User | null;
    business: Business | null;
    subscription: Subscription | null;
    organizationRole: AuthState['organizationRole'];
};

const AUTH_SNAPSHOT_KEY = 'vahi_auth_snapshot_v1';

const persistSnapshot = async (snapshot: AuthSnapshot) => {
    await secureStorage.setItemAsync(AUTH_SNAPSHOT_KEY, JSON.stringify(snapshot));
};

const readSnapshot = async (): Promise<AuthSnapshot | null> => {
    const raw = await secureStorage.getItemAsync(AUTH_SNAPSHOT_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as AuthSnapshot;
        return parsed;
    } catch {
        await secureStorage.deleteItemAsync(AUTH_SNAPSHOT_KEY);
        return null;
    }
};

const clearSnapshot = async () => {
    await secureStorage.deleteItemAsync(AUTH_SNAPSHOT_KEY);
};

const persistAuthStateSnapshot = async (snapshot: AuthSnapshot) => {
    await persistSnapshot(snapshot);
};

const syncRuntimeSessionSnapshot = (snapshot: RuntimeSessionSnapshot) => {
    replaceRuntimeSessionSnapshot(snapshot);
};

export const useAuthStore = create<AuthState & AuthActions>()(
    immer((set, get) => ({
        user: null,
        business: null,
        subscription: null,
        organizationRole: 'owner',
        isAuthenticated: false,
        isBootstrapped: false,
        isLoading: false,
        error: null,

        setAuth: async (res) => {
            await storeToken(res.token);
            if (res.business?.id) await storeBusinessId(res.business.id);
            const snapshot = mapAuthResponseToSnapshot(res);
            syncRuntimeSessionSnapshot(snapshot);
            set((state) => {
                state.isAuthenticated = true;
                state.error = null;
                state.user = snapshot.user;
                state.business = snapshot.business;
                state.subscription = snapshot.subscription;
                state.organizationRole = snapshot.organizationRole;
                state.isBootstrapped = true;
            });
            await persistAuthStateSnapshot(snapshot);
            await get().refreshUser();
        },

        setUser: (user) => {
            set((state) => { state.user = user; });
            const state = get();
            syncRuntimeSessionSnapshot({
                user,
                business: state.business,
                subscription: state.subscription,
                organizationRole: state.organizationRole,
            });
        },
        setBusiness: (business) => {
            set((state) => { state.business = business; });
            const state = get();
            syncRuntimeSessionSnapshot({
                user: state.user,
                business,
                subscription: state.subscription,
                organizationRole: state.organizationRole,
            });
        },
        setSubscription: (subscription) => {
            set((state) => { state.subscription = subscription; });
            const state = get();
            syncRuntimeSessionSnapshot({
                user: state.user,
                business: state.business,
                subscription,
                organizationRole: state.organizationRole,
            });
        },

        refreshUser: async () => {
            try {
                const existingBusiness = get().business;
                const sessionRes = await authRepository.getSessionContext(existingBusiness?.id ?? null);
                const user = sessionRes.data.user;
                let business: Business | null = existingBusiness;
                try {
                    const businessRes = await businessRepository.get(existingBusiness?.id ?? 'current');
                    business = businessRes.data;
                    await storeBusinessId(business.id);
                } catch {
                    business = existingBusiness;
                }

                const subscription = sessionRes.data.subscription
                    ? {
                        ...sessionRes.data.subscription,
                        businessId: business?.id ?? sessionRes.data.subscription.businessId,
                    }
                    : null;
                const role = sessionRes.data.organizationRole;

                set((state) => {
                    state.user = user;
                    state.business = business;
                    state.subscription = subscription;
                    state.organizationRole = role;
                    state.isAuthenticated = true;
                    state.isBootstrapped = true;
                    state.error = null;
                });
                syncRuntimeSessionSnapshot({
                    user,
                    business,
                    subscription,
                    organizationRole: role,
                });
                await persistAuthStateSnapshot({
                    user,
                    business,
                    subscription,
                    organizationRole: role,
                });
            } catch (error) {
                if (isUnauthorizedError(error)) {
                    await clearToken();
                    await clearStoredBusinessId();
                    await clearSnapshot();
                    clearRuntimeSessionSnapshot();
                    set((state) => {
                        state.user = null;
                        state.business = null;
                        state.subscription = null;
                        state.organizationRole = 'owner';
                        state.isAuthenticated = false;
                        state.isBootstrapped = true;
                        state.error = null;
                    });
                    return;
                }

                const snapshot = await readSnapshot();
                set((state) => {
                    if (snapshot) {
                        state.user = snapshot.user;
                        state.business = snapshot.business;
                        state.subscription = snapshot.subscription;
                        state.organizationRole = snapshot.organizationRole;
                    }
                    state.isAuthenticated = Boolean(snapshot ?? state.user);
                    state.isBootstrapped = true;
                    state.error = toUserMessage(error, 'Unable to refresh profile right now. Working in offline mode.');
                });
                if (snapshot) {
                    syncRuntimeSessionSnapshot(snapshot);
                } else {
                    clearRuntimeSessionSnapshot();
                }
            }
        },

        restoreCachedSession: async () => {
            const snapshot = await readSnapshot();
            if (snapshot) {
                syncRuntimeSessionSnapshot(snapshot);
                set((state) => {
                    state.user = snapshot.user;
                    state.business = snapshot.business;
                    state.subscription = snapshot.subscription;
                    state.organizationRole = snapshot.organizationRole;
                    state.isAuthenticated = Boolean(snapshot.user);
                    state.error = null;
                    state.isBootstrapped = true;
                });
                return;
            }
            clearRuntimeSessionSnapshot();
            set((state) => {
                state.isBootstrapped = true;
            });
        },

        markBootstrapped: () => set((state) => {
            state.isBootstrapped = true;
        }),

        signOut: async () => {
            await clearToken();
            await clearStoredBusinessId();
            await clearSnapshot();
            clearRuntimeSessionSnapshot();
            set((state) => {
                state.user = null;
                state.business = null;
                state.subscription = null;
                state.organizationRole = 'owner';
                state.isAuthenticated = false;
                state.isBootstrapped = true;
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
export const useIsBootstrapped = () => useAuthStore((s) => s.isBootstrapped);
export const useFeatureFlags = () => useAuthStore((s) => s.subscription?.featureFlagsEnabled ?? []);
export const useOrganizationRole = () => useAuthStore((s) => s.organizationRole);
