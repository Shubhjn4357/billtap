import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, useTheme, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useUserStore } from '../../store';

interface SideDrawerContentProps {
    onClose: () => void;
}

export const SideDrawerContent: React.FC<SideDrawerContentProps> = ({ onClose }) => {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const user = useUserStore((state) => state.user);

    const {
        canOpenBilling,
        canCreateSale,
        canCreatePurchase,
        canManageInventory,
        canManageParties,
        canAccessBusinessSuite,
        canAccessAccounting,
        canManageStaff,
    } = useOrganizationAccess();

    const actions = useMemo(() => ([
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
            key: 'accounting-home',
            label: 'Accounting',
            subtitle: 'Suite dashboard',
            icon: 'book-open-variant',
            route: '/accounting',
            enabled: canAccessAccounting,
        },
        {
            key: 'accounting-trial',
            label: 'Trial Balance',
            subtitle: 'Debit and credit parity',
            icon: 'scale-balance',
            route: '/accounting/trial-balance',
            enabled: canAccessAccounting,
        },
        {
            key: 'accounting-balance',
            label: 'Balance Sheet',
            subtitle: 'Assets, liabilities, equity',
            icon: 'bank-outline',
            route: '/accounting/balance-sheet',
            enabled: canAccessAccounting,
        },
        {
            key: 'accounting-profit',
            label: 'Profit & Loss',
            subtitle: 'Income and expense summary',
            icon: 'chart-line',
            route: '/accounting/profit-loss',
            enabled: canAccessAccounting,
        },
        {
            key: 'staff',
            label: 'Staff',
            subtitle: 'Invite and manage team',
            icon: 'account-group-outline',
            route: '/staff',
            enabled: canManageStaff,
        },
    ]).filter((entry) => entry.enabled), [
        canAccessBusinessSuite,
        canAccessAccounting,
        canCreatePurchase,
        canCreateSale,
        canManageInventory,
        canManageParties,
        canManageStaff,
        canOpenBilling
    ]);

    return (
        <View style={[styles.container, { width: 300 }]}>
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.primaryContainer }]}>
                    <MaterialCommunityIcons name="briefcase" size={28} color={theme.colors.onPrimaryContainer} />
                </View>
                <Text variant="titleMedium" style={{ fontWeight: '700', marginTop: 12, color: theme.colors.onSurface }}>
                    {user?.businessName || 'Business Controls'}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {user?.displayName || 'Manage operations'}
                </Text>
            </View>

            <Divider style={{ backgroundColor: theme.colors.outlineVariant, opacity: 0.5 }} />

            <ScrollView style={styles.actionList} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                {actions.map((action) => (
                    <Pressable
                        key={action.key}
                        onPress={() => {
                            onClose();
                            router.push(action.route as never);
                        }}
                        style={({ pressed }) => [
                            styles.actionItem,
                            { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' }
                        ]}
                    >
                        <MaterialCommunityIcons
                            // @ts-ignore
                            name={action.icon}
                            size={24}
                            color={theme.colors.primary}
                        />
                        <View style={styles.actionTextWrapper}>
                            <Text variant="titleSmall" style={{ fontWeight: '600', color: theme.colors.onSurface }}>
                                {action.label}
                            </Text>
                            {/* Subtitle omitted for cleaner look in the static background */}
                        </View>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    header: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    iconBox: {
        width: 50,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionList: {
        flex: 1,
        paddingTop: 8,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        marginHorizontal: 8,
        borderRadius: 12,
    },
    actionTextWrapper: {
        marginLeft: 16,
        flex: 1,
    }
});
