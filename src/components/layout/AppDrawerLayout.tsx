import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    Animated,
    Dimensions,
    PanResponder,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { getShadowStyle, getSurfaceStyle } from '../../constants/designSystem';
import { useAppColors } from '../../hooks/useAppColors';
import { useHaptics } from '../../hooks/useHaptics';
import { useThemeStore } from '../../store/themeStore';
import { SideDrawerContent } from './SideDrawerContent';

type AppDrawerContextValue = {
    isOpen: boolean;
    toggleDrawer: (open: boolean) => void;
};

const AppDrawerContext = createContext<AppDrawerContextValue | null>(null);

export const useAppDrawer = () => useContext(AppDrawerContext);

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(344, Math.max(292, SCREEN_WIDTH * 0.8));

type AppDrawerLayoutProps = {
    children: ReactNode;
};

export function AppDrawerLayout({ children }: AppDrawerLayoutProps) {
    const colors = useAppColors();
    const s = useMemo(() => styles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const { selection } = useHaptics();
    const gestureNavigationEnabled = useThemeStore((state) => state.gestureNavigationEnabled);
    const richMotionEnabled = useThemeStore((state) => state.richMotionEnabled);

    const progress = useRef(new Animated.Value(0)).current;
    const [isOpen, setIsOpen] = useState(false);

    const toggleDrawer = useCallback((open: boolean) => {
        setIsOpen(open);
        void selection();
        if (!richMotionEnabled) {
            progress.setValue(open ? 1 : 0);
            return;
        }
        Animated.spring(progress, {
            toValue: open ? 1 : 0,
            friction: 9,
            tension: 56,
            useNativeDriver: true,
        }).start();
    }, [progress, richMotionEnabled, selection]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                const { dx, dy } = gestureState;
                return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
            },
            onPanResponderMove: (_, gestureState) => {
                const startValue = isOpen ? 1 : 0;
                let next = startValue + gestureState.dx / DRAWER_WIDTH;
                next = Math.max(0, Math.min(1, next));
                progress.setValue(next);
            },
            onPanResponderRelease: (_, gestureState) => {
                const startValue = isOpen ? 1 : 0;
                const projected = startValue + gestureState.dx / DRAWER_WIDTH;
                if (gestureState.vx > 0.5) {
                    toggleDrawer(true);
                    return;
                }
                if (gestureState.vx < -0.5) {
                    toggleDrawer(false);
                    return;
                }
                toggleDrawer(projected >= 0.4);
            },
        })
    ).current;

    const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, DRAWER_WIDTH],
    });
    const scale = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.945],
    });
    const borderRadius = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 28],
    });
    const translateY = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 10],
    });
    const overlayOpacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.42],
    });

    const contextValue = useMemo(
        () => ({
            isOpen,
            toggleDrawer,
        }),
        [isOpen, toggleDrawer]
    );

    return (
        <AppDrawerContext.Provider value={contextValue}>
            <View style={s.root} {...(gestureNavigationEnabled ? panResponder.panHandlers : {})}>
                <View style={[s.drawerLayer, { paddingTop: insets.top + Spacing.sm }]}>
                    <SideDrawerContent onClose={() => toggleDrawer(false)} />
                </View>

                <Animated.View
                    style={[
                        s.mainLayer,
                        {
                            backgroundColor: colors.background,
                            borderRadius,
                            transform: [{ translateX }, { translateY }, { scale }],
                        },
                    ]}
                >
                    {children}
                    {isOpen ? (
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => toggleDrawer(false)}>
                            <Animated.View style={[s.overlay, { opacity: overlayOpacity }]} />
                        </Pressable>
                    ) : null}
                </Animated.View>
            </View>
        </AppDrawerContext.Provider>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: withAlpha(colors.surfaceVariant, colors.isDark ? 'F6' : 'FC'),
        },
        drawerLayer: {
            ...StyleSheet.absoluteFill,
            paddingBottom: Spacing.lg,
            paddingHorizontal: Spacing.sm,
        },
        mainLayer: {
            flex: 1,
            overflow: 'hidden',
            ...getSurfaceStyle(colors, { floating: true, elevated: true }),
            ...getShadowStyle(colors, 'floating'),
        },
        overlay: {
            flex: 1,
            backgroundColor: withAlpha(colors.backdrop, colors.isDark ? '52' : '24'),
        },
    });
