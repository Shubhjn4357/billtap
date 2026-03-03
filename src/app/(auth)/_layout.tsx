import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { getColors } from '../../constants/theme';

export default function AuthLayout() {
    const scheme = useColorScheme();
    const colors = getColors(scheme);
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



