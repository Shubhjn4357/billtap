import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore splash race conditions during fast refresh.
});

export default function RootLayout() {
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    const { user, isAuthenticated, isLoading, setLoading, setUser } = useUserStore();
    const { hasSeenOnboarding, setCurrency } = useSettingsStore();
    const { setNetworkState } = useNetworkStore();
    const segments = useSegments() as string[];
    const router = useRouter();

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

    useEffect(() => {
        if (loaded && !isLoading) {
            SplashScreen.hideAsync();
        }
    }, [loaded, isLoading]);

    useEffect(() => {
        if (isLoading || !loaded) return;

        const publicRoutes = ['login', 'onboarding', 'index', 'about', 'changelog', 'terms', 'privacy', 'sitemap'];
        const currentSegment = segments[0];

        if (isAuthenticated) {
            if (!user?.businessName && currentSegment !== 'business-setup') {
                router.replace('/business-setup');
                return;
            }
            if (currentSegment && ['login', 'index', 'onboarding'].includes(currentSegment)) {
                router.replace('/(tabs)/home');
            }
        } else {
            const isPublicRoute = currentSegment ? publicRoutes.includes(currentSegment) : false;

            if (!currentSegment || currentSegment === 'index') {
                if (!hasSeenOnboarding) {
                    router.replace('/onboarding');
                } else {
                    router.replace('/login');
                }
                return;
            }

            if (!isPublicRoute) {
                router.replace('/login');
            }
        }
    }, [isAuthenticated, segments, isLoading, router, loaded, hasSeenOnboarding, user?.businessName]);

    if (!loaded || isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <AppThemeProvider>
            <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="business-setup" options={{ title: 'Business Setup' }} />
                <Stack.Screen name="subscription" options={{ title: 'Subscription' }} />
                <Stack.Screen name="admin" options={{ title: 'Admin Panel' }} />
                <Stack.Screen name="about" options={{ title: STACK_ROUTE_TITLES.about }} />
                <Stack.Screen name="changelog" options={{ title: STACK_ROUTE_TITLES.changelog }} />
                <Stack.Screen name="terms" options={{ title: STACK_ROUTE_TITLES.terms }} />
                <Stack.Screen name="privacy" options={{ title: STACK_ROUTE_TITLES.privacy }} />
                <Stack.Screen name="sitemap" options={{ title: STACK_ROUTE_TITLES.sitemap }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="item/[id]" options={{ title: 'Item Details', headerBackTitle: 'Stock' }} />
                <Stack.Screen name="scan" options={{ title: 'Scan Barcode' }} />
                <Stack.Screen name="+not-found" />
            </Stack>
        </AppThemeProvider>
    );
}
