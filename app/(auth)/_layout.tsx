import { Redirect, Stack } from 'expo-router';
import { useUserStore } from '../../src/store';
import { LoadingScreen } from '../../src/components/common/LoadingScreen';

export default function AuthLayout() {
    const { isAuthenticated, isLoading, hasHydrated: userHydrated } = useUserStore();

    if (!userHydrated || isLoading) {
        return <LoadingScreen message="Checking authentication..." />;
    }

    if (isAuthenticated) {
        return <Redirect href="/(main)/(tabs)/home" />;
    }

    return (
        <Stack>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack>
    );
}
