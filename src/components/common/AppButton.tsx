import React from 'react';
import { StyleSheet, type GestureResponderEvent } from 'react-native';
import { Button, ButtonProps, useTheme } from 'react-native-paper';
import { MotionView } from '../motion/Motion';
import { useHaptics } from '../../hooks/useHaptics';
import { DesignSystem } from '../../constants/DesignSystem';

interface AppButtonProps extends ButtonProps {
    haptic?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({ 
    onPress, 
    onPressIn,
    onPressOut,
    haptic = true, 
    style, 
    contentStyle,
    labelStyle,
    children, 
    ...props 
}) => {
    const { triggerSelection } = useHaptics();
    const theme = useTheme();
    const [isPressed, setIsPressed] = React.useState(false);
    const mode = props.mode ?? 'contained';
    const isOutlined = mode === 'outlined';
    const isText = mode === 'text';
    const backgroundColor = mode === 'contained'
        ? theme.colors.primary
        : mode === 'contained-tonal'
            ? theme.colors.secondaryContainer
            : isText
                ? 'transparent'
                : theme.colors.surface;

    const handlePress = (e: GestureResponderEvent) => {
        if (haptic) triggerSelection();
        onPress && onPress(e);
    };

    const handlePressIn: NonNullable<ButtonProps['onPressIn']> = (event) => {
        setIsPressed(true);
        onPressIn?.(event);
    };

    const handlePressOut: NonNullable<ButtonProps['onPressOut']> = (event) => {
        setIsPressed(false);
        onPressOut?.(event);
    };

    return (
        <MotionView
            animate={{ scale: isPressed ? 0.97 : 1, translateY: isPressed ? 1 : 0 }}
            transition={{ type: 'timing', duration: DesignSystem.motion.fast }}
        >
            <Button
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={[
                    styles.button,
                    {
                        borderRadius: DesignSystem.radius.sm,
                        backgroundColor,
                        borderColor: theme.colors.outlineVariant,
                        borderWidth: isOutlined ? 1 : 0,
                        minHeight: isText ? 34 : 40,
                    },
                    style,
                ]}
                contentStyle={[styles.content, contentStyle]}
                labelStyle={[styles.label, labelStyle]}
                {...props}
            >
                {children}
            </Button>
        </MotionView>
    );
};

const styles = StyleSheet.create({
    button: {},
    content: {
        minHeight: 38,
        paddingVertical: 1,
        paddingHorizontal: 8,
    },
    label: {
        fontWeight: '700',
        letterSpacing: 0.1,
        fontSize: 13,
    },
});
