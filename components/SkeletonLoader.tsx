import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence
} from 'react-native-reanimated';
import { useTheme } from 'react-native-paper';

interface SkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    style?: ViewStyle;
    borderRadius?: number;
}

export const SkeletonItem = ({ width = '100%', height = 20, style, borderRadius = 4 }: SkeletonProps) => {
    const theme = useTheme();
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: 1000 }),
                withTiming(0.3, { duration: 1000 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    backgroundColor: theme.colors.surfaceVariant,
                    borderRadius,
                },
                style,
                animatedStyle,
            ]}
        />
    );
};

export const StockSkeleton = () => {
    return (
        <View style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5].map((key) => (
                <View key={key} style={{ flexDirection: 'row', marginBottom: 16, alignItems: 'center' }}>
                    <SkeletonItem width={50} height={50} borderRadius={8} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                        <SkeletonItem width="60%" height={20} style={{ marginBottom: 8 }} />
                        <SkeletonItem width="40%" height={16} />
                    </View>
                    <SkeletonItem width={40} height={20} />
                </View>
            ))}
        </View>
    );
}
