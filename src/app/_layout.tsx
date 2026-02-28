// @ts-nocheck
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Colors } from '../constants/theme';
import AnimatedSplashOverlay from '../components/AnimatedSplashOverlay';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getStoredToken, getStoredBusinessId } from '../api/client';

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
  const { refreshUser, setAuth } = useAuthStore();

  useEffect(() => {
    // Restore session from SecureStore on startup
    (async () => {
      const token = await getStoredToken();
      if (token) {
        await refreshUser();
      }
    })();
  }, []);

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
          <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
        </Stack>
        <AnimatedSplashOverlay />
      </QueryClientProvider>
    );
}


