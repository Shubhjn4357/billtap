import { Tabs } from 'expo-router';
import CustomTabBar from '../../components/CustomTabBar';
import { useTheme } from 'react-native-paper';
import { Platform } from 'react-native';

export default function AppLayout() {
  const theme = useTheme();

  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false, // We will use custom headers or simple headers in screens
        tabBarHideOnKeyboard: true,
        lazy: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home' }}
      />
      <Tabs.Screen
        name="stock"
        options={{ title: 'Stock' }}
      />
      <Tabs.Screen
        name="billing"
        options={{ title: 'Bill', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings' }}
      />
    </Tabs>
  );
}
