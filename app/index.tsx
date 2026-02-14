import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useUserStore, useSettingsStore } from '../src/store';
import { LoadingScreen } from '../src/components/common/LoadingScreen';

export default function Index() {
    const { isAuthenticated, isLoading, user } = useUserStore();
    const { hasSeenOnboarding } = useSettingsStore();
    const router = useRouter();

    useEffect(() => {
        // Wait for loading to complete
        if (isLoading) return;

        // Redirect based on authentication state
        if (isAuthenticated) {
            // Check if business setup is needed
            if (!user?.businessName) {
                router.replace('/(main)/business-setup' as any);
            } else {
                router.replace('/(main)/(tabs)/home' as any);
            }
        } else {
            // Redirect to onboarding or login
            if (!hasSeenOnboarding) {
                router.replace('/(auth)/onboarding' as any);
            } else {
                router.replace('/(auth)/login' as any);
            }
        }
    }, [isAuthenticated, isLoading, hasSeenOnboarding, user?.businessName, router]);

    return <LoadingScreen message="Getting started..." />;
}
