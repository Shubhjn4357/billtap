import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';

interface SkeletonBoxProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
}

const SkeletonBox: React.FC<SkeletonBoxProps> = ({
    width = '100%',
    height = 16,
    borderRadius = DesignSystem.radius.xs,
    style,
}) => {
    const theme = useTheme();
    const opacity = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, [opacity]);

    const isPercentWidth = typeof width === 'string';

    const animatedLayer = (
        <Animated.View
            style={[
                {
                    height,
                    borderRadius,
                    backgroundColor: theme.colors.surfaceVariant,
                    opacity,
                    // For percentage widths the parent View controls width
                    ...(isPercentWidth ? { flex: 1 } : { width: width as number }),
                },
                // Only apply style when not using a wrapper
                !isPercentWidth ? style : undefined,
            ]}
        />
    );

    if (isPercentWidth) {
        return (
            <View style={[{ width: width as `${number}%` }, style]}>
                {animatedLayer}
            </View>
        );
    }

    return animatedLayer;
};

interface SkeletonRowProps {
    lines?: number;
}

const SkeletonRow: React.FC<SkeletonRowProps> = ({ lines = 2 }) => (
    <View style={skeletonStyles.row}>
        <SkeletonBox width={44} height={44} borderRadius={DesignSystem.radius.sm} />
        <View style={skeletonStyles.textBlock}>
            <SkeletonBox width="65%" height={14} />
            {lines > 1 ? <SkeletonBox width="40%" height={11} style={{ marginTop: 6 }} /> : null}
        </View>
        <SkeletonBox width={60} height={14} />
    </View>
);

interface SkeletonListProps {
    count?: number;
    style?: StyleProp<ViewStyle>;
}

/**
 * SkeletonList — animated loading placeholder for list screens.
 * All colors from theme.colors.
 */
export const SkeletonList: React.FC<SkeletonListProps> = ({ count = 6, style }) => {
    return (
        <View style={[skeletonStyles.container, style]}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonRow key={i} />
            ))}
        </View>
    );
};

interface SkeletonCardRowProps {
    columns?: number;
    style?: StyleProp<ViewStyle>;
}

/** 
 * SkeletonCardRow — row of summary card placeholders (Dashboard use).
 */
export const SkeletonCardRow: React.FC<SkeletonCardRowProps> = ({ columns = 3, style }) => (
    <View style={[{ flexDirection: 'row', gap: DesignSystem.spacing.sm }, style]}>
        {Array.from({ length: columns }).map((_, i) => (
            <View key={i} style={{ flex: 1 }}>
                <SkeletonBox height={80} borderRadius={DesignSystem.radius.md} />
            </View>
        ))}
    </View>
);

const skeletonStyles = StyleSheet.create({
    container: {
        gap: DesignSystem.spacing.xs,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: DesignSystem.spacing.sm,
        gap: DesignSystem.spacing.md,
    },
    textBlock: {
        flex: 1,
        gap: 4,
    },
});
