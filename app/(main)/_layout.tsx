import { Redirect, Stack, useSegments } from 'expo-router';
import { useUserStore } from '../../src/store';
import { LoadingScreen } from '../../src/components/common/LoadingScreen';

export default function MainLayout() {
    const { user, isAuthenticated, isLoading, hasHydrated: userHydrated } = useUserStore();
    const segments = useSegments() as string[];
    const currentSegment = segments[1]; // segments[0] is '(main)'

    if (!userHydrated || isLoading) {
        return <LoadingScreen message="Loading application..." />;
    }

    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    if (!user?.businessName && currentSegment !== 'business-setup') {
        return <Redirect href="/(main)/business-setup" />;
    }

    return (
        <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="business-setup" options={{ headerShown: true, title: 'Business Setup' }} />
            <Stack.Screen name="subscription" options={{ headerShown: true, title: 'Subscription' }} />
            <Stack.Screen name="admin" options={{ headerShown: true, title: 'Admin Panel' }} />
            <Stack.Screen name="operations" options={{ headerShown: true, title: 'Operations Controls' }} />
            <Stack.Screen name="business-suite" options={{ headerShown: true, title: 'Business Suite' }} />
            <Stack.Screen name="accounting/index" options={{ headerShown: true, title: 'Accounting Suite' }} />
            <Stack.Screen name="accounting/accounts" options={{ headerShown: true, title: 'Chart Of Accounts' }} />
            <Stack.Screen name="accounting/journal" options={{ headerShown: true, title: 'Journal Entry' }} />
            <Stack.Screen name="accounting/trial-balance" options={{ headerShown: true, title: 'Trial Balance' }} />
            <Stack.Screen name="accounting/profit-loss" options={{ headerShown: true, title: 'Profit & Loss' }} />
            <Stack.Screen name="accounting/balance-sheet" options={{ headerShown: true, title: 'Balance Sheet' }} />
            <Stack.Screen name="accounting/gst" options={{ headerShown: true, title: 'GST Summary' }} />
            <Stack.Screen name="accounting/inventory" options={{ headerShown: true, title: 'Inventory Insights' }} />
            <Stack.Screen name="item/[id]" options={{ title: 'Item Details', headerBackTitle: 'Stock' }} />
            <Stack.Screen name="scan" options={{ title: 'Scan Barcode' }} />
        </Stack>
    );
}
