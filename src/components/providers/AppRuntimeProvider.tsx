import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as LocalAuthentication from 'expo-local-authentication';
import { getStoredBusinessId, getStoredToken, toUserMessage } from '../../api/client';
import { SettingsSection } from '../../constants/enums';
import { saveSettingsSection, settingsRepository } from '../../repositories/settingsRepository';
import { DEFAULT_LOCAL_PREFERENCES, getLocalPreferences, patchLocalPreferences, type LocalPreferences } from '../../services/localPreferences';
import {
    registerBackgroundSync,
    startForegroundSync,
    stopForegroundSync,
    unregisterBackgroundSync,
} from '../../services/backgroundSyncService';
import {
    registerAndroidChannels,
    registerNotificationListeners,
    requestNotificationPermissions,
} from '../../services/notificationService';
import { secureStorage } from '../../services/secureStorage';
import { offlineSyncService } from '../../services/offlineSyncService';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { selectSecuritySettings } from '../../selectors/settingsSelectors';
import { setRoleAccessOverrides } from '../../utils/accessControl';

const PENDING_SETUP_KEY_PREFIX = 'vahi_pending_setup_';
const DEV_DIRECT_ACCESS_ENABLED = process.env.EXPO_PUBLIC_DEV_DIRECT_ACCESS === 'true';

type SyncQueueStats = {
    pendingCount: number;
    blockedCount: number;
    oldestCreatedAt: string | null;
};

type AppRuntimeContextValue = {
    ready: boolean;
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    lastSyncError: string | null;
    syncStats: SyncQueueStats;
    localPreferences: LocalPreferences;
    localPreferencesReady: boolean;
    biometricLockEnabled: boolean;
    biometricSupported: boolean;
    biometricLocked: boolean;
    biometricBusy: boolean;
    refreshSyncState: () => Promise<void>;
    flushSyncQueue: () => Promise<{ processed: number; remaining: number }>;
    refreshLocalPreferences: () => Promise<void>;
    updateLocalPreferences: (patch: Partial<LocalPreferences>) => Promise<LocalPreferences>;
    unlockWithBiometrics: () => Promise<boolean>;
    lockApp: () => void;
};

const DEFAULT_SYNC_STATS: SyncQueueStats = {
    pendingCount: 0,
    blockedCount: 0,
    oldestCreatedAt: null,
};

const AppRuntimeContext = createContext<AppRuntimeContextValue | null>(null);

const resetRoleAccess = () => {
    setRoleAccessOverrides({ actionOverrides: {}, moduleOverrides: {} });
};

export function AppRuntimeProvider({ children }: { children: ReactNode }) {
    const hydrateTheme = useThemeStore((state) => state.hydrate);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const restoreCachedSession = useAuthStore((state) => state.restoreCachedSession);
    const markBootstrapped = useAuthStore((state) => state.markBootstrapped);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const business = useAuthStore((state) => state.business);

    const [ready, setReady] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [lastSyncError, setLastSyncError] = useState<string | null>(null);
    const [syncStats, setSyncStats] = useState<SyncQueueStats>(DEFAULT_SYNC_STATS);
    const [localPreferences, setLocalPreferences] = useState<LocalPreferences>(DEFAULT_LOCAL_PREFERENCES);
    const [localPreferencesReady, setLocalPreferencesReady] = useState(false);
    const [hasStoredToken, setHasStoredToken] = useState(false);
    const [biometricSupported, setBiometricSupported] = useState(false);
    const [biometricLocked, setBiometricLocked] = useState(false);
    const [biometricBusy, setBiometricBusy] = useState(false);
    const flushPromiseRef = useRef<Promise<{ processed: number; remaining: number }> | null>(null);
    const mountedRef = useRef(true);

    const refreshSyncState = useCallback(async () => {
        const stats = await offlineSyncService.getQueueStats();
        if (!mountedRef.current) return;
        setSyncStats(stats);
    }, []);

    const syncStoredTokenFlag = useCallback(async (): Promise<boolean> => {
        const token = await getStoredToken();
        const next = Boolean(token);
        if (mountedRef.current) {
            setHasStoredToken(next);
        }
        return next;
    }, []);

    const refreshLocalPreferences = useCallback(async () => {
        const next = await getLocalPreferences();
        if (!mountedRef.current) return;
        setLocalPreferences(next);
        setLocalPreferencesReady(true);
        hydrateTheme(next);
    }, [hydrateTheme]);

    const updateLocalPreferences = useCallback(async (patch: Partial<LocalPreferences>) => {
        const next = await patchLocalPreferences(patch);
        if (mountedRef.current) {
            setLocalPreferences(next);
            setLocalPreferencesReady(true);
            hydrateTheme(next);
        }
        return next;
    }, [hydrateTheme]);

    const refreshBiometricSupport = useCallback(async () => {
        try {
            if (Platform.OS === 'web') {
                if (mountedRef.current) setBiometricSupported(false);
                return false;
            }
            const [hasHardware, enrolled] = await Promise.all([
                LocalAuthentication.hasHardwareAsync(),
                LocalAuthentication.isEnrolledAsync(),
            ]);
            const supported = hasHardware && enrolled;
            if (mountedRef.current) {
                setBiometricSupported(supported);
            }
            return supported;
        } catch {
            if (mountedRef.current) {
                setBiometricSupported(false);
            }
            return false;
        }
    }, []);

    const biometricLockEnabled = localPreferences.biometricLockEnabled && biometricSupported;

    const lockApp = useCallback(() => {
        if (!biometricLockEnabled) return;
        setBiometricLocked(true);
    }, [biometricLockEnabled]);

    const unlockWithBiometrics = useCallback(async () => {
        if (!localPreferences.biometricLockEnabled) {
            if (mountedRef.current) setBiometricLocked(false);
            return true;
        }

        const supported = await refreshBiometricSupport();
        if (!supported) {
            if (mountedRef.current) setBiometricLocked(true);
            return false;
        }

        if (mountedRef.current) {
            setBiometricBusy(true);
        }

        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock Vahi',
                fallbackLabel: 'Use passcode',
                cancelLabel: 'Cancel',
            });
            if (mountedRef.current) {
                setBiometricLocked(!result.success);
            }
            return result.success;
        } catch {
            if (mountedRef.current) {
                setBiometricLocked(true);
            }
            return false;
        } finally {
            if (mountedRef.current) {
                setBiometricBusy(false);
            }
        }
    }, [localPreferences.biometricLockEnabled, refreshBiometricSupport]);

    const flushSyncQueue = useCallback(async (): Promise<{ processed: number; remaining: number }> => {
        if (flushPromiseRef.current) {
            return flushPromiseRef.current;
        }

        const task = (async () => {
            if (mountedRef.current) {
                setIsSyncing(true);
                setLastSyncError(null);
            }
            try {
                const result = await offlineSyncService.flushQueue();
                if (mountedRef.current && result.processed > 0) {
                    setLastSyncedAt(new Date());
                }
                await refreshSyncState();
                return result;
            } catch (error) {
                const message = toUserMessage(error, 'Unable to sync offline changes right now.');
                if (mountedRef.current) {
                    setLastSyncError(message);
                }
                console.error('[app-runtime] flush queue failed', { error });
                await refreshSyncState();
                throw error;
            } finally {
                flushPromiseRef.current = null;
                if (mountedRef.current) {
                    setIsSyncing(false);
                }
            }
        })();

        flushPromiseRef.current = task;
        return task;
    }, [refreshSyncState]);

    const hasRuntimeAccess = hasStoredToken || DEV_DIRECT_ACCESS_ENABLED;

    const flushPendingSetup = useCallback(async (businessId: string | null) => {
        const scopedBusinessId = businessId ?? (await getStoredBusinessId()) ?? null;
        if (!scopedBusinessId) return;

        const pendingKey = `${PENDING_SETUP_KEY_PREFIX}${scopedBusinessId}`;
        const pendingPayload = await secureStorage.getItemAsync(pendingKey);
        if (!pendingPayload) return;

        try {
            const parsed = JSON.parse(pendingPayload) as Record<string, unknown>;
            await saveSettingsSection(SettingsSection.GENERAL, parsed);
            await secureStorage.deleteItemAsync(pendingKey);
        } catch (error) {
            console.error('[app-runtime] pending setup replay failed', {
                businessId: scopedBusinessId,
                error,
            });
        }
    }, []);

    const applySecurityOverrides = useCallback(async () => {
        try {
            const response = await settingsRepository.get(SettingsSection.SECURITY);
            const security = selectSecuritySettings(response.data);
            resetRoleAccess();
            setRoleAccessOverrides({
                actionOverrides: security.actionOverrides,
                moduleOverrides: security.moduleOverrides,
            });
        } catch (error) {
            console.error('[app-runtime] load security settings failed', { error });
            resetRoleAccess();
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                resetRoleAccess();
                await Promise.all([
                    refreshLocalPreferences(),
                    restoreCachedSession(),
                    refreshSyncState(),
                    refreshBiometricSupport(),
                ]);

                const tokenExists = await syncStoredTokenFlag();
                if (tokenExists || DEV_DIRECT_ACCESS_ENABLED) {
                    await refreshUser();
                } else {
                    markBootstrapped();
                }
            } catch (error) {
                console.error('[app-runtime] bootstrap failed', { error });
                markBootstrapped();
            } finally {
                if (active) {
                    setReady(true);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [markBootstrapped, refreshBiometricSupport, refreshLocalPreferences, refreshSyncState, refreshUser, restoreCachedSession, syncStoredTokenFlag]);

    useEffect(() => {
        void syncStoredTokenFlag();
    }, [isAuthenticated, syncStoredTokenFlag]);

    useEffect(() => {
        void NetInfo.fetch().then((state) => {
            if (!mountedRef.current) return;
            setIsOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
        });

        const unsubscribeQueue = offlineSyncService.subscribe(() => {
            void refreshSyncState();
        });

        const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
            const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
            setIsOnline(online);
            offlineSyncService.onNetworkStateChange(online);
            if (online) {
                void flushSyncQueue();
            } else {
                void refreshSyncState();
            }
        });

        const appStateSubscription = AppState.addEventListener('change', (nextState) => {
            if (nextState !== 'active') {
                if (nextState === 'background' || nextState === 'inactive') {
                    lockApp();
                }
                return;
            }
            void syncStoredTokenFlag();
            void refreshSyncState();
            void refreshBiometricSupport().then((supported) => {
                if (localPreferences.biometricLockEnabled && supported) {
                    setBiometricLocked(true);
                    void unlockWithBiometrics();
                }
            });
            if (hasRuntimeAccess) {
                void refreshUser();
                void flushSyncQueue();
            }
        });

        return () => {
            unsubscribeQueue();
            unsubscribeNetInfo();
            appStateSubscription.remove();
        };
    }, [flushSyncQueue, hasRuntimeAccess, localPreferences.biometricLockEnabled, lockApp, refreshBiometricSupport, refreshSyncState, refreshUser, syncStoredTokenFlag, unlockWithBiometrics]);

    useEffect(() => {
        if (!localPreferencesReady) return;
        void refreshBiometricSupport().then((supported) => {
            if (!localPreferences.biometricLockEnabled || !supported) {
                setBiometricLocked(false);
                return;
            }
            setBiometricLocked(true);
            void unlockWithBiometrics();
        });
    }, [localPreferences.biometricLockEnabled, localPreferencesReady, refreshBiometricSupport, unlockWithBiometrics]);

    useEffect(() => {
        let cleanupNotifications = () => {};
        let active = true;

        if (Platform.OS === 'web') {
            return () => {};
        }

        (async () => {
            try {
                const granted = await requestNotificationPermissions();
                if (!active || !granted) return;
                await registerAndroidChannels();
                cleanupNotifications = registerNotificationListeners();
            } catch (error) {
                console.error('[app-runtime] notification setup failed', { error });
            }
        })();

        return () => {
            active = false;
            cleanupNotifications();
        };
    }, []);

    useEffect(() => {
        if (!hasRuntimeAccess) {
            resetRoleAccess();
            stopForegroundSync();
            void unregisterBackgroundSync();
            return () => {};
        }

        (async () => {
            try {
                await flushPendingSetup(business?.id ?? null);
                await applySecurityOverrides();
                await refreshSyncState();
                startForegroundSync(60_000, flushSyncQueue);
                await registerBackgroundSync();
                await flushSyncQueue();
            } catch (error) {
                console.error('[app-runtime] authenticated runtime setup failed', { error });
            }
        })();

        return () => {
            stopForegroundSync();
            void unregisterBackgroundSync();
        };
    }, [applySecurityOverrides, business?.id, flushPendingSetup, flushSyncQueue, hasRuntimeAccess, refreshSyncState]);

    const value = useMemo<AppRuntimeContextValue>(() => ({
        ready,
        isOnline,
        isSyncing,
        lastSyncedAt,
        lastSyncError,
        syncStats,
        localPreferences,
        localPreferencesReady,
        biometricLockEnabled,
        biometricSupported,
        biometricLocked,
        biometricBusy,
        refreshSyncState,
        flushSyncQueue,
        refreshLocalPreferences,
        updateLocalPreferences,
        unlockWithBiometrics,
        lockApp,
    }), [
        biometricBusy,
        biometricLockEnabled,
        biometricLocked,
        biometricSupported,
        flushSyncQueue,
        isOnline,
        isSyncing,
        lastSyncedAt,
        lastSyncError,
        localPreferences,
        localPreferencesReady,
        ready,
        refreshLocalPreferences,
        refreshSyncState,
        syncStats,
        updateLocalPreferences,
        unlockWithBiometrics,
        lockApp,
    ]);

    return (
        <AppRuntimeContext.Provider value={value}>
            {children}
        </AppRuntimeContext.Provider>
    );
}

export function useAppRuntime(): AppRuntimeContextValue {
    const value = useContext(AppRuntimeContext);
    if (!value) {
        throw new Error('useAppRuntime must be used inside AppRuntimeProvider');
    }
    return value;
}
