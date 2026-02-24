import React, { ReactNode, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View, Animated, PanResponder, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SideDrawerContent } from './SideDrawerContent';

interface AppDrawerContextType {
    toggleDrawer: (open: boolean) => void;
    isOpen: boolean;
}

export const AppDrawerContext = React.createContext<AppDrawerContextType>({
    toggleDrawer: () => { },
    isOpen: false,
});

export const useAppDrawer = () => React.useContext(AppDrawerContext);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.7;

interface AppDrawerLayoutProps {
    children: ReactNode;
}

export const AppDrawerLayout: React.FC<AppDrawerLayoutProps> = ({ children }) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const progress = useRef(new Animated.Value(0)).current;
    const [isOpen, setIsOpen] = useState(false);

    const toggleDrawer = (open: boolean) => {
        setIsOpen(open);
        Animated.spring(progress, {
            toValue: open ? 1 : 0,
            friction: 9,
            tension: 50,
            useNativeDriver: true,
        }).start();
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                const { dx, dy } = gestureState;
                return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy); // Only capture horizontal swipe
            },
            onPanResponderMove: (_, gestureState) => {
                // If isOpen is true, start from 1. If false, start from 0.
                const startValue = isOpen ? 1 : 0;
                let newValue = startValue + gestureState.dx / DRAWER_WIDTH;
                newValue = Math.max(0, Math.min(1, newValue));
                progress.setValue(newValue);
            },
            onPanResponderRelease: (_, gestureState) => {
                const startValue = isOpen ? 1 : 0;
                const value = startValue + gestureState.dx / DRAWER_WIDTH;
                const velocityX = gestureState.vx;

                if (velocityX > 0.5) {
                    toggleDrawer(true);
                } else if (velocityX < -0.5) {
                    toggleDrawer(false);
                } else {
                    if (value > 0.4) {
                        toggleDrawer(true);
                    } else {
                        toggleDrawer(false);
                    }
                }
            },
        })
    ).current;

    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, DRAWER_WIDTH] });
    const overlayOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });

    const animatedMainStyle = {
        transform: [{ scale }, { translateX }],
    };

    const contextValue = React.useMemo(() => ({
        toggleDrawer,
        isOpen
    }), [isOpen]);

    return (
        <AppDrawerContext.Provider value={contextValue}>
            <View style={[styles.container, { backgroundColor: theme.colors.elevation.level2 }]} {...panResponder.panHandlers}>
                {/* 1. Underlying Drawer Menu */}
                <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]}>
                    <SideDrawerContent onClose={() => toggleDrawer(false)} />
                </View>

                {/* 2. Main App Content which Shrinks and Slides */}
                <Animated.View style={[styles.mainWrapper, animatedMainStyle, { backgroundColor: theme.colors.background }]}>
                    {children}

                    {/* Dark Overlay when Drawer is open to intercept touches */}
                    {isOpen && (
                        <TouchableWithoutFeedback onPress={() => toggleDrawer(false)}>
                            <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]} />
                        </TouchableWithoutFeedback>
                    )}
                </Animated.View>
            </View>
        </AppDrawerContext.Provider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mainWrapper: {
        flex: 1,
        shadowColor: '#000',
        shadowOffset: { width: -10, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 20,
    },
    overlay: {
        backgroundColor: '#000000',
        zIndex: 1000,
    }
});
