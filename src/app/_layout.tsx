import { Stack } from 'expo-router';
import { View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AnimatedSplashOverlay from '../components/AnimatedSplashOverlay';
import { AppBiometricLockOverlay } from '../components/security/AppBiometricLockOverlay';
import { DialogProvider } from '../components/providers/DialogProvider';
import { AppRuntimeProvider, useAppRuntime } from '../components/providers/AppRuntimeProvider';
import { useAppColors } from '../hooks/useAppColors';
import { queryClient } from '../state/queryClient';

function RootNavigator() {
    const colors = useAppColors();
    const {
        ready,
        biometricBusy,
        biometricLocked,
        biometricSupported,
        localPreferences,
        unlockWithBiometrics,
    } = useAppRuntime();

    if (!ready) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.primary }}>
                <AnimatedSplashOverlay ready={false} backgroundColor={colors.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack
                screenOptions={{
                    headerStyle: { backgroundColor: colors.surface },
                    headerTintColor: colors.primary,
                    contentStyle: { backgroundColor: colors.background },
                    animation: localPreferences.richMotionEnabled ? 'slide_from_right' : 'none',
                }}
            >
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(main)" options={{ headerShown: false }} />
                <Stack.Screen name="legal" options={{ headerShown: false }} />
                <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
                <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
            {biometricLocked ? (
                <AppBiometricLockOverlay
                    busy={biometricBusy}
                    supported={biometricSupported}
                    onUnlock={() => {
                        void unlockWithBiometrics();
                    }}
                />
            ) : null}
            <AnimatedSplashOverlay ready={ready} backgroundColor={colors.primary} />
        </View>
    );
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
                <DialogProvider>
                    <AppRuntimeProvider>
                        <RootNavigator />
                    </AppRuntimeProvider>
                </DialogProvider>
            </QueryClientProvider>
        </GestureHandlerRootView>
    );
}
