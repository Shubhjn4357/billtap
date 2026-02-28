// @ts-nocheck
import { Stack } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Colors } from '../constants/theme';
import AnimatedSplashOverlay from '../components/AnimatedSplashOverlay';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getStoredToken } from '../api/client';
import NetInfo from '@react-native-community/netinfo';
import { offlineSyncService } from '../services/offlineSyncService';
import {
  registerBackgroundSync,
  startForegroundSync,
  stopForegroundSync,
} from '../services/backgroundSyncService';
import {
  registerAndroidChannels,
  registerNotificationListeners,
  requestNotificationPermissions,
} from '../services/notificationService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { refreshUser } = useAuthStore();

  useEffect(() => {
    let cleanupNotifications = () => {};

    // Restore session and start offline stack
    (async () => {
      const token = await getStoredToken();
      if (token) {
        await refreshUser();
        void offlineSyncService.flushQueue();
        offlineSyncService.startAutoSync();
        startForegroundSync(60_000);
        void registerBackgroundSync();
      }

      if (Platform.OS !== 'web') {
        const granted = await requestNotificationPermissions();
        if (granted) {
          await registerAndroidChannels();
        }
        cleanupNotifications = registerNotificationListeners();
      }
    })();

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;
      offlineSyncService.onNetworkStateChange(isOnline);
    });

    return () => {
      unsubscribeNetInfo();
      cleanupNotifications();
      offlineSyncService.stopAutoSync();
      stopForegroundSync();
    };
  }, [refreshUser]);

  return (
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.primary,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
          <Stack.Screen name="legal" options={{ headerShown: false }} />
          <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
        </Stack>
        <AnimatedSplashOverlay />
      </QueryClientProvider>
    );
}


