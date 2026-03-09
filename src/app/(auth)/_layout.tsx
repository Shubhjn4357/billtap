import { Stack } from 'expo-router';
import { useAppColors } from '../../hooks/useAppColors';

export default function AuthLayout() {
    const colors = useAppColors();
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
            <Stack.Screen name="business-select" options={{ headerShown: false }} />
        </Stack>
    );
}


