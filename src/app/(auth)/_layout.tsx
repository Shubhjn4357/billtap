// @ts-nocheck
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/theme';

export default function AuthLayout() {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'fade',
            }}
        >
            <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack>
    );
}


