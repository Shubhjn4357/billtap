import { Redirect } from 'expo-router';
import { useUserStore, useSettingsStore } from '../src/store';
import { LoadingScreen } from '../src/components/common/LoadingScreen';

export default function Index() {
    const { isAuthenticated, isLoading, user, hasHydrated: userHydrated } = useUserStore();
    const { hasSeenOnboarding, hasHydrated: settingsHydrated } = useSettingsStore();

    if (!userHydrated || !settingsHydrated || isLoading) {
        return <LoadingScreen message="Getting started..." />;
    }

    if (isAuthenticated) {
        if (!user?.businessName) {
            return <Redirect href="/(main)/business-setup" />;
        }
        return <Redirect href="/(main)/(tabs)/home" />;
    }

    if (!hasSeenOnboarding) {
        return <Redirect href="/(auth)/onboarding" />;
    }

    return <Redirect href="/(auth)/login" />;
}
