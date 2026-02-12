
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { AppThemeProvider } from '../src/components/providers/AppThemeProvider';
import { useAuth } from '../src/hooks/useAuth';
import { useUserStore } from '../src/store';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    const { isAuthenticated, isLoading, user } = useUserStore();
    const segments = useSegments();
    const router = useRouter();

    // Initialize Auth Listener
    useAuth();

    useEffect(() => {
        if (loaded && !isLoading) {
            SplashScreen.hideAsync();
        }
    }, [loaded, isLoading]);

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (isAuthenticated && !inAuthGroup) {
            // User is signed in
            // Check if business setup is done (Optional: Implement business-setup check logic)
            // if (user && !user.businessName) {
            //     router.replace('/business-setup');
            // } else {
            // Determine if we need to redirect to home
            // If we are in login, go to tabs
            if (segments[0] === 'login' || segments[0] === 'index') {
                router.replace('/(tabs)/home');
            }
            // }
        } else if (!isAuthenticated && segments[0] !== 'login') {
            // Redirect to login if not authenticated and not in login screen
            router.replace('/login');
        }
    }, [isAuthenticated, segments, isLoading, user]);

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
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="item/[id]" options={{ title: 'Item Details', headerBackTitle: 'Stock' }} />
                <Stack.Screen name="+not-found" />
            </Stack>
        </AppThemeProvider>
    );
}
