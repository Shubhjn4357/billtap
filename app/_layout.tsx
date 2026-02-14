import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import 'react-native-reanimated';

import { authService } from '../src/api/authService';
import { offlineSyncService } from '../src/api/offlineSyncService';
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

export default function RootLayout() {
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    const { user, isLoading, setLoading, setUser } = useUserStore();
    const { setCurrency } = useSettingsStore();
    const { setNetworkState } = useNetworkStore();

    // Bootstrap: Load user profile on mount
    useEffect(() => {
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
    }, [setCurrency, setLoading, setUser]);

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
