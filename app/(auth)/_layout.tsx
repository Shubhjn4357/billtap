import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useUserStore } from '../../src/store';
import { LoadingScreen } from '../../src/components/common/LoadingScreen';

export default function AuthLayout() {
    const { isAuthenticated, isLoading } = useUserStore();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        // If user is authenticated, redirect to main app
        if (isAuthenticated) {
            router.replace('/(main)/(tabs)/home' as any);
        }
    }, [isAuthenticated, isLoading, router]); // Only react to auth changes, not loading state changes

    if (isLoading) {
        return <LoadingScreen message="Checking authentication..." />;
    }

    return (
        <Stack>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack>
    );
}
