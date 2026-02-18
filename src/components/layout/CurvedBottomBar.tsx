import type { BottomTabNavigationOptions, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface, Text, useTheme, Portal, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotionPresence, MotionView } from '../motion/Motion';
import { useNetworkStore } from '../../store';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import {
    CURVED_TAB_BAR_HEIGHT,
    SIDEBAR_NAV_MARGIN,
    SIDEBAR_NAV_WIDTH,
    getCurvedTabBarBottomPadding,
    shouldUseSidebarNavigation,
} from './tabBarMetrics';
import { DesignSystem } from '../../constants/DesignSystem';

interface ExtendedOptions extends BottomTabNavigationOptions {
    tabBarTestID?: string;
}

const isRouteVisibleInTabBar = (options: ExtendedOptions) => {
    const href = (options as ExtendedOptions & { href?: unknown }).href;
    return href !== null;
};

const getTabLabel = (options: ExtendedOptions, routeName: string) => {
    if (typeof options.tabBarLabel === 'string') {
        return options.tabBarLabel;
    }
    if (typeof options.title === 'string') {
        return options.title;
    }
    return routeName;
};

export const CurvedBottomBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
    const [quickActionsOpen, setQuickActionsOpen] = React.useState(false);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { isConnected, isInternetReachable } = useNetworkStore();
    const {
        canOpenBilling,
        canCreateSale,
        canCreatePurchase,
        canManageInventory,
        canManageParties,
        canAccessBusinessSuite,
    } = useOrganizationAccess();

    const sidebarLayout = shouldUseSidebarNavigation(width);
    const bottomPadding = getCurvedTabBarBottomPadding(insets.bottom);
    const isOffline = isConnected === false || isInternetReachable === false;
    const compactLayout = width < 390;
    const tabButtonWidth = compactLayout ? 46 : width < 430 ? 50 : 54;
    const tabButtonHeight = compactLayout ? 46 : 48;
    const tabIconSize = compactLayout ? 20 : 21;
    const quickFabSize = compactLayout ? 50 : 56;
    const centerGapWidth = quickFabSize + (compactLayout ? 16 : 24);
    const contentHorizontalPadding = compactLayout ? 4 : 8;
    const contentWidth = width < 420 ? '97.5%' : '95.5%';
    const quickFabOffset = compactLayout ? -20 : -24;

    const routeIndexByKey = React.useMemo(
        () => new Map(state.routes.map((route, index) => [route.key, index])),
        [state.routes]
    );

    const tabRoutes = React.useMemo(
        () => state.routes.filter((route) => {
            const options = descriptors[route.key].options as ExtendedOptions;
            if (!isRouteVisibleInTabBar(options)) return false;
            return route.name !== 'settings';
        }),
        [descriptors, state.routes]
    );

    const leftRoutes = tabRoutes.slice(0, 2);
    const rightRoutes = tabRoutes.slice(2);
    const leftSlots = React.useMemo(
        () => [leftRoutes[0] ?? null, leftRoutes[1] ?? null],
        [leftRoutes]
    );
    const rightSlots = React.useMemo(
        () => [rightRoutes[0] ?? null, rightRoutes[1] ?? null],
        [rightRoutes]
    );

    const quickActions = React.useMemo(
        () => ([
            {
                key: 'new-bill',
                label: 'New Bill',
                subtitle: 'Open billing terminal',
                icon: 'calculator',
                route: '/(main)/(tabs)/billing',
                enabled: canOpenBilling && (canCreateSale || canCreatePurchase),
            },
            {
                key: 'settlements',
                label: 'Settlements',
                subtitle: 'Settle unpaid invoices',
                icon: 'cash-check',
                route: '/transaction/settlements',
                enabled: canOpenBilling,
            },
            {
                key: 'new-item',
                label: 'Add Item',
                subtitle: 'Create stock entry',
                icon: 'package-variant-plus',
                route: '/item/new',
                enabled: canManageInventory,
            },
            {
                key: 'new-party',
                label: 'Parties',
                subtitle: 'Customers and suppliers',
                icon: 'account-multiple-plus-outline',
                route: '/party',
                enabled: canManageParties,
            },
            {
                key: 'scan',
                label: 'Scan Barcode',
                subtitle: 'Capture SKU instantly',
                icon: 'barcode-scan',
                route: '/scan',
                enabled: canManageInventory || canOpenBilling,
            },
            {
                key: 'business-suite',
                label: 'Business Suite',
                subtitle: 'Operations and compliance',
                icon: 'briefcase-outline',
                route: '/business-suite',
                enabled: canAccessBusinessSuite,
            },
        ]).filter((entry) => entry.enabled),
        [
            canAccessBusinessSuite,
            canCreatePurchase,
            canCreateSale,
            canManageInventory,
            canManageParties,
            canOpenBilling,
        ]
    );

    const getTabState = (route: typeof state.routes[number]) => {
        const index = routeIndexByKey.get(route.key) ?? 0;
        const options = descriptors[route.key].options as ExtendedOptions;
        const isFocused = state.index === index;
        const label = getTabLabel(options, route.name);
        return { index, options, isFocused, label };
    };

    const onTabPress = (route: typeof state.routes[number], isFocused: boolean) => {
        const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
        }
    };

    const onTabLongPress = (route: typeof state.routes[number]) => {
        navigation.emit({
            type: 'tabLongPress',
            target: route.key,
        });
    };

    const renderBottomTab = (route: typeof state.routes[number] | null, slotKey: string) => {
        if (!route) {
            return <View key={slotKey} style={[styles.tabPlaceholder, { width: tabButtonWidth, height: tabButtonHeight }]} />;
        }

        const { options, isFocused, label } = getTabState(route);
        const activeBackground = isFocused ? theme.colors.primaryContainer : 'transparent';
        const activeColor = isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant;

        return (
            <MotionView
                key={route.key}
                animate={{ translateY: isFocused ? -2 : 0, scale: isFocused ? 1.03 : 1 }}
                transition={{ type: 'spring', damping: 16, stiffness: 260 }}
            >
                <Pressable
                    accessibilityRole="tab"
                    accessibilityState={isFocused ? { selected: true } : {}}
                    accessibilityLabel={options.tabBarAccessibilityLabel}
                    testID={options.tabBarTestID}
                    onPress={() => onTabPress(route, isFocused)}
                    onLongPress={() => onTabLongPress(route)}
                    style={({ pressed }) => [
                        styles.tab,
                        {
                            backgroundColor: activeBackground,
                            opacity: pressed ? 0.86 : 1,
                            width: tabButtonWidth,
                            height: tabButtonHeight,
                        },
                    ]}
                >
                    {options.tabBarIcon && options.tabBarIcon({
                        focused: isFocused,
                        color: activeColor,
                        size: tabIconSize,
                    })}
                    <Text
                        variant="labelSmall"
                        style={{ color: activeColor, marginTop: 2, fontWeight: isFocused ? '700' : '500' }}
                        numberOfLines={1}
                    >
                        {label}
                    </Text>
                </Pressable>
            </MotionView>
        );
    };

    const renderSidebarTab = (route: typeof state.routes[number]) => {
        const { options, isFocused, label } = getTabState(route);
        const activeBackground = isFocused ? theme.colors.primaryContainer : 'transparent';
        const activeColor = isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant;

        return (
            <MotionView
                key={route.key}
                animate={{ scale: isFocused ? 1.03 : 1 }}
                transition={{ type: 'spring', damping: 16, stiffness: 240 }}
            >
                <Pressable
                    accessibilityRole="tab"
                    accessibilityState={isFocused ? { selected: true } : {}}
                    accessibilityLabel={options.tabBarAccessibilityLabel}
                    testID={options.tabBarTestID}
                    onPress={() => onTabPress(route, isFocused)}
                    onLongPress={() => onTabLongPress(route)}
                    style={({ pressed }) => [
                        styles.sidebarTab,
                        {
                            backgroundColor: activeBackground,
                            opacity: pressed ? 0.86 : 1,
                        },
                    ]}
                >
                    {options.tabBarIcon && options.tabBarIcon({
                        focused: isFocused,
                        color: activeColor,
                        size: 22,
                    })}
                    <Text
                        variant="labelSmall"
                        style={[styles.sidebarTabLabel, { color: activeColor, fontWeight: isFocused ? '700' : '500' }]}
                        numberOfLines={2}
                    >
                        {label}
                    </Text>
                </Pressable>
            </MotionView>
        );
    };

    const renderNavigation = () => {
        if (sidebarLayout) {
            return (
                <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                    <MotionView
                        style={[
                            styles.sidebarContainer,
                            {
                                top: insets.top + SIDEBAR_NAV_MARGIN,
                                bottom: insets.bottom + SIDEBAR_NAV_MARGIN,
                                left: insets.left + SIDEBAR_NAV_MARGIN,
                                width: SIDEBAR_NAV_WIDTH,
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.outlineVariant,
                            },
                        ]}
                        from={{ opacity: 0, translateX: -12 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        transition={{ type: 'timing', duration: 220 }}
                    >
                        <View style={styles.sidebarTabsWrap}>
                            {tabRoutes.map(renderSidebarTab)}
                        </View>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Open quick actions"
                            onPress={() => setQuickActionsOpen(true)}
                            style={[
                                styles.sidebarFabButton,
                                {
                                    backgroundColor: theme.colors.primary,
                                    borderColor: theme.colors.outlineVariant,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons name="plus" size={22} color={theme.colors.onPrimary} />
                        </Pressable>
                    </MotionView>
                </View>
            );
        }

        return (
            <View style={[styles.container, { paddingBottom: bottomPadding }]}>
                <MotionView
                    style={[
                        styles.content,
                        {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.outlineVariant,
                            width: contentWidth,
                            paddingHorizontal: contentHorizontalPadding,
                        },
                    ]}
                    from={{ opacity: 0, translateY: 22 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 220 }}
                >
                    <View style={styles.tabGroup}>
                        {leftSlots.map((route, index) => renderBottomTab(route, `left-${index}`))}
                    </View>

                    <View style={[styles.centerGap, { width: centerGapWidth }]} />

                    <View style={styles.tabGroup}>
                        {rightSlots.map((route, index) => renderBottomTab(route, `right-${index}`))}
                    </View>

                    <MotionView
                        style={[
                            styles.quickFabWrap,
                            {
                                backgroundColor: theme.colors.primary,
                                borderColor: theme.colors.outlineVariant,
                                width: quickFabSize,
                                height: quickFabSize,
                                borderRadius: quickFabSize / 2,
                                top: quickFabOffset,
                                marginLeft: -quickFabSize / 2,
                            },
                        ]}
                        animate={{ scale: quickActionsOpen ? 0.94 : 1, translateY: quickActionsOpen ? 3 : 0 }}
                        transition={{ type: 'spring', damping: 14, stiffness: 230 }}
                    >
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Open quick actions"
                            onPress={() => setQuickActionsOpen(true)}
                            style={[styles.quickFabPressable, { borderRadius: quickFabSize / 2 }]}
                        >
                            <MaterialCommunityIcons name="plus" size={compactLayout ? 22 : 24} color={theme.colors.onPrimary} />
                        </Pressable>
                    </MotionView>
                </MotionView>
            </View>
        );
    };

    return (
        <>
            {renderNavigation()}

            <Portal>
                <MotionPresence>
                    {quickActionsOpen && (
                        <MotionView
                            key="quick-actions-backdrop"
                            style={[
                                styles.backdrop,
                                { backgroundColor: theme.colors.backdrop },
                            ]}
                            from={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: 'timing', duration: 180 }}
                        >
                            <Pressable style={StyleSheet.absoluteFill} onPress={() => setQuickActionsOpen(false)} />
                            <MotionView
                                from={{ translateY: 28, opacity: 0.92 }}
                                animate={{ translateY: 0, opacity: 1 }}
                                exit={{ translateY: 20, opacity: 0 }}
                                transition={{ type: 'timing', duration: 220 }}
                            >
                                <Surface
                                    style={[
                                        styles.drawer,
                                        {
                                            backgroundColor: theme.colors.surface,
                                            borderColor: theme.colors.outlineVariant,
                                        },
                                    ]}
                                >
                                    <View style={styles.drawerHeader}>
                                        <View>
                                            <Text variant="titleMedium" style={{ fontWeight: '800' }}>
                                                Quick Operations
                                            </Text>
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                                                {isOffline ? 'Offline mode: actions queue safely.' : 'Live mode: sync is active.'}
                                            </Text>
                                        </View>
                                        <Pressable onPress={() => setQuickActionsOpen(false)} style={styles.closeIcon}>
                                            <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurfaceVariant} />
                                        </Pressable>
                                    </View>
                                    <Divider style={{ marginBottom: 6 }} />
                                    {quickActions.map((action, index) => (
                                        <MotionView
                                            key={action.key}
                                            from={{ opacity: 0, translateY: 8 }}
                                            animate={{ opacity: 1, translateY: 0 }}
                                            transition={{
                                                type: 'timing',
                                                duration: 160,
                                                delay: 40 * index,
                                            }}
                                        >
                                            <Pressable
                                                style={({ pressed }) => [
                                                    styles.actionRow,
                                                    {
                                                        backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent',
                                                    },
                                                ]}
                                                onPress={() => {
                                                    setQuickActionsOpen(false);
                                                    router.push(action.route as never);
                                                }}
                                            >
                                                <View style={[styles.actionIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
                                                    <MaterialCommunityIcons
                                                        name={action.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                                                        size={18}
                                                        color={theme.colors.onSecondaryContainer}
                                                    />
                                                </View>
                                                <View style={styles.actionTextWrap}>
                                                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                                                        {action.label}
                                                    </Text>
                                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                        {action.subtitle}
                                                    </Text>
                                                </View>
                                                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                                            </Pressable>
                                        </MotionView>
                                    ))}
                                </Surface>
                            </MotionView>
                        </MotionView>
                    )}
                </MotionPresence>
            </Portal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        zIndex: 1000,
        elevation: 20,
    },
    content: {
        height: CURVED_TAB_BAR_HEIGHT,
        position: 'relative',
        flexDirection: 'row',
        borderRadius: DesignSystem.radius.lg,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        overflow: 'visible',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 4,
    },
    tabGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    centerGap: {
        width: 88,
    },
    tab: {
        marginHorizontal: 2,
        borderRadius: DesignSystem.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    tabPlaceholder: {
        width: 54,
        height: 48,
    },
    quickFabWrap: {
        position: 'absolute',
        left: '50%',
        borderWidth: 1,
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 6,
    },
    quickFabPressable: {
        flex: 1,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sidebarContainer: {
        position: 'absolute',
        borderRadius: DesignSystem.radius.lg,
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 6,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 5,
        zIndex: 1000,
    },
    sidebarTabsWrap: {
        flex: 1,
        gap: 6,
        justifyContent: 'center',
    },
    sidebarTab: {
        borderRadius: DesignSystem.radius.sm,
        minHeight: 58,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    sidebarTabLabel: {
        marginTop: 3,
        textAlign: 'center',
    },
    sidebarFabButton: {
        marginTop: 8,
        height: 46,
        borderRadius: DesignSystem.radius.sm,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    drawer: {
        borderTopLeftRadius: DesignSystem.radius.xl,
        borderTopRightRadius: DesignSystem.radius.xl,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 22,
    },
    drawerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    closeIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: DesignSystem.radius.sm,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    actionIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    actionTextWrap: {
        flex: 1,
    },
});
