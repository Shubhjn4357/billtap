import type { BottomTabNavigationOptions, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar, Surface, Text, useTheme, Portal, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore, useUserStore } from '../../store';
import { CURVED_TAB_BAR_HEIGHT, getCurvedTabBarBottomPadding } from './tabBarMetrics';

interface ExtendedOptions extends BottomTabNavigationOptions {
    tabBarTestID?: string;
}

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
    const { isConnected, isInternetReachable } = useNetworkStore();
    const user = useUserStore((store) => store.user);
    const bottomPadding = getCurvedTabBarBottomPadding(insets.bottom);
    const isOffline = isConnected === false || isInternetReachable === false;
    const initials = React.useMemo(() => {
        const source = user?.displayName?.trim() || user?.phoneNumber || 'U';
        const parts = source.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }, [user?.displayName, user?.phoneNumber]);

    const quickActions = React.useMemo(() => ([
        {
            key: 'new-bill',
            label: 'New Bill',
            subtitle: 'Open billing terminal',
            icon: 'calculator',
            route: '/(main)/(tabs)/billing',
        },
        {
            key: 'new-item',
            label: 'Add Item',
            subtitle: 'Create stock entry',
            icon: 'package-variant-plus',
            route: '/item/new',
        },
        {
            key: 'new-party',
            label: 'Add Party',
            subtitle: 'Customer or supplier',
            icon: 'account-plus',
            route: '/party/new',
        },
        {
            key: 'scan',
            label: 'Scan Barcode',
            subtitle: 'Capture SKU instantly',
            icon: 'barcode-scan',
            route: '/scan',
        },
        {
            key: 'business-suite',
            label: 'Business Suite',
            subtitle: 'Operations and compliance',
            icon: 'briefcase-outline',
            route: '/business-suite',
        },
    ]), []);

    const renderTab = (route: typeof state.routes[number], index: number) => {
        const options = descriptors[route.key].options as ExtendedOptions;
        const isFocused = state.index === index;
        const label = getTabLabel(options, route.name);

        const onPress = () => {
            const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
            }
        };

        const onLongPress = () => {
            navigation.emit({
                type: 'tabLongPress',
                target: route.key,
            });
        };

        const activeBackground = isFocused
            ? (theme.dark ? 'rgba(103, 212, 234, 0.16)' : 'rgba(14, 116, 144, 0.14)')
            : 'transparent';
        const activeColor = isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant;

        return (
            <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [
                    styles.tab,
                    { backgroundColor: activeBackground, opacity: pressed ? 0.86 : 1 },
                ]}
            >
                {options.tabBarIcon && options.tabBarIcon({
                    focused: isFocused,
                    color: activeColor,
                    size: 21,
                })}
                <Text
                    variant="labelSmall"
                    style={{ color: activeColor, marginTop: 2, fontWeight: isFocused ? '700' : '500' }}
                    numberOfLines={1}
                >
                    {label}
                </Text>
            </Pressable>
        );
    };

    return (
        <>
            <View style={[styles.container, { paddingBottom: bottomPadding }]}>
                <View
                    style={[
                        styles.content,
                        {
                            backgroundColor: theme.dark ? 'rgba(17, 26, 45, 0.86)' : 'rgba(255, 255, 255, 0.88)',
                            borderColor: theme.dark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(30, 41, 59, 0.12)',
                        },
                    ]}
                >
                    <View style={styles.tabGroup}>
                        {state.routes.slice(0, 2).map((route, index) => renderTab(route, index))}
                    </View>

                    <View style={styles.centerGap} />

                    <View style={styles.tabGroup}>
                        {state.routes.slice(2).map((route, index) => renderTab(route, index + 2))}
                    </View>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open quick actions"
                        onPress={() => setQuickActionsOpen(true)}
                        style={[
                            styles.quickFab,
                            {
                                backgroundColor: theme.colors.primary,
                                borderColor: theme.dark ? 'rgba(191, 204, 217, 0.45)' : 'rgba(255, 255, 255, 0.85)',
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="plus" size={28} color={theme.colors.onPrimary} />
                    </Pressable>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open profile"
                        onPress={() => router.push('/(main)/(tabs)/settings')}
                        style={[styles.avatarButton, { backgroundColor: theme.colors.elevation.level2 }]}
                    >
                        {user?.photoURL ? (
                            <Avatar.Image size={34} source={{ uri: user.photoURL }} />
                        ) : (
                            <Avatar.Text size={34} label={initials} />
                        )}
                    </Pressable>
                </View>
            </View>

            <Portal>
                {quickActionsOpen && (
                    <View style={styles.backdrop}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setQuickActionsOpen(false)} />
                        <Surface
                            style={[
                                styles.drawer,
                                {
                                    backgroundColor: theme.dark ? 'rgba(17, 26, 45, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                                    borderColor: theme.dark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(30, 41, 59, 0.12)',
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
                            {quickActions.map((action) => (
                                <Pressable
                                    key={action.key}
                                    style={({ pressed }) => [
                                        styles.actionRow,
                                        {
                                            backgroundColor: pressed
                                                ? (theme.dark ? 'rgba(51, 65, 85, 0.42)' : 'rgba(226, 232, 240, 0.54)')
                                                : 'transparent',
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
                            ))}
                        </Surface>
                    </View>
                )}
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
        zIndex: 1000, // Ensure it sits on top of content
        elevation: 20,
    },
    content: {
        width: '95%',
        height: CURVED_TAB_BAR_HEIGHT,
        borderRadius: 28,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        overflow: 'visible',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
        elevation: 12,
    },
    tabGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
    },
    centerGap: {
        width: 76,
    },
    tab: {
        width: 62,
        marginHorizontal: 4,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        paddingHorizontal: 4,
    },
    quickFab: {
        position: 'absolute',
        top: -24,
        alignSelf: 'center',
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
        elevation: 12,
    },
    avatarButton: {
        position: 'absolute',
        right: 10,
        top: -18,
        borderRadius: 18,
        padding: 2,
    },
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(2, 6, 23, 0.24)',
    },
    drawer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
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
        borderRadius: 14,
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
