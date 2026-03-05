import { Tabs } from 'expo-router';
import { VahiTabBar } from '../../components/VahiTabBar';
import { GoToPalette } from '../../components/navigation/GoToPalette';
import { AppDrawerLayout } from '../../components/layout/AppDrawerLayout';

export default function MainLayout() {
    return (
        <AppDrawerLayout>
            <Tabs
                tabBar={(props) => <VahiTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{ title: 'Dashboard' }}
                />
                <Tabs.Screen
                    name="billing"
                    options={{ href: null, title: 'Billing', headerShown: false }}
                />
                <Tabs.Screen
                    name="inventory"
                    options={{ href: null, title: 'Inventory' }}
                />
                <Tabs.Screen
                    name="accounts"
                    options={{ href: null, title: 'Accounts' }}
                />
                <Tabs.Screen
                    name="reports"
                    options={{ href: null, title: 'Reports' }}
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
        </AppDrawerLayout>
    );
}
