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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, Radius, Spacing, Typography, withAlpha } from '../constants/theme';
import type { AppAction, AppModule } from '../utils/accessControl';
import { canAccessModule, canPerformAction, canUsePos } from '../utils/accessControl';
import { useAuthStore } from '../store/authStore';
import { useHaptics } from '../hooks/useHaptics';

type QuickAction = {
    label: string;
    route: Parameters<typeof router.push>[0];
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    module?: AppModule;
    action?: AppAction;
    requiresPos?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
    { label: 'Screen Directory', route: '/(main)/more/screen-directory' as Parameters<typeof router.push>[0], icon: 'compass-outline' },
    { label: 'New Sale Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', icon: 'file-document-plus-outline', module: 'billing', action: 'billing.create' },
    { label: 'Purchase Bill', route: '/(main)/billing/create?type=PURCHASE_BILL', icon: 'cart-plus', module: 'billing', action: 'billing.create' },
    { label: 'Quick Sale (POS)', route: '/(main)/billing/pos', icon: 'point-of-sale', module: 'billing', requiresPos: true },
    { label: 'Payment In', route: '/(main)/billing/payment-in', icon: 'cash-plus', module: 'accounts' },
    { label: 'Payment Out', route: '/(main)/billing/payment-out', icon: 'cash-minus', module: 'accounts' },
    { label: 'Add Item', route: '/(main)/inventory/add-item', icon: 'package-variant-plus', module: 'inventory', action: 'inventory.create' },
    { label: 'Add Party', route: '/(main)/parties/add', icon: 'account-plus', module: 'parties', action: 'party.create' },
    { label: 'Billing List', route: '/(main)/billing', icon: 'file-document-multiple-outline', module: 'billing' },
    { label: 'Inventory', route: '/(main)/inventory', icon: 'archive-outline', module: 'inventory' },
    { label: 'Reports', route: '/(main)/reports', icon: 'chart-line', module: 'reports' },
    { label: 'Cash & Bank', route: '/(main)/accounts/cash-bank', icon: 'bank-outline', module: 'accounts' },
    { label: 'Settings', route: '/(main)/more/settings', icon: 'cog-outline', module: 'settings' },
];

export function VahiTabBar({ state, navigation }: BottomTabBarProps) {
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const s = useMemo(() => styles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const role = useAuthStore((s) => s.organizationRole);
    const subscription = useAuthStore((s) => s.subscription);
    const [sheetVisible, setSheetVisible] = useState(false);
    const { selection, impact } = useHaptics();

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
        void selection();
        navigation.navigate(route.name);
    };

    const openAction = (action: QuickAction) => {
        void selection();
        setSheetVisible(false);
        router.push(action.route);
    };

    return (
        <>
            <View
                style={[
                    s.bar,
                    {
                        backgroundColor: colors.tabBar,
                        borderTopColor: colors.tabBarBorder,
                        paddingBottom: Math.max(insets.bottom, 10),
                    },
                ]}
            >
                <Pressable
                    style={s.sideAction}
                    onPress={() => goToTab('index')}
                    accessibilityRole="button"
                    accessibilityLabel="Dashboard"
                >
                    <MaterialCommunityIcons
                        name="view-dashboard-outline"
                        size={20}
                        color={isHomeActive ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[s.sideLabel, { color: isHomeActive ? colors.primary : colors.textSecondary }]}>Dashboard</Text>
                </Pressable>

                <Pressable
                    style={[s.centerAction, { backgroundColor: colors.primary }]}
                    onPress={() => {
                        void impact();
                        setSheetVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Create transaction"
                >
                    <MaterialCommunityIcons name="plus" size={30} color={colors.onPrimary} />
                </Pressable>

                <Pressable
                    style={s.sideAction}
                    onPress={() => goToTab('more')}
                    accessibilityRole="button"
                    accessibilityLabel="More"
                >
                    <MaterialCommunityIcons
                        name="dots-horizontal-circle-outline"
                        size={20}
                        color={isMoreActive ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[s.sideLabel, { color: isMoreActive ? colors.primary : colors.textSecondary }]}>More</Text>
                </Pressable>
            </View>

            <Modal
                visible={sheetVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSheetVisible(false)}
            >
                <View style={s.modalRoot}>
                    <Pressable style={s.modalBackdrop} onPress={() => setSheetVisible(false)} />
                    <View style={[s.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={s.sheetHeader}>
                            <Text style={[s.sheetTitle, { color: colors.text }]}>Quick Actions</Text>
                            <Pressable onPress={() => setSheetVisible(false)}>
                                <Text style={[s.closeText, { color: colors.primary }]}>Close</Text>
                            </Pressable>
                        </View>
                        <View style={s.sheetGrid}>
                            {visibleActions.map((action) => (
                                <Pressable
                                    key={action.label}
                                    style={[s.sheetAction, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                                    onPress={() => openAction(action)}
                                >
                                    <MaterialCommunityIcons name={action.icon} size={18} color={colors.primary} />
                                    <Text style={[s.sheetActionText, { color: colors.text }]}>{action.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = (colors: ReturnType<typeof getColors>) =>
    StyleSheet.create({
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
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 8,
        },
        modalRoot: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        modalBackdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: withAlpha(colors.text, '88'),
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
            justifyContent: 'flex-start',
            alignItems: 'center',
            flexDirection: 'row',
            gap: Spacing.sm,
        },
        sheetActionText: {
            fontSize: Typography.body.size,
            fontWeight: '600',
            flex: 1,
        },
    });
