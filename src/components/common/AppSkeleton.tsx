import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';

type SkeletonWidth = number | `${number}%` | 'auto';

type AppSkeletonProps = {
    width?: SkeletonWidth;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
};

export const AppSkeleton: React.FC<AppSkeletonProps> = ({
    width = '100%',
    height = 14,
    borderRadius = DesignSystem.radius.xs,
    style,
}) => {
    const theme = useTheme();
    const alpha = useRef(new Animated.Value(0.45)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(alpha, {
                    toValue: 0.82,
                    duration: 650,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(alpha, {
                    toValue: 0.45,
                    duration: 650,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [alpha]);

    return (
        <Animated.View
            style={[
                styles.base,
                {
                    width,
                    height,
                    borderRadius,
                    opacity: alpha,
                    backgroundColor: theme.colors.surfaceVariant,
                },
                style,
            ]}
        />
    );
};

const styles = StyleSheet.create({
    base: {
        overflow: 'hidden',
    },
});
