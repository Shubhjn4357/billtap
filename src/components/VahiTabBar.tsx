import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Keyboard,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../constants/theme';
import { useAppColors } from '../hooks/useAppColors';
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

const CENTER_SLOT_WIDTH = 84;
const BAR_HORIZONTAL_PADDING = Spacing.sm;
const ACTIVE_PILL_MIN_WIDTH = 82;
const ACTIVE_PILL_MAX_WIDTH = 108;
const SHEET_ANIMATION_MS = 220;

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
    const colors = useAppColors();
    const s = useMemo(() => styles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const role = useAuthStore((value) => value.organizationRole);
    const subscription = useAuthStore((value) => value.subscription);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [barWidth, setBarWidth] = useState(0);
    const activeProgress = useRef(new Animated.Value(0)).current;
    const centerPulse = useRef(new Animated.Value(1)).current;
    const barEntrance = useRef(new Animated.Value(0)).current;
    const sheetProgress = useRef(new Animated.Value(0)).current;
    const { selection, impact } = useHaptics();

    const currentRoute = state.routes[state.index]?.name ?? 'index';
    const isMoreActive = currentRoute === 'more';
    const isHomeActive = !isMoreActive;

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

    const activeMetrics = useMemo(() => {
        const available = Math.max(barWidth - (BAR_HORIZONTAL_PADDING * 2) - CENTER_SLOT_WIDTH, 0);
        const sideSlotWidth = available / 2;
        const width = Math.max(
            ACTIVE_PILL_MIN_WIDTH,
            Math.min(sideSlotWidth - Spacing.sm, ACTIVE_PILL_MAX_WIDTH)
        );
        const centerOffset = Math.max((sideSlotWidth - width) / 2, 0);
        const leftX = BAR_HORIZONTAL_PADDING + centerOffset;
        const rightX = BAR_HORIZONTAL_PADDING + sideSlotWidth + CENTER_SLOT_WIDTH + centerOffset;
        return {
            width: Number.isFinite(width) ? width : ACTIVE_PILL_MIN_WIDTH,
            leftX: Number.isFinite(leftX) ? leftX : BAR_HORIZONTAL_PADDING,
            rightX: Number.isFinite(rightX) ? rightX : BAR_HORIZONTAL_PADDING,
        };
    }, [barWidth]);

    const activeTranslateX = activeProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [activeMetrics.leftX, activeMetrics.rightX],
    });
    const homeIconScale = activeProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1.08, 1],
    });
    const moreIconScale = activeProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.08],
    });
    const centerIconRotate = sheetProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '45deg'],
    });
    const sheetTranslateY = sheetProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [260, 0],
    });
    const barTranslateY = barEntrance.interpolate({
        inputRange: [0, 1],
        outputRange: [26, 0],
    });
    const backdropOpacity = sheetProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    const openSheet = () => {
        if (sheetVisible) return;
        setSheetVisible(true);
        setSheetOpen(true);
        sheetProgress.setValue(0);
        Animated.spring(sheetProgress, {
            toValue: 1,
            damping: 18,
            stiffness: 220,
            mass: 0.7,
            useNativeDriver: true,
        }).start();
    };

    const closeSheet = (onClose?: () => void) => {
        if (!sheetVisible) {
            onClose?.();
            return;
        }
        setSheetOpen(false);
        Animated.timing(sheetProgress, {
            toValue: 0,
            duration: SHEET_ANIMATION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                setSheetVisible(false);
                onClose?.();
            }
        });
    };

    const goToTab = (name: string) => {
        const route = state.routes.find((entry) => entry.name === name);
        if (!route) return;
        void selection();
        navigation.navigate(route.name);
    };

    const openAction = (action: QuickAction) => {
        void selection();
        closeSheet(() => router.push(action.route));
    };

    useEffect(() => {
        const animation = Animated.spring(barEntrance, {
            toValue: 1,
            damping: 14,
            stiffness: 220,
            mass: 0.7,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [barEntrance]);

    useEffect(() => {
        const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        if (keyboardVisible && sheetVisible) {
            closeSheet();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyboardVisible, sheetVisible]);

    useEffect(() => {
        const animation = Animated.spring(activeProgress, {
            toValue: isMoreActive ? 1 : 0,
            damping: 16,
            stiffness: 190,
            mass: 0.8,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [activeProgress, isMoreActive]);

    useEffect(() => {
        if (sheetOpen || keyboardVisible) {
            centerPulse.stopAnimation();
            centerPulse.setValue(1);
            return;
        }

        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(centerPulse, {
                    toValue: 1.06,
                    duration: 1100,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(centerPulse, {
                    toValue: 1,
                    duration: 1100,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );
        pulseLoop.start();
        return () => pulseLoop.stop();
    }, [centerPulse, keyboardVisible, sheetOpen]);

    if (keyboardVisible && !sheetVisible) {
        return null;
    }

    return (
        <>
            <Animated.View
                style={[
                    s.barShell,
                    {
                        paddingBottom: Math.max(insets.bottom, 10),
                        opacity: barEntrance,
                        transform: [{ translateY: barTranslateY }],
                    },
                ]}
            >
                <View
                    style={s.bar}
                    onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
                >
                    <Animated.View
                        style={[
                            s.activePill,
                            {
                                width: activeMetrics.width,
                                opacity: barWidth > 0 ? 1 : 0,
                                transform: [{ translateX: activeTranslateX }],
                            },
                        ]}
                    />

                    <Pressable
                        style={s.sideAction}
                        onPress={() => goToTab('index')}
                        accessibilityRole="button"
                        accessibilityLabel="Dashboard"
                    >
                        <Animated.View style={{ transform: [{ scale: homeIconScale }] }}>
                            <MaterialCommunityIcons
                                name={isHomeActive ? 'view-dashboard' : 'view-dashboard-outline'}
                                size={20}
                                color={isHomeActive ? colors.primary : colors.textSecondary}
                            />
                        </Animated.View>
                        <Text style={[s.sideLabel, { color: isHomeActive ? colors.primary : colors.textSecondary }]}>Dashboard</Text>
                    </Pressable>

                    <View style={s.centerSlot}>
                        <Animated.View style={[s.centerPulseWrap, { transform: [{ scale: centerPulse }] }]}>
                            <View style={s.centerHalo} />
                            <Pressable
                                style={s.centerAction}
                                onPress={() => {
                                    void impact();
                                    openSheet();
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Create transaction"
                            >
                                <Animated.View style={{ transform: [{ rotate: centerIconRotate }] }}>
                                    <MaterialCommunityIcons name="plus" size={28} color={colors.onPrimary} />
                                </Animated.View>
                            </Pressable>
                        </Animated.View>
                    </View>

                    <Pressable
                        style={s.sideAction}
                        onPress={() => goToTab('more')}
                        accessibilityRole="button"
                        accessibilityLabel="More"
                    >
                        <Animated.View style={{ transform: [{ scale: moreIconScale }] }}>
                            <MaterialCommunityIcons
                                name={isMoreActive ? 'dots-horizontal-circle' : 'dots-horizontal-circle-outline'}
                                size={20}
                                color={isMoreActive ? colors.primary : colors.textSecondary}
                            />
                        </Animated.View>
                        <Text style={[s.sideLabel, { color: isMoreActive ? colors.primary : colors.textSecondary }]}>More</Text>
                    </Pressable>
                </View>
            </Animated.View>

            <Modal
                visible={sheetVisible}
                transparent
                animationType="none"
                onRequestClose={() => closeSheet()}
            >
                <View style={s.modalRoot}>
                    <Animated.View style={[s.modalBackdrop, { opacity: backdropOpacity }]}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSheet()} />
                    </Animated.View>
                    <Animated.View style={[s.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
                        <View style={s.sheetHandle} />
                        <View style={s.sheetHeader}>
                            <Text style={s.sheetTitle}>Quick Actions</Text>
                            <Pressable onPress={() => closeSheet()}>
                                <Text style={s.closeText}>Close</Text>
                            </Pressable>
                        </View>
                        <View style={s.sheetGrid}>
                            {visibleActions.map((action) => (
                                <Pressable
                                    key={action.label}
                                    style={s.sheetAction}
                                    onPress={() => openAction(action)}
                                >
                                    <MaterialCommunityIcons name={action.icon} size={18} color={colors.primary} />
                                    <Text style={s.sheetActionText}>{action.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        barShell: {
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.xs,
        },
        bar: {
            minHeight: 72,
            borderWidth: 1,
            borderRadius: Radius.xl,
            borderColor: colors.tabBarBorder,
            backgroundColor: withAlpha(colors.tabBar, 'F2'),
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: BAR_HORIZONTAL_PADDING,
            position: 'relative',
            overflow: 'hidden',
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.16,
            shadowRadius: 14,
            elevation: 12,
        },
        activePill: {
            position: 'absolute',
            top: 10,
            height: 44,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.primary, '20'),
        },
        sideAction: {
            flex: 1,
            height: 54,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            zIndex: 2,
        },
        sideLabel: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        centerSlot: {
            width: CENTER_SLOT_WIDTH,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
        },
        centerPulseWrap: {
            width: 70,
            height: 70,
            alignItems: 'center',
            justifyContent: 'center',
        },
        centerHalo: {
            position: 'absolute',
            width: 68,
            height: 68,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.primary, '22'),
        },
        centerAction: {
            width: 58,
            height: 58,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            borderWidth: 1,
            borderColor: withAlpha(colors.onPrimary, '54'),
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.35,
            shadowRadius: 14,
            elevation: 10,
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
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.xl,
            gap: Spacing.sm,
        },
        sheetHandle: {
            alignSelf: 'center',
            width: 48,
            height: 5,
            borderRadius: Radius.pill,
            backgroundColor: colors.border,
            marginBottom: 4,
        },
        sheetHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        sheetTitle: {
            fontSize: Typography.title.size,
            fontWeight: '700',
            color: colors.text,
        },
        closeText: {
            fontSize: Typography.body.size,
            fontWeight: '700',
            color: colors.primary,
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
            borderColor: colors.border,
            backgroundColor: colors.surfaceVariant,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            minHeight: 54,
            justifyContent: 'flex-start',
            alignItems: 'center',
            flexDirection: 'row',
            gap: Spacing.sm,
        },
        sheetActionText: {
            fontSize: Typography.body.size,
            fontWeight: '600',
            color: colors.text,
            flex: 1,
        },
    });
