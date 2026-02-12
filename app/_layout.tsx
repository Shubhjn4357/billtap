import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AppThemeProvider } from '../constants/Theme';
import { useAuth } from '../hooks/useAuth';
import { useUserStore } from '../store';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

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
            // Check if business setup is done
            if (user && !user.businessName) {
                router.replace('/business-setup');
            } else {
                // Go to main app (tabs)
                // If we are already in (app), do nothing. 
                // If we are in public or auth, go to (app)
                // For now, let's assume /home is the main entry
                // router.replace('/(app)/home'); 
            }
        } else if (!isAuthenticated && segments[0] !== 'login') {
            // Redirect to login if strictly required, but usually we allow some public screens
            // Logic: If not authenticated and accessing protected route, redirect to login
            // For simple app:
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
                <Stack.Screen name="business-setup" options={{ title: 'Setup Business' }} />
                <Stack.Screen name="(app)" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
            </Stack>
        </AppThemeProvider>
    );
}
