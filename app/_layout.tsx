import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Updates from 'expo-updates';
import '../src/utils/reanimated';

import { authService } from '../src/api/authService';
import { ApiError } from '../src/api/httpClient';
import { offlineSyncService } from '../src/api/offlineSyncService';
import { paymentReminderService } from '../src/services/paymentReminderService';
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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore splash race conditions during fast refresh.
});

export default function RootLayout() {
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    const hasBootstrappedRef = useRef(false);
    const user = useUserStore((state) => state.user);
    const isLoading = useUserStore((state) => state.isLoading);
    const setLoading = useUserStore((state) => state.setLoading);
    const setUser = useUserStore((state) => state.setUser);
    const userHydrated = useUserStore((state) => state.hasHydrated);
    const settingsHydrated = useSettingsStore((state) => state.hasHydrated);
    const { setCurrency } = useSettingsStore();
    const { setNetworkState } = useNetworkStore();
    const userId = user?.uid;
    const userSubscriptionStatus = user?.subscriptionStatus;

    useEffect(() => {
        NetInfo.configure({
            // Prevent noisy web reachability probes like HEAD http://localhost:8082/.
            // Native platforms keep reachability checks enabled.
            reachabilityShouldRun: () => Platform.OS !== 'web',
        });
    }, []);

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
                const profile = await authService.getCurrentUser();
                if (!isMounted) return;

                if (!profile) {
                    setUser(null);
                    setLoading(false);
                    return;
                }

                const profileCurrency = normalizeCurrencyCode(profile.currency ?? Config.defaultCurrency);
                setUser({
                    ...profile,
                    currency: profileCurrency,
                });
                setCurrency(profileCurrency);
                try {
                    await offlineSyncService.flushQueue();
                } catch {
                    // Ignore transient sync failures during bootstrap.
                }
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
        void paymentReminderService.syncPendingPaymentReminders();
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
        offlineSyncService.startAutoSync();
        return () => {
            offlineSyncService.stopAutoSync();
        };
    }, []);

    // Hide splash screen when ready
    useEffect(() => {
        if (loaded && userHydrated && settingsHydrated && !isLoading) {
            SplashScreen.hideAsync();
        }
    }, [isLoading, loaded, settingsHydrated, userHydrated]);

    useEffect(() => {
        if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;

        const runAutoUpdateCheck = async () => {
            try {
                const update = await Updates.checkForUpdateAsync();
                if (!update.isAvailable) return;
                await Updates.fetchUpdateAsync();
            } catch {
                // Silent auto-update checks should not block app startup.
            }
        };

        void runAutoUpdateCheck();
    }, []);

    // Show loading screen while fonts load or auth is bootstrapping
    if (!loaded || !userHydrated || !settingsHydrated || isLoading) {
        return <LoadingScreen message="Initializing..." />;
    }

    return (
        <AppThemeProvider>
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
        </AppThemeProvider>
    );
}
