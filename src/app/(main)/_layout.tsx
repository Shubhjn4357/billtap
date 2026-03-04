import { Tabs } from 'expo-router';
import { useColorScheme, View } from 'react-native';
import { getColors } from '../../constants/theme';
import { VahiTabBar } from '../../components/VahiTabBar';
import { GoToPalette } from '../../components/navigation/GoToPalette';

export default function MainLayout() {
    const scheme = useColorScheme();
    const colors = getColors(scheme);

    return (
        <View style={{ flex: 1 }}>
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
                    options={{ title: 'Dashboard', headerTitle: 'Dashboard' }}
                />
                <Tabs.Screen
                    name="billing"
                    options={{ href: null, title: 'Billing', headerShown: false }}
                />
                <Tabs.Screen
                    name="inventory"
                    options={{ href: null, title: 'Inventory', headerTitle: 'Inventory' }}
                />
                <Tabs.Screen
                    name="accounts"
                    options={{ href: null, title: 'Accounts', headerTitle: 'Accounts' }}
                />
                <Tabs.Screen
                    name="reports"
                    options={{ href: null, title: 'Reports', headerTitle: 'Reports' }}
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
            <GoToPalette />
        </View>
    );
}
