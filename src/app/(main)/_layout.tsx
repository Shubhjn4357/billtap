import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/theme';
import { VahiTabBar } from '../../components/VahiTabBar';

export default function MainLayout() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = Colors[scheme ?? 'light'];

    return (
        <Tabs
            tabBar={(props) => <VahiTabBar {...props} />}
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerShadowVisible: false,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{ title: 'Home', headerTitle: 'Vahi' }}
            />
            <Tabs.Screen
                name="billing"
                options={{ title: 'Billing', headerShown: false }}
            />
            <Tabs.Screen
                name="inventory"
                options={{ title: 'Inventory', headerTitle: 'Inventory' }}
            />
            <Tabs.Screen
                name="parties"
                options={{ title: 'Parties', headerTitle: 'Parties' }}
            />
            <Tabs.Screen
                name="accounts"
                options={{ title: 'Accounts', headerTitle: 'Accounts' }}
            />
            <Tabs.Screen
                name="more"
                options={{ title: 'More', headerShown: false }}
            />
        </Tabs>
    );
}
