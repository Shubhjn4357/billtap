import { Redirect } from 'expo-router';
import { useUserStore, useSettingsStore } from '../src/store';

export default function Index() {
    const { isAuthenticated } = useUserStore();
    const { hasSeenOnboarding } = useSettingsStore();

    if (isAuthenticated) {
        return <Redirect href="/(tabs)/home" />;
    }

    if (!hasSeenOnboarding) {
        return <Redirect href="/onboarding" />;
    }

    return <Redirect href="/login" />;
}
