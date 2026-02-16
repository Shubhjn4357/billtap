
import React, { useEffect, useMemo } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { CurvedBottomBar } from '../../../src/components/layout/CurvedBottomBar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TAB_TITLES } from '../../../src/constants/staticText';
import { useOrganizationAccess } from '../../../src/hooks/useOrganizationAccess';

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const {
    canViewDashboard,
    canManageInventory,
    canOpenBilling,
    canCreateSale,
    canCreatePurchase,
    canViewReports,
    canAccessSettings,
  } = useOrganizationAccess();

  const baseVisibility = useMemo(() => ({
    home: canViewDashboard,
    stock: canManageInventory,
    billing: canOpenBilling && (canCreateSale || canCreatePurchase),
    reports: canViewReports,
    settings: canAccessSettings,
  }), [
    canAccessSettings,
    canCreatePurchase,
    canCreateSale,
    canManageInventory,
    canOpenBilling,
    canViewDashboard,
    canViewReports,
  ]);

  const tabVisibility = useMemo(() => {
    if (Object.values(baseVisibility).some(Boolean)) {
      return baseVisibility;
    }
    return { ...baseVisibility, home: true };
  }, [baseVisibility]);

  const fallbackTab = useMemo(() => {
    const ordered: (keyof typeof tabVisibility)[] = ['home', 'stock', 'billing', 'reports', 'settings'];
    return ordered.find((entry) => tabVisibility[entry]) ?? 'home';
  }, [tabVisibility]);

  const tabGroupIndex = segments.indexOf('(tabs)');
  const currentTab = tabGroupIndex >= 0 ? segments[tabGroupIndex + 1] : null;

  useEffect(() => {
    if (!currentTab) return;
    if (currentTab in tabVisibility && !tabVisibility[currentTab as keyof typeof tabVisibility]) {
      router.replace(`/(main)/(tabs)/${fallbackTab}` as never);
    }
  }, [currentTab, fallbackTab, router, tabVisibility]);

  return (
    <Tabs
      tabBar={(props) => <CurvedBottomBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: TAB_TITLES.home,
          href: tabVisibility.home ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: TAB_TITLES.stock,
          href: tabVisibility.stock ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="package-variant" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: TAB_TITLES.bill,
          href: tabVisibility.billing ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calculator" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: TAB_TITLES.reports,
          href: tabVisibility.reports ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: TAB_TITLES.settings,
          href: tabVisibility.settings ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />

    </Tabs>
  );
}
