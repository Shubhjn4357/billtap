import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { db } from '../src/db/client';
import migrations from '../src/db/migrations/migrations.js';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { syncService } from '../src/services/syncService';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Alert, InteractionManager, LogBox, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Updates from 'expo-updates';

import { authService } from '../src/api/authService';
import { ApiError } from '../src/api/httpClient';
import { offlineSyncService } from '../src/api/offlineSyncService';
import { paymentReminderService } from '../src/services/paymentReminderService';
import {
    registerBackgroundSync as registerBgSync,
    startForegroundSync,
    stopForegroundSync,
} from '../src/services/backgroundSyncService';
import {
    requestNotificationPermissions,
    registerAndroidChannels,
} from '../src/services/notificationService';
import { userService } from '../src/api/userService';
import { AppThemeProvider } from '../src/components/providers/AppThemeProvider';
import { AppQueryProvider } from '../src/components/providers/AppQueryProvider';
import { DialogProvider } from '../src/components/providers/DialogProvider';
import { Config } from '../src/constants/Config';
import { STACK_ROUTE_TITLES } from '../src/constants/staticText';
import { toDateSafe } from '../src/utils/date';
import { isNetworkLikeMessage } from '../src/utils/errorGuards';
import { normalizeCurrencyCode } from '../src/utils/formatters';
import { useNetworkStore, useSettingsStore, useUserStore } from '../src/store';
import { LoadingScreen } from '../src/components/common/LoadingScreen';
import { SQLiteProvider } from 'expo-sqlite';

LogBox.ignoreLogs([
    'SafeAreaView has been deprecated', // react-native-paper internal usage
    'native view manager for module', // stale native build; fixed by prebuild --clean
    'Unable to get the view config', // related ExpoLinearGradient warning
]);

if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../src/utils/reanimated.native');
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore splash race conditions during fast refresh.
});

export default function RootLayout() {
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });
    const [startupReady, setStartupReady] = useState(false);

    const hasBootstrappedRef = useRef(false);
    const user = useUserStore((state) => state.user);
    const isLoading = useUserStore((state) => state.isLoading);
    const setLoading = useUserStore((state) => state.setLoading);
    const setUser = useUserStore((state) => state.setUser);
    const userHydrated = useUserStore((state) => state.hasHydrated);
    const setUserHydrated = useUserStore((state) => state.setHydrated);
    const settingsHydrated = useSettingsStore((state) => state.hasHydrated);
    const setSettingsHydrated = useSettingsStore((state) => state.setHydrated);
    const { setCurrency } = useSettingsStore();
    const { setNetworkState } = useNetworkStore();
    const userId = user?.uid;
    const userSubscriptionStatus = user?.subscriptionStatus;

    const { success: migrationSuccess, error: migrationError } = useMigrations(db, migrations);

    useEffect(() => {
        const originalAlert = Alert.alert;
        Alert.alert = (title, message, buttons, options) => {
            const normalizedTitle = typeof title === 'string' ? title : '';
            const normalizedMessage = typeof message === 'string' ? message : '';
            if (isNetworkLikeMessage(normalizedTitle) || isNetworkLikeMessage(normalizedMessage)) {
                return;
            }
            return originalAlert(title, message, buttons, options);
        };

        return () => {
            Alert.alert = originalAlert;
        };
    }, []);

    // Fail-safe: avoid permanent loading if persisted store hydration fails due corrupted web storage.
    useEffect(() => {
        if (userHydrated && settingsHydrated) return;
        const timer = setTimeout(() => {
            if (!useUserStore.getState().hasHydrated) {
                setUserHydrated(true);
            }
            if (!useSettingsStore.getState().hasHydrated) {
                setSettingsHydrated(true);
            }
        }, 3000);
        return () => clearTimeout(timer);
    }, [setSettingsHydrated, setUserHydrated, settingsHydrated, userHydrated]);

    // Fail-safe: avoid indefinite "Initializing..." if a startup network call hangs unexpectedly.
    useEffect(() => {
        if (!isLoading) return;
        const timer = setTimeout(() => {
            if (useUserStore.getState().isLoading) {
                useUserStore.getState().setLoading(false);
            }
        }, 15000);
        return () => clearTimeout(timer);
    }, [isLoading]);

    // Fail-safe: unlock startup UI even if bootstrapping gets interrupted.
    useEffect(() => {
        if (startupReady) return;
        const timer = setTimeout(() => {
            if (!startupReady) {
                useUserStore.getState().setLoading(false);
                setStartupReady(true);
            }
        }, 20000);
        return () => clearTimeout(timer);
    }, [startupReady]);

    // Bootstrap: Load user profile on mount
    useEffect(() => {
        // Wait for persisted stores before making startup auth decisions.
        if (!userHydrated || !settingsHydrated) return;
        if (hasBootstrappedRef.current) return;
        hasBootstrappedRef.current = true;

        let isMounted = true;

        const bootstrap = async () => {
            setLoading(true);

            try {
                // Initialize Local DB
                // Managed by useMigrations hook now
                // await migrateDb(expoDb); // Removed manual migration

                const profile = await authService.getCurrentUser();

                if (!isMounted) return;

                if (!profile) {
                    setUser(null);
                    setLoading(false);
                    return;
                }

                // Start background sync now that auth is confirmed
                syncService.startSync();
                void syncService.registerBackgroundSync();
                startForegroundSync(60_000);
                void registerBgSync();
                // Notifications
                void requestNotificationPermissions().then(async (granted) => {
                    if (granted) await registerAndroidChannels();
                });
                // ... rest of the code ...

                const profileCurrency = normalizeCurrencyCode(profile.currency ?? Config.defaultCurrency);
                setUser({
                    ...profile,
                    currency: profileCurrency,
                });
                setCurrency(profileCurrency);
                void offlineSyncService.flushQueue().catch(() => {
                    // Ignore transient sync failures during bootstrap.
                });
            } catch (error: unknown) {
                if (!isMounted) return;
                const isUnauthorized = error instanceof ApiError && error.status === 401;
                if (isUnauthorized) {
                    setUser(null);
                    setCurrency(Config.defaultCurrency);
                    return;
                }

                const latestLocalUser = useUserStore.getState().user;

                // Keep local session for transient/offline errors. Only force logout on explicit unauthorized.
                if (latestLocalUser) {
                    const localCurrency = normalizeCurrencyCode(latestLocalUser.currency ?? Config.defaultCurrency);
                    setUser({
                        ...latestLocalUser,
                        currency: localCurrency,
                    });
                    setCurrency(localCurrency);
                    return;
                }

                setUser(null);
                setCurrency(Config.defaultCurrency);
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setStartupReady(true);
                }
            }
        };

        void bootstrap();

        return () => {
            isMounted = false;
        };
    }, [setCurrency, setLoading, setUser, settingsHydrated, userHydrated]);

    // Handle subscription expiration
    useEffect(() => {
        const endDate = toDateSafe(user?.subscriptionEndsAt);
        const shouldExpire = user?.subscriptionStatus === 'active' && endDate && endDate.getTime() < Date.now();

        if (!shouldExpire || !user) {
            return;
        }

        const expireSubscription = async () => {
            try {
                const updatedUser = await userService.updateCurrentUser({ subscriptionStatus: 'expired' });
                setUser(updatedUser);
            } catch {
                setUser({
                    ...user,
                    subscriptionStatus: 'expired',
                });
            }
        };

        void expireSubscription();
    }, [user, setUser]);

    // Schedule local pending-payment reminders for credit sales.
    useEffect(() => {
        if (!userId) return;
        if (Platform.OS === 'web') return;
        const interaction = InteractionManager.runAfterInteractions(() => {
            void paymentReminderService.syncPendingPaymentReminders();
        });

        return () => {
            interaction.cancel();
        };
    }, [userId, userSubscriptionStatus]);

    // Monitor network state
    useEffect(() => {
        let wasOnline = false;
        const unsubscribe = NetInfo.addEventListener((state) => {
            const isNowOnline = Platform.OS === 'web'
                ? state.isConnected !== false
                : Boolean(state.isConnected) && state.isInternetReachable !== false;
            setNetworkState({
                isConnected: state.isConnected,
                isInternetReachable: state.isInternetReachable,
            });

            if (isNowOnline && !wasOnline && userId) {
                offlineSyncService.onNetworkStateChange(true);
                if (Platform.OS !== 'web') {
                    void paymentReminderService.syncPendingPaymentReminders();
                }
            }

            wasOnline = isNowOnline;
        });

        return unsubscribe;
    }, [setNetworkState, userId]);

    useEffect(() => {
        if (!userId) return;

        const interaction = InteractionManager.runAfterInteractions(() => {
            offlineSyncService.startAutoSync();
        });

        return () => {
            interaction.cancel();
            offlineSyncService.stopAutoSync();
        };
    }, [userId]);

    // Hide splash screen when ready
    useEffect(() => {
        if (loaded && userHydrated && settingsHydrated && startupReady) {
            SplashScreen.hideAsync();
        }
    }, [loaded, settingsHydrated, startupReady, userHydrated]);

    useEffect(() => {
        if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;

        const interaction = InteractionManager.runAfterInteractions(() => {
            void (async () => {
                try {
                    const update = await Updates.checkForUpdateAsync();
                    if (!update.isAvailable) return;
                    await Updates.fetchUpdateAsync();
                } catch {
                    // Silent auto-update checks should not block app startup.
                }
            })();
        });

        return () => {
            interaction.cancel();
        };
    }, []);

    // Show loading screen while fonts load or auth is bootstrapping
    if (!loaded || !userHydrated || !settingsHydrated || !startupReady || !migrationSuccess) {
        const errorMsg = migrationError ? `Migration Error: ${migrationError.message}` : undefined;
        return (
            <AppThemeProvider>
                <LoadingScreen message={errorMsg} />
            </AppThemeProvider>
        );
    }

    return (
        <AppThemeProvider>
            <SQLiteProvider
                databaseName="vahi.db"
                options={{ enableChangeListener: true }}>
            <AppQueryProvider>
                <DialogProvider>
                    <Stack>
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                        <Stack.Screen name="(main)" options={{ headerShown: false }} />
                        <Stack.Screen name="about" options={{ headerShown: true, title: STACK_ROUTE_TITLES.about }} />
                        <Stack.Screen name="changelog" options={{ headerShown: true, title: STACK_ROUTE_TITLES.changelog }} />
                        <Stack.Screen name="terms" options={{ title: STACK_ROUTE_TITLES.terms }} />
                        <Stack.Screen name="privacy" options={{ title: STACK_ROUTE_TITLES.privacy }} />
                        <Stack.Screen name="sitemap" options={{ title: STACK_ROUTE_TITLES.sitemap }} />
                        <Stack.Screen name="+not-found" />
                    </Stack>
                </DialogProvider>
            </AppQueryProvider>
            </SQLiteProvider>
        </AppThemeProvider>
    );
}
