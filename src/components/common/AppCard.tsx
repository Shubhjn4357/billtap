import React, { useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, ViewStyle, Animated } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';

type AppCardProps = React.ComponentProps<typeof Card> & {
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    animationDelay?: number;
    disableMotion?: boolean;
};

export const AppCard: React.FC<AppCardProps> = ({
    style,
    contentStyle,
    children,
    animationDelay,
    disableMotion = false,
    ...props
}) => {
    const theme = useTheme();
    const shouldAnimate = !disableMotion && typeof animationDelay === 'number';
    const backgroundColor = theme.colors.surface;
    const borderColor = theme.colors.outlineVariant;
    const flattenedStyle = StyleSheet.flatten(style) || {};

    const animValue = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;

    const flexStyle = {
        flex: (flattenedStyle as ViewStyle).flex,
        flexGrow: (flattenedStyle as ViewStyle).flexGrow,
        flexShrink: (flattenedStyle as ViewStyle).flexShrink,
        height: (flattenedStyle as ViewStyle).height,
        minHeight: (flattenedStyle as ViewStyle).minHeight,
        maxHeight: (flattenedStyle as ViewStyle).maxHeight,
    };

    useEffect(() => {
        if (shouldAnimate) {
            Animated.timing(animValue, {
                toValue: 1,
                duration: DesignSystem.motion.slow,
                delay: animationDelay,
                useNativeDriver: true,
            }).start();
        }
    }, [shouldAnimate, animationDelay, animValue]);

    const animatedStyle = shouldAnimate ? {
        opacity: animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.9, 1]
        }),
        transform: [
            {
                translateY: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0]
                })
            },
            {
                scale: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.99, 1]
                })
            }
        ]
    } : {};

    return (
        <Animated.View style={[flexStyle, animatedStyle]}>
            <Card
                mode="elevated"
                style={[
                    styles.card,
                    {
                        backgroundColor,
                        borderColor, 
                        shadowColor: theme.dark ? '#020617' : '#334155',
                        shadowOpacity: theme.dark ? 0.2 : 0.07,
                    },
                    style,
                ]}
                {...props}
            >
                <Card.Content style={[styles.content, contentStyle]}>
                    {children}
                </Card.Content>
            </Card>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: DesignSystem.radius.md,
        borderWidth: 0,
        marginBottom: DesignSystem.spacing.sm,
        overflow: 'hidden',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 7,
        elevation: 1,
    },
    content: {
        paddingVertical: DesignSystem.spacing.sm,
        paddingHorizontal: DesignSystem.spacing.sm,
    },
});
