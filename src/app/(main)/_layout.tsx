import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { getColors } from '../../constants/theme';
import { VahiTabBar } from '../../components/VahiTabBar';

export default function MainLayout() {
    const scheme = useColorScheme();
    const colors = getColors(scheme);

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
                name="accounts"
                options={{ title: 'Accounts', headerTitle: 'Accounts' }}
            />
            <Tabs.Screen
                name="reports"
                options={{ title: 'Reports', headerTitle: 'Reports' }}
            />
            <Tabs.Screen
                name="more"
                options={{ title: 'More', headerShown: false }}
            />
            <Tabs.Screen
                name="parties"
                options={{ href: null }}
            />
        </Tabs>
    );
}
