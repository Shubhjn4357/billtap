import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useUserStore } from '../../src/store';
import { LoadingScreen } from '../../src/components/common/LoadingScreen';

export default function MainLayout() {
    const { user, isAuthenticated, isLoading } = useUserStore();
    const segments = useSegments() as string[];
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        // If user is not authenticated, redirect to login
        if (!isAuthenticated) {
            router.replace('/(auth)/login' as any);
            return;
        }

        // If user doesn't have business setup, redirect to business-setup
        // unless they're already on that screen
        const currentSegment = segments[1]; // segments[0] is '(main)'
        if (!user?.businessName && currentSegment !== 'business-setup') {
            router.replace('/(main)/business-setup' as any);
        }
    }, [isAuthenticated, isLoading, router, segments, user?.businessName]); // Only react to auth and user changes

    if (isLoading) {
        return <LoadingScreen message="Loading application..." />;
    }

    // If not authenticated, show loading while redirecting
    if (!isAuthenticated) {
        return <LoadingScreen message="Redirecting to login..." />;
    }

    return (
        <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="business-setup" options={{ headerShown: true, title: 'Business Setup' }} />
            <Stack.Screen name="subscription" options={{ headerShown: true, title: 'Subscription' }} />
            <Stack.Screen name="admin" options={{ headerShown: true, title: 'Admin Panel' }} />
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
