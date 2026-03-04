import { useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    useColorScheme,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColors, Radius, Spacing, Typography } from '../constants/theme';
import type { AppAction, AppModule } from '../utils/accessControl';
import { canAccessModule, canPerformAction, canUsePos } from '../utils/accessControl';
import { useAuthStore } from '../store/authStore';

type QuickAction = {
    label: string;
    route: Parameters<typeof router.push>[0];
    module?: AppModule;
    action?: AppAction;
    requiresPos?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
    { label: 'Screen Directory', route: '/(main)/more/screen-directory' as Parameters<typeof router.push>[0] },
    { label: 'New Sale Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', module: 'billing', action: 'billing.create' },
    { label: 'Purchase Bill', route: '/(main)/billing/create?type=PURCHASE_BILL', module: 'billing', action: 'billing.create' },
    { label: 'POS Sale', route: '/(main)/billing/pos', module: 'billing', requiresPos: true },
    { label: 'Payment In', route: '/(main)/billing/payment-in', module: 'accounts' },
    { label: 'Payment Out', route: '/(main)/billing/payment-out', module: 'accounts' },
    { label: 'Add Item', route: '/(main)/inventory/add-item', module: 'inventory', action: 'inventory.create' },
    { label: 'Add Party', route: '/(main)/parties/add', module: 'parties', action: 'party.create' },
    { label: 'Billing List', route: '/(main)/billing', module: 'billing' },
    { label: 'Inventory', route: '/(main)/inventory', module: 'inventory' },
    { label: 'Reports', route: '/(main)/reports', module: 'reports' },
    { label: 'Cash & Bank', route: '/(main)/accounts/cash-bank', module: 'accounts' },
    { label: 'Settings', route: '/(main)/more/settings', module: 'settings' },
];

export function VahiTabBar({ state, navigation }: BottomTabBarProps) {
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const insets = useSafeAreaInsets();
    const role = useAuthStore((s) => s.organizationRole);
    const subscription = useAuthStore((s) => s.subscription);
    const [sheetVisible, setSheetVisible] = useState(false);

    const currentRoute = state.routes[state.index]?.name ?? 'index';
    const isHomeActive = currentRoute === 'index';
    const isMoreActive = currentRoute === 'more';

    const visibleActions = useMemo(
        () =>
            QUICK_ACTIONS.filter((action) => {
                if (action.requiresPos && !canUsePos(subscription)) return false;
                if (!action.module) return true;
                if (!canAccessModule(role, action.module, subscription)) return false;
                if (action.action && !canPerformAction(role, action.action, subscription)) return false;
                return true;
            }),
        [role, subscription]
    );

    const goToTab = (name: string) => {
        const route = state.routes.find((entry) => entry.name === name);
        if (!route) return;
        navigation.navigate(route.name);
    };

    const openAction = (action: QuickAction) => {
        setSheetVisible(false);
        router.push(action.route);
    };

    return (
        <>
            <View
                style={[
                    styles.bar,
                    {
                        backgroundColor: colors.tabBar,
                        borderTopColor: colors.tabBarBorder,
                        paddingBottom: Math.max(insets.bottom, 10),
                    },
                ]}
            >
                <Pressable
                    style={styles.sideAction}
                    onPress={() => goToTab('index')}
                    accessibilityRole="button"
                    accessibilityLabel="Dashboard"
                >
                    <Text style={[styles.sideIcon, { color: isHomeActive ? colors.primary : colors.textSecondary }]}>DS</Text>
                    <Text style={[styles.sideLabel, { color: isHomeActive ? colors.primary : colors.textSecondary }]}>Dashboard</Text>
                </Pressable>

                <Pressable
                    style={[styles.centerAction, { backgroundColor: colors.primary }]}
                    onPress={() => setSheetVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Create transaction"
                >
                    <Text style={styles.centerText}>+</Text>
                </Pressable>

                <Pressable
                    style={styles.sideAction}
                    onPress={() => goToTab('more')}
                    accessibilityRole="button"
                    accessibilityLabel="More"
                >
                    <Text style={[styles.sideIcon, { color: isMoreActive ? colors.primary : colors.textSecondary }]}>MR</Text>
                    <Text style={[styles.sideLabel, { color: isMoreActive ? colors.primary : colors.textSecondary }]}>More</Text>
                </Pressable>
            </View>

            <Modal
                visible={sheetVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSheetVisible(false)}
            >
                <View style={styles.modalRoot}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setSheetVisible(false)} />
                    <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>Quick Actions</Text>
                            <Pressable onPress={() => setSheetVisible(false)}>
                                <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
                            </Pressable>
                        </View>
                        <View style={styles.sheetGrid}>
                            {visibleActions.map((action) => (
                                <Pressable
                                    key={action.label}
                                    style={[styles.sheetAction, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                                    onPress={() => openAction(action)}
                                >
                                    <Text style={[styles.sheetActionText, { color: colors.text }]}>{action.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing.xl,
    },
    sideAction: {
        width: 90,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    sideIcon: {
        fontSize: 12,
        fontWeight: '800',
    },
    sideLabel: {
        fontSize: Typography.caption.size,
        fontWeight: '600',
    },
    centerAction: {
        width: 56,
        height: 56,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
    },
    centerText: {
        color: '#fff',
        fontSize: 26,
        lineHeight: 28,
        fontWeight: '700',
    },
    modalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#00000088',
    },
    sheet: {
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        borderWidth: 1,
        borderBottomWidth: 0,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xl,
        gap: Spacing.sm,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sheetTitle: {
        fontSize: Typography.title.size,
        fontWeight: '700',
    },
    closeText: {
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    sheetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    sheetAction: {
        width: '48%',
        borderRadius: Radius.md,
        borderWidth: 1,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        minHeight: 52,
        justifyContent: 'center',
    },
    sheetActionText: {
        fontSize: Typography.body.size,
        fontWeight: '600',
    },
});
