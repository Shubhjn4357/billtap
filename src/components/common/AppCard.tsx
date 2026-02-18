import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { MotionView } from '../motion/Motion';
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

    return (
        <MotionView
            from={shouldAnimate ? { opacity: 0.9, translateY: 12, scale: 0.99 } : undefined}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            transition={{
                type: 'timing',
                duration: shouldAnimate ? DesignSystem.motion.slow : 1,
                delay: shouldAnimate ? animationDelay : 0,
            }}
        >
            <Card
                mode="elevated"
                style={[
                    styles.card,
                    {
                        backgroundColor,
                        borderColor,
                        shadowColor: theme.dark ? '#020617' : '#334155',
                        shadowOpacity: theme.dark ? 0.14 : 0.07,
                    },
                    style,
                ]}
                {...props}
            >
                <Card.Content style={[styles.content, contentStyle]}>
                    {children}
                </Card.Content>
            </Card>
        </MotionView>
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
