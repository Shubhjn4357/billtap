import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    Animated,
    Dimensions,
    PanResponder,
    Pressable,
    StyleSheet,
    View,
    useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColors, Radius, Spacing } from '../../constants/theme';
import { useHaptics } from '../../hooks/useHaptics';
import { SideDrawerContent } from './SideDrawerContent';

type AppDrawerContextValue = {
    isOpen: boolean;
    toggleDrawer: (open: boolean) => void;
};

const AppDrawerContext = createContext<AppDrawerContextValue | null>(null);

export const useAppDrawer = () => useContext(AppDrawerContext);

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(336, Math.max(280, SCREEN_WIDTH * 0.78));

type AppDrawerLayoutProps = {
    children: ReactNode;
};

export function AppDrawerLayout({ children }: AppDrawerLayoutProps) {
    const scheme = useColorScheme();
    const colors = getColors(scheme);
    const s = useMemo(() => styles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const { selection } = useHaptics();

    const progress = useRef(new Animated.Value(0)).current;
    const [isOpen, setIsOpen] = useState(false);

    const toggleDrawer = useCallback((open: boolean) => {
        setIsOpen(open);
        void selection();
        Animated.spring(progress, {
            toValue: open ? 1 : 0,
            friction: 9,
            tension: 56,
            useNativeDriver: true,
        }).start();
    }, [progress, selection]);

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
        outputRange: [1, 0.92],
    });
    const borderRadius = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Radius.lg],
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
            <View style={[s.root, { backgroundColor: colors.surfaceVariant }]} {...panResponder.panHandlers}>
                <View style={[s.drawerLayer, { paddingTop: insets.top }]}>
                    <SideDrawerContent onClose={() => toggleDrawer(false)} />
                </View>

                <Animated.View
                    style={[
                        s.mainLayer,
                        {
                            backgroundColor: colors.background,
                            borderRadius,
                            transform: [{ translateX }, { scale }],
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

const styles = (colors: ReturnType<typeof getColors>) =>
    StyleSheet.create({
        root: {
            flex: 1,
        },
        drawerLayer: {
            ...StyleSheet.absoluteFillObject,
            paddingBottom: Spacing.lg,
        },
        mainLayer: {
            flex: 1,
            overflow: 'hidden',
            shadowColor: colors.text,
            shadowOffset: { width: -8, height: 0 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 14,
        },
        overlay: {
            flex: 1,
            backgroundColor: colors.text,
        },
    });
