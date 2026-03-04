import { Stack } from 'expo-router';
import { Platform, View, useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getColors, setThemePreference } from '../constants/theme';
import AnimatedSplashOverlay from '../components/AnimatedSplashOverlay';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getStoredBusinessId, getStoredToken } from '../api/client';
import NetInfo from '@react-native-community/netinfo';
import { offlineSyncService } from '../services/offlineSyncService';
import { settingsApi } from '../api/endpoints';
import * as SecureStore from 'expo-secure-store';
import {
  parseRoleActionOverrides,
  parseRoleModuleOverrides,
  ROLE_ACTION_OVERRIDES_KEY,
  ROLE_MODULE_OVERRIDES_KEY,
  setRoleAccessOverrides,
} from '../utils/accessControl';
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

const PENDING_SETUP_KEY_PREFIX = 'vahi_pending_setup_';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const { refreshUser, restoreCachedSession, markBootstrapped } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let cleanupNotifications = () => {};

    // Restore session and start offline stack
    (async () => {
      setRoleAccessOverrides({ actionOverrides: {}, moduleOverrides: {} });
      await restoreCachedSession();
      const token = await getStoredToken();
      if (token) {
        await refreshUser();

        const activeBusinessId = await getStoredBusinessId();
        if (activeBusinessId) {
          const pendingKey = `${PENDING_SETUP_KEY_PREFIX}${activeBusinessId}`;
          const pendingPayload = await SecureStore.getItemAsync(pendingKey);
          if (pendingPayload) {
            try {
              const parsed = JSON.parse(pendingPayload) as Record<string, unknown>;
              await settingsApi.update('GENERAL', { data: parsed });
              await SecureStore.deleteItemAsync(pendingKey);
            } catch {
              // Keep pending setup for next successful online sync attempt.
            }
          }
        }

        try {
          const generalSettings = await settingsApi.get('GENERAL');
          const mode = (generalSettings.data as Record<string, unknown> | undefined)?.theme_mode;
          setThemePreference(typeof mode === 'string' ? mode : 'SYSTEM');
        } catch {
          // Keep system theme when GENERAL settings are not yet available.
        }

        try {
          const securitySettings = await settingsApi.get('SECURITY');
          const security = (securitySettings.data ?? {}) as Record<string, unknown>;
          setRoleAccessOverrides({
            actionOverrides: parseRoleActionOverrides(security[ROLE_ACTION_OVERRIDES_KEY]),
            moduleOverrides: parseRoleModuleOverrides(security[ROLE_MODULE_OVERRIDES_KEY]),
          });
        } catch {
          setRoleAccessOverrides({ actionOverrides: {}, moduleOverrides: {} });
        }

        void offlineSyncService.flushQueue();
        offlineSyncService.startAutoSync();
        startForegroundSync(60_000);
        void registerBackgroundSync();
      } else {
        markBootstrapped();
      }

      if (Platform.OS !== 'web') {
        const granted = await requestNotificationPermissions();
        if (granted) {
          await registerAndroidChannels();
        }
        cleanupNotifications = registerNotificationListeners();
      }

      if (active) {
        setReady(true);
      }
    })();

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;
      offlineSyncService.onNetworkStateChange(isOnline);
    });

    return () => {
      active = false;
      unsubscribeNetInfo();
      cleanupNotifications();
      offlineSyncService.stopAutoSync();
      stopForegroundSync();
    };
  }, [markBootstrapped, refreshUser, restoreCachedSession]);

  if (!ready) {
    return (
      <QueryClientProvider client={queryClient}>
        <View style={{ flex: 1, backgroundColor: colors.primary }}>
          <AnimatedSplashOverlay ready={false} backgroundColor={colors.primary} />
        </View>
      </QueryClientProvider>
    );
  }

  return (
      <QueryClientProvider client={queryClient}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
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
        <AnimatedSplashOverlay ready={ready} backgroundColor={colors.primary} />
        </View>
      </QueryClientProvider>
    );
}



