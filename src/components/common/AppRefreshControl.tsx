import React, { useEffect, useRef } from 'react';
import { RefreshControl, RefreshControlProps, View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';

export interface AppRefreshControlProps extends Omit<RefreshControlProps, 'refreshing'> {
    refreshing: boolean;
    onRefresh: () => void | Promise<void>;
}

/**
 * AppRefreshControl — drop-in replacement for RefreshControl.
 *
 * Shows a theme-aware rotating indicator built with Reanimated (no Moti, no Lottie dependency).
 * Uses theme.colors.primary for the spinner color so it always matches the active theme.
 */
export const AppRefreshControl = ({
    refreshing,
    onRefresh,
    ...props
}: AppRefreshControlProps) => {
    const theme = useTheme();
    const rotation = useSharedValue(0);

    useEffect(() => {
        if (refreshing) {
            rotation.value = 0;
            rotation.value = withRepeat(
                withTiming(360, { duration: 800, easing: Easing.linear }),
                -1, // infinite
                false
            );
        } else {
            rotation.value = 0;
        }
    }, [refreshing, rotation]);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    return (
        <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            // Hide the native spinner — we render our own
            tintColor="transparent"
            colors={['transparent']}
            style={{ backgroundColor: 'transparent' }}
            {...props}
        >
            {refreshing ? (
                <View style={styles.container}>
                    <Animated.View style={[styles.spinner, animStyle]}>
                        {/* A simple arc made from a View with border-radius */}
                        <View
                            style={[
                                styles.arc,
                                {
                                    borderTopColor: theme.colors.primary,
                                    borderRightColor: 'transparent',
                                    borderBottomColor: 'transparent',
                                    borderLeftColor: 'transparent',
                                },
                            ]}
                        />
                    </Animated.View>
                </View>
            ) : null}
        </RefreshControl>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    spinner: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arc: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 3,
    },
});
