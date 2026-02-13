
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import 'react-native-reanimated';

import { auth, db } from '../src/api/firebaseConfig';
import { AppThemeProvider } from '../src/components/providers/AppThemeProvider';
import { Config } from '../src/constants/Config';
import { STACK_ROUTE_TITLES } from '../src/constants/staticText';
import { toDateSafe } from '../src/utils/date';
import { normalizeCurrencyCode } from '../src/utils/formatters';
import { useNetworkStore, useSettingsStore, useUserStore } from '../src/store';
import type { UserProfile } from '../src/types';

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
        setLoading(true);
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            if (!authUser) {
                setUser(null);
                setLoading(false);
                return;
            }

            const baseProfile: UserProfile = {
                uid: authUser.uid,
                email: authUser.email,
                phoneNumber: authUser.phoneNumber,
                displayName: authUser.displayName,
                photoURL: authUser.photoURL,
            };

            try {
                const profileRef = doc(db, 'users', authUser.uid);
                const profileSnap = await getDoc(profileRef);
                const profileData = profileSnap.exists() ? profileSnap.data() : {};
                const profileCurrency = normalizeCurrencyCode(profileData.currency ?? baseProfile.currency ?? Config.defaultCurrency);

                setUser({
                    ...baseProfile,
                    businessName: profileData.businessName ?? baseProfile.businessName,
                    address: profileData.address ?? baseProfile.address,
                    gstEnabled: profileData.gstEnabled ?? baseProfile.gstEnabled,
                    gstNumber: profileData.gstNumber ?? baseProfile.gstNumber,
                    currency: profileCurrency,
                    role: profileData.role ?? baseProfile.role,
                    subscriptionStatus: profileData.subscriptionStatus ?? baseProfile.subscriptionStatus,
                    subscriptionPlanId: profileData.subscriptionPlanId ?? baseProfile.subscriptionPlanId,
                    subscriptionPlanName: profileData.subscriptionPlanName ?? baseProfile.subscriptionPlanName,
                    subscriptionAmountMonthly: profileData.subscriptionAmountMonthly ?? baseProfile.subscriptionAmountMonthly,
                    subscriptionCurrency: profileData.subscriptionCurrency ?? baseProfile.subscriptionCurrency,
                    subscriptionStartsAt: profileData.subscriptionStartsAt ?? baseProfile.subscriptionStartsAt,
                    subscriptionEndsAt: profileData.subscriptionEndsAt ?? baseProfile.subscriptionEndsAt,
                });
                setCurrency(profileCurrency);
            } catch {
                setUser({
                    ...baseProfile,
                    currency: normalizeCurrencyCode(baseProfile.currency ?? Config.defaultCurrency),
                });
                setCurrency(normalizeCurrencyCode(baseProfile.currency ?? Config.defaultCurrency));
            } finally {
                setLoading(false);
            }
        });

        return unsubscribe;
    }, [setCurrency, setLoading, setUser]);

    useEffect(() => {
        const endDate = toDateSafe(user?.subscriptionEndsAt);
        const shouldExpire = user?.subscriptionStatus === 'active' && endDate && endDate.getTime() < Date.now();
        const uid = auth.currentUser?.uid;

        if (!shouldExpire || !uid || !user) {
            return;
        }

        const expireSubscription = async () => {
            await setDoc(
                doc(db, 'users', uid),
                {
                    subscriptionStatus: 'expired',
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
            setUser({
                ...user,
                subscriptionStatus: 'expired',
            });
        };

        void expireSubscription();
    }, [user, setUser]);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setNetworkState({
                isConnected: state.isConnected,
                isInternetReachable: state.isInternetReachable,
            });
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
        } else if (!isAuthenticated) {
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
