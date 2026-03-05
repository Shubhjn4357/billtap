import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import * as SecureStore from 'expo-secure-store';
import {
    api,
    storeToken,
    clearToken,
    clearStoredBusinessId,
    storeBusinessId,
    isUnauthorizedError,
    toUserMessage,
} from '../api/client';
import type { User, Business, Subscription } from '../types/domain';
import type { AuthResponse } from '../types/api';

interface AuthState {
    user: User | null;
    business: Business | null;
    subscription: Subscription | null;
    organizationRole: 'owner' | 'manager' | 'salesman' | 'staff';
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

type LegacyProfilePayload = Record<string, unknown>;
type OrganizationPayload = Record<string, unknown>;
type AuthSnapshot = {
    user: User | null;
    business: Business | null;
    subscription: Subscription | null;
    organizationRole: AuthState['organizationRole'];
};

const AUTH_SNAPSHOT_KEY = 'vahi_auth_snapshot_v1';

const isoNow = () => new Date().toISOString();

const toStringOrNull = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value : null;

const toStringOrDefault = (value: unknown, fallback: string): string =>
    typeof value === 'string' && value.trim() !== '' ? value : fallback;

const toBoolean = (value: unknown, fallback = false): boolean =>
    typeof value === 'boolean' ? value : fallback;

const normalizeOrganizationRole = (value: unknown): AuthState['organizationRole'] => {
    const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (role === 'owner' || role === 'manager' || role === 'salesman' || role === 'staff') {
        return role;
    }
    return 'owner';
};

const persistSnapshot = async (snapshot: AuthSnapshot) => {
    await SecureStore.setItemAsync(AUTH_SNAPSHOT_KEY, JSON.stringify(snapshot));
};

const readSnapshot = async (): Promise<AuthSnapshot | null> => {
    const raw = await SecureStore.getItemAsync(AUTH_SNAPSHOT_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as AuthSnapshot;
        return parsed;
    } catch {
        await SecureStore.deleteItemAsync(AUTH_SNAPSHOT_KEY);
        return null;
    }
};

const clearSnapshot = async () => {
    await SecureStore.deleteItemAsync(AUTH_SNAPSHOT_KEY);
};

const mapLegacyProfileToUser = (profile: LegacyProfilePayload): User => {
    const timestamp = isoNow();
    const id = toStringOrDefault(profile.uid ?? profile.id, `usr_local_${Date.now()}`);
    const email = toStringOrDefault(profile.email, 'unknown@vahi.app');
    const displayName = toStringOrDefault(profile.displayName ?? profile.name, email.split('@')[0] ?? 'Vahi User');

    return {
        id,
        googleSub: toStringOrDefault(profile.googleSub, id),
        name: displayName,
        email,
        phone: toStringOrNull(profile.phoneNumber ?? profile.phone),
        photoUrl: toStringOrNull(profile.photoURL ?? profile.photoUrl),
        isDisabled: toBoolean(profile.isDisabled, false),
        createdAt: toStringOrDefault(profile.createdAt, timestamp),
        updatedAt: toStringOrDefault(profile.updatedAt, timestamp),
    };
};

const mapOrganizationToBusiness = (org: OrganizationPayload, fallbackOwnerId: string): Business => {
    const timestamp = isoNow();
    const id = toStringOrDefault(org.id, `biz_local_${Date.now()}`);

    return {
        id,
        ownerUserId: toStringOrDefault(org.userId, fallbackOwnerId),
        name: toStringOrDefault(org.name, 'My Business'),
        legalName: toStringOrNull(org.legalName),
        address: toStringOrNull(org.address),
        state: toStringOrNull(org.state),
        city: toStringOrNull(org.city),
        pincode: toStringOrNull(org.pincode),
        gstin: toStringOrNull(org.gstNumber ?? org.gstin),
        pan: toStringOrNull(org.pan),
        booksStartDate: toStringOrNull(org.booksStartDate),
        openingCashInHand: typeof org.openingCashInHand === 'number' ? org.openingCashInHand : null,
        openingCashInBank: typeof org.openingCashInBank === 'number' ? org.openingCashInBank : null,
        logoUrl: toStringOrNull(org.logoUrl),
        phone: toStringOrNull(org.phoneNumber ?? org.phone),
        email: toStringOrNull(org.email),
        currency: toStringOrDefault(org.currency, 'INR'),
        category: toStringOrNull(org.category),
        code: toStringOrNull(org.code),
        isActive: true,
        settings: {},
        createdAt: toStringOrDefault(org.createdAt, timestamp),
        updatedAt: toStringOrDefault(org.updatedAt, timestamp),
    };
};

const mapLegacyProfileToSubscription = (profile: LegacyProfilePayload, businessId?: string | null): Subscription | null => {
    const tier = toStringOrNull(profile.subscriptionPlanId ?? profile.subscriptionPlanName);
    if (!tier) return null;

    const legacyStatus = toStringOrDefault(profile.subscriptionStatus, 'inactive');
    const status =
        legacyStatus === 'active'
            ? 'ACTIVE'
            : legacyStatus === 'expired'
                ? 'EXPIRED'
                : legacyStatus === 'canceled'
                    ? 'CANCELLED'
                    : legacyStatus === 'past_due'
                        ? 'GRACE'
                        : 'TRIAL';

    const timestamp = isoNow();

    return {
        id: `sub_${businessId ?? 'local'}`,
        businessId: businessId ?? 'local',
        tier: tier as Subscription['tier'],
        billingCycle: null,
        status: status as Subscription['status'],
        startDate: toStringOrNull(profile.subscriptionStartsAt),
        endDate: toStringOrNull(profile.subscriptionEndsAt),
        nextRenewalDate: null,
        renewsAt: null,
        graceEndDate: null,
        maxBillsTotal: null,
        maxBillsPerMonth: null,
        maxStaffUsers: null,
        maxBusinesses: null,
        maxDevices: null,
        maxStorageMb: null,
        monthlyInvoiceCount: 0,
        offlineOnly: false,
        cloudSyncAllowed: true,
        webDashboardAllowed: true,
        featureFlagsEnabled: [],
        createdAt: timestamp,
        updatedAt: timestamp,
    };
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
            set((state) => {
                state.isAuthenticated = true;
                state.error = null;
                if (res.user) state.user = mapLegacyProfileToUser(res.user as unknown as LegacyProfilePayload);
                if (res.business) {
                    state.business = {
                        ...mapOrganizationToBusiness(res.business as unknown as OrganizationPayload, res.user?.id ?? 'owner'),
                        name: res.business.name,
                    };
                }
                if (res.subscription?.tier) {
                    state.subscription = {
                        ...(state.subscription ?? mapLegacyProfileToSubscription({
                            subscriptionPlanId: res.subscription.tier,
                            subscriptionStatus: res.subscription.status,
                        })!),
                        tier: res.subscription.tier as Subscription['tier'],
                        status: (res.subscription.status as Subscription['status']) ?? 'TRIAL',
                    };
                }
                state.organizationRole = normalizeOrganizationRole((res.user as Record<string, unknown> | undefined)?.role);
                state.isBootstrapped = true;
            });
            await persistSnapshot({
                user: get().user,
                business: get().business,
                subscription: get().subscription,
                organizationRole: get().organizationRole,
            });
            await get().refreshUser();
        },

        setUser: (user) => set((state) => { state.user = user; }),
        setBusiness: (business) => set((state) => { state.business = business; }),
        setSubscription: (subscription) => set((state) => { state.subscription = subscription; }),

        refreshUser: async () => {
            try {
                const profileRes = await api.get<{ ok: boolean; user?: LegacyProfilePayload; message?: string }>('/api/users/me');
                if (!profileRes.ok || !profileRes.user) {
                    throw new Error(profileRes.message ?? 'Failed to fetch user profile.');
                }

                const user = mapLegacyProfileToUser(profileRes.user);
                const existingBusiness = get().business;
                let business: Business | null = existingBusiness;
                try {
                    const orgRes = await api.get<{ ok: boolean; organization?: OrganizationPayload }>('/api/organizations/current');
                    if (orgRes.ok && orgRes.organization) {
                        business = mapOrganizationToBusiness(orgRes.organization, user.id);
                        await storeBusinessId(business.id);
                    }
                } catch {
                    business = existingBusiness;
                }

                const subscription = mapLegacyProfileToSubscription(profileRes.user, business?.id ?? null);
                const role = normalizeOrganizationRole(profileRes.user.role);

                set((state) => {
                    state.user = user;
                    state.business = business;
                    state.subscription = subscription;
                    state.organizationRole = role;
                    state.isAuthenticated = true;
                    state.isBootstrapped = true;
                    state.error = null;
                });
                await persistSnapshot({
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
            }
        },

        restoreCachedSession: async () => {
            const snapshot = await readSnapshot();
            if (snapshot) {
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
