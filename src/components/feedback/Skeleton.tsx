
import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 20, style }) => {
    const theme = useTheme();
    const opacity = new Animated.Value(0.3);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    backgroundColor: theme.colors.surfaceVariant,
                    opacity,
                    borderRadius: 4,
                },
                style,
            ]}
        />
    );
};
