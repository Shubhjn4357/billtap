import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Updates from 'expo-updates';
import 'react-native-reanimated';

import { authService } from '../src/api/authService';
import { offlineSyncService } from '../src/api/offlineSyncService';
import { paymentReminderService } from '../src/services/paymentReminderService';
import { userService } from '../src/api/userService';
import { AppThemeProvider } from '../src/components/providers/AppThemeProvider';
import { Config } from '../src/constants/Config';
import { STACK_ROUTE_TITLES } from '../src/constants/staticText';
import { toDateSafe } from '../src/utils/date';
import { normalizeCurrencyCode } from '../src/utils/formatters';
import { useNetworkStore, useSettingsStore, useUserStore } from '../src/store';
import { LoadingScreen } from '../src/components/common/LoadingScreen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore splash race conditions during fast refresh.
});

// Module-level variable to ensure bootstrap only runs once per app lifecycle
let hasBootstrapped = false;

export default function RootLayout() {
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    const user = useUserStore((state) => state.user);
    const isLoading = useUserStore((state) => state.isLoading);
    const setLoading = useUserStore((state) => state.setLoading);
    const setUser = useUserStore((state) => state.setUser);
    const { setCurrency } = useSettingsStore();
    const { setNetworkState } = useNetworkStore();
    const userId = user?.uid;
    const userSubscriptionStatus = user?.subscriptionStatus;

    // Bootstrap: Load user profile on mount
    useEffect(() => {
        // Only bootstrap once per app lifecycle
        if (hasBootstrapped) return;
        hasBootstrapped = true;

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
            } catch {
                if (!isMounted) return;
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
    }, [setCurrency, setLoading, setUser]); // Empty dependency array - only run once on mount

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
            const isNowOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;
            setNetworkState({
                isConnected: state.isConnected,
                isInternetReachable: state.isInternetReachable,
            });

            if (isNowOnline && !wasOnline) {
                void offlineSyncService.flushQueue();
                if (Platform.OS !== 'web') {
                    void paymentReminderService.syncPendingPaymentReminders();
                }
            }

            wasOnline = isNowOnline;
        });

        return unsubscribe;
    }, [setNetworkState]);

    // Hide splash screen when ready
    useEffect(() => {
        if (loaded && !isLoading) {
            SplashScreen.hideAsync();
        }
    }, [loaded, isLoading]);

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
    if (!loaded || isLoading) {
        return <LoadingScreen message="Initializing..." />;
    }

    return (
        <AppThemeProvider>
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
        </AppThemeProvider>
    );
}
