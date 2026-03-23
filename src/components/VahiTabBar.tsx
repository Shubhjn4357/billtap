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
import { TAB_BAR_QUICK_ACTIONS, type NavigationShortcut } from '../constants/navigationOptions';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../constants/theme';
import { DESIGN_SPACING, getInsetPanelStyle, getPillStyle, getShadowStyle, getSurfaceStyle } from '../constants/designSystem';
import { useAppColors } from '../hooks/useAppColors';
import { useI18n } from '../hooks/useI18n';
import { canAccessModule, canPerformAction, canUsePos } from '../utils/accessControl';
import { useAuthStore } from '../store/authStore';
import { useHaptics } from '../hooks/useHaptics';
import { useThemeStore } from '../store/themeStore';

const CENTER_SLOT_WIDTH = 84;
const BAR_HORIZONTAL_PADDING = Spacing.sm;
const ACTIVE_PILL_MIN_WIDTH = 82;
const ACTIVE_PILL_MAX_WIDTH = 108;
const SHEET_ANIMATION_MS = 220;

export function VahiTabBar({ state, navigation }: BottomTabBarProps) {
    const colors = useAppColors();
    const s = useMemo(() => styles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const business = useAuthStore((value) => value.business);
    const role = useAuthStore((value) => value.organizationRole);
    const subscription = useAuthStore((value) => value.subscription);
    const richMotionEnabled = useThemeStore((value) => value.richMotionEnabled);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [barWidth, setBarWidth] = useState(0);
    const activeProgress = useRef(new Animated.Value(0)).current;
    const centerPulse = useRef(new Animated.Value(1)).current;
    const barEntrance = useRef(new Animated.Value(0)).current;
    const sheetProgress = useRef(new Animated.Value(0)).current;
    const { selection, impact } = useHaptics();
    const { t } = useI18n();

    const currentRoute = state.routes[state.index]?.name ?? 'index';
    const isSettingsActive = currentRoute === 'settings';
    const isHomeActive = !isSettingsActive;

    const visibleActions = useMemo(
        () =>
            TAB_BAR_QUICK_ACTIONS.filter((action) => {
                if (action.requiresPos && !canUsePos(subscription)) return false;
                if (!action.module) return true;
                if (!canAccessModule(role, action.module, subscription, business)) return false;
                if (action.action && !canPerformAction(role, action.action, subscription, business)) return false;
                return true;
            }),
        [business, role, subscription]
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
        if (!richMotionEnabled) {
            sheetProgress.setValue(1);
            return;
        }
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
        if (!richMotionEnabled) {
            sheetProgress.setValue(0);
            setSheetVisible(false);
            onClose?.();
            return;
        }
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

    const openAction = (action: NavigationShortcut) => {
        void selection();
        closeSheet(() => router.push(action.route as Parameters<typeof router.push>[0]));
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
            toValue: isSettingsActive ? 1 : 0,
            damping: 16,
            stiffness: 190,
            mass: 0.8,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [activeProgress, isSettingsActive]);

    useEffect(() => {
        if (!richMotionEnabled || sheetOpen || keyboardVisible) {
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
    }, [centerPulse, keyboardVisible, richMotionEnabled, sheetOpen]);

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
                        <Text style={[s.sideLabel, { color: isHomeActive ? colors.primary : colors.textSecondary }]}>{t('tab.dashboard')}</Text>
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
                        onPress={() => goToTab('settings')}
                        accessibilityRole="button"
                        accessibilityLabel="Settings"
                    >
                        <Animated.View style={{ transform: [{ scale: moreIconScale }] }}>
                            <MaterialCommunityIcons
                                name={isSettingsActive ? 'cog' : 'cog-outline'}
                                size={20}
                                color={isSettingsActive ? colors.primary : colors.textSecondary}
                            />
                        </Animated.View>
                        <Text style={[s.sideLabel, { color: isSettingsActive ? colors.primary : colors.textSecondary }]}>{t('tab.settings')}</Text>
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
                            <View style={s.sheetTitleBlock}>
                                <Text style={s.sheetEyebrow}>{t('tab.quick_actions_eyebrow')}</Text>
                                <Text style={s.sheetTitle}>{t('tab.quick_actions')}</Text>
                                <Text style={s.sheetSubtitle}>{t('tab.quick_actions_subtitle')}</Text>
                            </View>
                            <Pressable style={s.sheetCloseButton} onPress={() => closeSheet()}>
                                <Text style={s.closeText}>{t('tab.close')}</Text>
                            </Pressable>
                        </View>
                        <View style={s.sheetGrid}>
                            {visibleActions.map((action) => (
                                <Pressable
                                    key={action.label}
                                    style={s.sheetAction}
                                    onPress={() => openAction(action)}
                                >
                                    <View style={s.sheetActionIcon}>
                                        <MaterialCommunityIcons name={action.icon} size={18} color={colors.primary} />
                                    </View>
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
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.xs,
        },
        bar: {
            minHeight: 74,
            borderRadius: 24,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: BAR_HORIZONTAL_PADDING,
            position: 'relative',
            overflow: 'hidden',
            ...getSurfaceStyle(colors, { floating: true }),
        },
        activePill: {
            position: 'absolute',
            top: 11,
            height: 46,
            borderRadius: Radius.pill,
            ...getInsetPanelStyle(colors, colors.primary),
            backgroundColor: withAlpha(colors.primary, colors.isDark ? '22' : '12'),
        },
        sideAction: {
            flex: 1,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            zIndex: 2,
        },
        sideLabel: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
            letterSpacing: 0.2,
        },
        centerSlot: {
            width: CENTER_SLOT_WIDTH,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
        },
        centerPulseWrap: {
            width: 74,
            height: 74,
            alignItems: 'center',
            justifyContent: 'center',
        },
        centerHalo: {
            position: 'absolute',
            width: 58,
            height: 58,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.glow, colors.isDark ? '18' : '12'),
        },
        centerAction: {
            width: 52,
            height: 52,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            ...getShadowStyle(colors, 'soft'),
        },
        modalRoot: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        modalBackdrop: {
            ...StyleSheet.absoluteFill,
            backgroundColor: withAlpha(colors.text, '88'),
        },
        sheet: {
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            borderBottomWidth: 0,
            paddingHorizontal: DESIGN_SPACING.screenX,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.xl,
            gap: Spacing.sm,
            ...getSurfaceStyle(colors, { floating: true }),
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
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: Spacing.sm,
        },
        sheetTitleBlock: {
            flex: 1,
            gap: 2,
        },
        sheetEyebrow: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
            color: colors.primary,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
        },
        sheetTitle: {
            fontSize: Typography.title.size,
            fontWeight: '700',
            color: colors.text,
        },
        sheetSubtitle: {
            fontSize: Typography.caption.size,
            fontWeight: '500',
            color: colors.textSecondary,
            lineHeight: 18,
        },
        sheetCloseButton: {
            ...getPillStyle(colors, colors.primary),
            minHeight: 34,
            minWidth: 62,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.primary, '08'),
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.sm,
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
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            minHeight: 84,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: Spacing.sm,
            ...getSurfaceStyle(colors, { accent: colors.primary }),
        },
        sheetActionIcon: {
            width: 34,
            height: 34,
            borderRadius: Radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: withAlpha(colors.primary, '12'),
        },
        sheetActionText: {
            fontSize: Typography.body.size,
            fontWeight: '600',
            color: colors.text,
            lineHeight: 20,
        },
    });
