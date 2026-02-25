import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Divider, IconButton, Menu, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { businessSuiteService, OrganizationMembership } from '../../api/businessSuiteService';
import { DesignSystem } from '../../constants/DesignSystem';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useNetworkStore, useOrganizationStore, useSettingsStore, useUserStore } from '../../store';
import { useAppDialog } from '../providers/DialogProvider';
import { SideDrawer } from '../navigation/SideDrawer';

export const TopProfilePill: React.FC = () => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const dialog = useAppDialog();
    const { signOut } = useAuth();
    const user = useUserStore((state) => state.user);
    const { isConnected, isInternetReachable } = useNetworkStore();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const {
        autoTheme,
        themeMode,
        setThemeMode,
    } = useSettingsStore();
    const {
        canOpenBilling,
        canCreateSale,
        canCreatePurchase,
        canManageInventory,
        canManageParties,
        canAccessBusinessSuite,
        canManageStaff,
        canAccessSettings,
        canSendMessages,
        isOwner,
        refreshOrganizationContext,
    } = useOrganizationAccess();

    const [profileMenuVisible, setProfileMenuVisible] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [organizationMenuVisible, setOrganizationMenuVisible] = useState(false);
    const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
    const [loadingOrganizations, setLoadingOrganizations] = useState(false);
    const [switchingOrganizationId, setSwitchingOrganizationId] = useState<string | null>(null);

    const isOffline = isConnected === false || isInternetReachable === false;

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
                route: '/scan?target=stock',
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
            {
                key: 'staff',
                label: 'Staff',
                subtitle: 'Invite and manage team',
                icon: 'account-group-outline',
                route: '/staff',
                enabled: canManageStaff,
            },
        ]).filter((entry) => entry.enabled),
        [
            canAccessBusinessSuite,
            canCreatePurchase,
            canCreateSale,
            canManageInventory,
            canManageParties,
            canManageStaff,
            canOpenBilling,
        ]
    );

    const initials = useMemo(() => {
        const source = user?.displayName?.trim() || user?.phoneNumber || 'U';
        const parts = source.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }, [user?.displayName, user?.phoneNumber]);

    const firstName = useMemo(() => {
        const raw = user?.displayName?.trim();
        if (!raw) return 'User';
        return raw.split(/\s+/)[0] || 'User';
    }, [user?.displayName]);

    const currentOrganization = useMemo(() => {
        if (!organizations.length) return null;
        if (selectedOrganizationId) {
            return organizations.find((entry) => entry.id === selectedOrganizationId) ?? organizations[0];
        }
        return organizations[0];
    }, [organizations, selectedOrganizationId]);

    const loadOrganizations = useCallback(async (showError = false) => {
        try {
            setLoadingOrganizations(true);
            const data = await businessSuiteService.getMyOrganizations();
            setOrganizations(data);
        } catch (error: unknown) {
            if (showError) {
                dialog.alert('Organization', error instanceof Error ? error.message : 'Failed to load organizations.');
            }
        } finally {
            setLoadingOrganizations(false);
        }
    }, [dialog]);

    useEffect(() => {
        void loadOrganizations(false);
    }, [loadOrganizations, selectedOrganizationId]);

    const handleSwitchOrganization = useCallback(async (organizationId: string) => {
        if (organizationId === selectedOrganizationId) {
            setOrganizationMenuVisible(false);
            return;
        }

        try {
            setSwitchingOrganizationId(organizationId);
            await refreshOrganizationContext(organizationId);
            setOrganizationMenuVisible(false);
            router.replace('/(main)/(tabs)/home');
        } catch (error: unknown) {
            dialog.alert('Organization', error instanceof Error ? error.message : 'Failed to switch organization.');
        } finally {
            setSwitchingOrganizationId(null);
        }
    }, [dialog, refreshOrganizationContext, selectedOrganizationId]);

    const handleLogout = async () => {
        setProfileMenuVisible(false);
        await signOut();
        router.replace('/(auth)/login');
    };

    const glassBackground = theme.dark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.72)';
    const glassBorder = theme.dark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.34)';
    const glassInset = theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.62)';

    return (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlay]}>
            <View
                style={[
                    styles.headerContainer,
                    { top: insets.top + 6 },
                ]}
            >
                <View
                    style={[
                        styles.singlePill,
                        {
                            backgroundColor: glassBackground,
                            borderColor: glassBorder,
                            shadowColor: theme.dark ? '#020617' : '#0f172a',
                        },
                    ]}
                >
                    <View style={[styles.glassInset, { borderColor: glassInset }]} />

                    <IconButton
                        icon="menu"
                        size={22}
                        iconColor={theme.colors.onSurface}
                        onPress={() => setDrawerVisible(true)}
                        style={styles.menuButton}
                    />

                    <Menu
                        visible={organizationMenuVisible}
                        onDismiss={() => setOrganizationMenuVisible(false)}
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
                                accessibilityLabel="Switch organization"
                                onPress={() => {
                                    setOrganizationMenuVisible(true);
                                    void loadOrganizations(true);
                                }}
                                style={styles.orgAnchor}
                            >
                                <Text
                                    variant="titleSmall"
                                    numberOfLines={1}
                                    style={{ fontWeight: '700', color: theme.colors.onSurface }}
                                >
                                    {currentOrganization?.name || user?.businessName || 'Your Organization'}
                                </Text>
                                <Text
                                    variant="labelSmall"
                                    numberOfLines={1}
                                    style={{ color: theme.colors.onSurfaceVariant }}
                                >
                                    {loadingOrganizations
                                        ? 'Loading organizations...'
                                        : `Hello, ${firstName}`}
                                </Text>
                            </Pressable>
                        )}
                    >
                        {loadingOrganizations ? (
                            <Menu.Item
                                title="Loading organizations..."
                                leadingIcon={() => <ActivityIndicator size="small" style={{ marginLeft: 8 }} />}
                                onPress={() => { }}
                                disabled
                            />
                        ) : organizations.length > 0 ? (
                            organizations.map((organization) => {
                                const isSelected = organization.id === selectedOrganizationId;
                                const isSwitching = switchingOrganizationId === organization.id;
                                return (
                                    <Menu.Item
                                        key={organization.id}
                                        leadingIcon={isSelected ? 'check-circle' : 'domain'}
                                        title={organization.name}
                                        onPress={() => { void handleSwitchOrganization(organization.id); }}
                                        disabled={Boolean(switchingOrganizationId)}
                                        trailingIcon={isSwitching ? 'progress-clock' : undefined}
                                    />
                                );
                            })
                        ) : (
                                    <Menu.Item
                                        title="No connected organizations"
                                        leadingIcon="domain-off"
                                        onPress={() => { }}
                                        disabled
                                    />
                        )}

                        <Divider />
                        <Menu.Item
                            leadingIcon="swap-horizontal"
                            title="Manage Organizations"
                            onPress={() => {
                                setOrganizationMenuVisible(false);
                                router.push('/org-select' as never);
                            }}
                        />
                        {isOwner ? (
                            <Menu.Item
                                leadingIcon="domain-plus"
                                title="Create Organization"
                                onPress={() => {
                                    setOrganizationMenuVisible(false);
                                    router.push('/org-create' as never);
                                }}
                            />
                        ) : null}
                    </Menu>

                    <View style={styles.rightActions}>
                        {canSendMessages ? (
                            <IconButton
                                icon="bell-outline"
                                size={21}
                                iconColor={theme.colors.onSurface}
                                onPress={() => router.push('/notifications')}
                                style={styles.menuButton}
                            />
                        ) : null}

                        <Menu
                            visible={profileMenuVisible}
                            onDismiss={() => setProfileMenuVisible(false)}
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
                                    onPress={() => setProfileMenuVisible(true)}
                                    style={styles.avatarPressable}
                                >
                                    {user?.photoURL ? (
                                        <Avatar.Image size={32} source={{ uri: user.photoURL }} />
                                    ) : (
                                        <Avatar.Text size={32} label={initials} />
                                    )}
                                    <View
                                        style={[
                                            styles.statusDot,
                                            {
                                                backgroundColor: isOffline ? theme.colors.error : theme.colors.secondary,
                                                borderColor: theme.colors.background,
                                            },
                                        ]}
                                    />
                                </Pressable>
                            )}
                        >
                            <Menu.Item
                                leadingIcon="account-circle-outline"
                                title="Profile"
                                onPress={() => {
                                    setProfileMenuVisible(false);
                                    router.push('/profile');
                                }}
                            />
                            {canAccessSettings ? (
                                <Menu.Item
                                    leadingIcon="cog-outline"
                                    title="Settings"
                                    onPress={() => {
                                        setProfileMenuVisible(false);
                                        router.push('/(main)/(tabs)/settings');
                                    }}
                                />
                            ) : null}
                            <Menu.Item
                                leadingIcon="format-paint"
                                title={autoTheme ? 'Auto' : themeMode === 'dark' ? 'Dark' : 'Light'}
                                onPress={() => {
                                    setProfileMenuVisible(false);
                                    setThemeMode(autoTheme ? 'system' : themeMode === 'dark' ? 'light' : 'dark');
                                }}
                            />
                            <Divider />
                            <Menu.Item
                                titleStyle={{ color: theme.colors.error }}
                                leadingIcon="logout"
                                title="Logout"
                                onPress={() => { void handleLogout(); }}
                            />
                        </Menu>
                    </View>
                </View>
            </View>

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
        left: 12,
        right: 12,
        zIndex: 2,
    },
    singlePill: {
        minHeight: 54,
        borderRadius: DesignSystem.radius.pill,
        borderWidth: 1,
        
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 12,
        overflow: 'hidden',
    },
    glassInset: {
        position: 'absolute',
        top: 1,
        left: 1,
        right: 1,
        height: '50%',
        borderTopLeftRadius: DesignSystem.radius.pill,
        borderTopRightRadius: DesignSystem.radius.pill,
        borderWidth: 1,
        borderBottomWidth: 0,
        opacity: 0.5,
    },
    menuButton: {
        margin: 0,
    },
    orgAnchor: {
        flex: 1,
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    avatarPressable: {
        marginRight: 4,
        marginLeft: 2,
    },
    statusDot: {
        position: 'absolute',
        right: 0,
        bottom: 1,
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
