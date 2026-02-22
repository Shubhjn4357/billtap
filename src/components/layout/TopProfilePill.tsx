import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MotionView } from '../motion/Motion';
import { Avatar, Divider, Menu, useTheme, IconButton, Badge, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore, useUserStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { DesignSystem } from '../../constants/DesignSystem';
import { SideDrawer } from '../navigation/SideDrawer';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';

export const TopProfilePill: React.FC = () => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { signOut } = useAuth();
    const user = useUserStore((state) => state.user);
    const { isConnected, isInternetReachable } = useNetworkStore();

    const [menuVisible, setMenuVisible] = React.useState(false);
    const [drawerVisible, setDrawerVisible] = React.useState(false);
    const [orgMenuVisible, setOrgMenuVisible] = React.useState(false);

    const isOffline = isConnected === false || isInternetReachable === false;

    // Quick Actions Permissions
    const {
        canOpenBilling,
        canCreateSale,
        canCreatePurchase,
        canManageInventory,
        canManageParties,
        canAccessBusinessSuite,
    } = useOrganizationAccess();

    const quickActions = useMemo(
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

    const initials = React.useMemo(() => {
        const source = user?.displayName?.trim() || user?.phoneNumber || 'U';
        const parts = source.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }, [user?.displayName, user?.phoneNumber]);

    const handleLogout = async () => {
        setMenuVisible(false);
        await signOut();
        router.replace('/(auth)/login');
    };

    return (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlay]}>
            <MotionView
                style={[
                    styles.headerContainer,
                    { top: insets.top + 6 },
                ]}
                from={{ opacity: 0, translateY: -12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 240 }}
            >
                {/* Left Side: Hamburger Menu */}
                <View style={[styles.pillLeft, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                    <IconButton
                        icon="menu"
                        size={24}
                        iconColor={theme.colors.onSurface}
                        onPress={() => setDrawerVisible(true)}
                        style={styles.iconBtn}
                    />
                </View>

                {/* Center Title / Org Switcher */}
                <View style={styles.centerSection}>
                    <Menu
                        visible={orgMenuVisible}
                        onDismiss={() => setOrgMenuVisible(false)}
                        anchorPosition="bottom"
                        contentStyle={[
                            styles.menuContent,
                            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
                        ]}
                        anchor={
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Switch organization"
                                onPress={() => setOrgMenuVisible(true)}
                                style={[styles.orgPressable, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
                            >
                                <Text
                                    variant="titleSmall"
                                    numberOfLines={1}
                                    style={{ fontWeight: '700', color: theme.colors.onSurface }}
                                >
                                    {user?.businessName || 'Your Business'} ▾
                                </Text>
                                <Text
                                    variant="labelSmall"
                                    numberOfLines={1}
                                    style={{ color: theme.colors.onSurfaceVariant }}
                                >
                                    Hello, {user?.displayName?.split(' ')[0] || 'User'}
                                </Text>
                            </Pressable>
                        }
                    >
                        <Menu.Item
                            leadingIcon="check-circle"
                            title={user?.businessName || 'Current Organization'}
                            titleStyle={{ fontWeight: '700' }}
                            onPress={() => setOrgMenuVisible(false)}
                        />
                        <Menu.Item
                            leadingIcon="swap-horizontal"
                            title="Switch Organization"
                            onPress={() => {
                                setOrgMenuVisible(false);
                                router.push('/org-select' as never);
                            }}
                        />
                        <Menu.Item
                            leadingIcon="domain-plus"
                            title="Create Organization"
                            onPress={() => {
                                setOrgMenuVisible(false);
                                router.push('/org-create' as never);
                            }}
                        />
                    </Menu>
                </View>

                {/* Right Side: Notifications & Profile */}
                <View style={styles.rightGroup}>
                    {/* Notification Icon */}
                    <View style={[styles.pillNotify, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                        <IconButton
                            icon="bell-outline"
                            size={22}
                            iconColor={theme.colors.onSurface}
                            onPress={() => router.push('/notifications')}
                            style={styles.iconBtn}
                        />
                        <Badge size={14} style={styles.notifyBadge}>2</Badge>
                    </View>

                    {/* Profile Avatar */}
                    <Menu
                        visible={menuVisible}
                        onDismiss={() => setMenuVisible(false)}
                        anchorPosition="bottom"
                        contentStyle={[
                            styles.menuContent,
                            {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.outlineVariant,
                            },
                        ]}
                        anchor={(
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Open profile menu"
                                onPress={() => setMenuVisible(true)}
                                style={[styles.pillProfile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
                            >
                                {user?.photoURL ? (
                                    <Avatar.Image size={34} source={{ uri: user.photoURL }} />
                                ) : (
                                    <Avatar.Text size={34} label={initials} />
                                )}
                                <MotionView
                                    style={[
                                        styles.statusDot,
                                        {
                                            backgroundColor: isOffline ? theme.colors.error : theme.colors.secondary,
                                            borderColor: theme.colors.background,
                                        },
                                    ]}
                                    animate={isOffline ? { scale: 1, opacity: 1 } : { scale: 1.16, opacity: 0.86 }}
                                    transition={isOffline
                                        ? { type: 'timing', duration: 120 }
                                        : {
                                            type: 'timing',
                                            duration: 900,
                                            loop: true,
                                            repeatReverse: true,
                                        }}
                                />
                            </Pressable>
                        )}
                    >
                        <Menu.Item
                            leadingIcon="account-circle-outline"
                            title="Profile"
                            onPress={() => {
                                setMenuVisible(false);
                                router.push('/profile');
                            }}
                        />
                        <Menu.Item
                            leadingIcon="cog-outline"
                            title="Settings"
                            onPress={() => {
                                setMenuVisible(false);
                                router.push('/(main)/(tabs)/settings');
                            }}
                        />
                        <Divider />
                        <Menu.Item
                            leadingIcon="logout"
                            title="Logout"
                            onPress={() => { void handleLogout(); }}
                        />
                    </Menu>
                </View>
            </MotionView>

            <SideDrawer
                visible={drawerVisible}
                onClose={() => setDrawerVisible(false)}
                actions={quickActions}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        zIndex: 1200,
        elevation: 40,
    },
    headerContainer: {
        position: 'absolute',
        left: 14,
        right: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 2,
    },
    pillLeft: {
        height: 42,
        width: 42,
        borderRadius: 21,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
    },
    centerSection: {
        flex: 1,
        marginHorizontal: 10,
    },
    orgPressable: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 21,
        borderWidth: 1,
        justifyContent: 'center',
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
    },
    rightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pillNotify: {
        height: 42,
        width: 42,
        borderRadius: 21,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
    },
    notifyBadge: {
        position: 'absolute',
        top: 6,
        right: 8,
        backgroundColor: '#E63946',
    },
    pillProfile: {
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        paddingHorizontal: 4,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
    },
    iconBtn: {
        margin: 0,
    },
    statusDot: {
        position: 'absolute',
        right: 2,
        bottom: 4,
        width: 9,
        height: 9,
        borderRadius: 4.5,
        borderWidth: 2,
    },
    menuContent: {
        marginTop: 6,
        borderWidth: 1,
        borderRadius: DesignSystem.radius.md,
    },
});
