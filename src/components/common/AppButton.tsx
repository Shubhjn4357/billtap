import React from 'react';
import { StyleSheet, type GestureResponderEvent } from 'react-native';
import { Button, ButtonProps } from 'react-native-paper';
import { MotiView } from 'moti';
import { useHaptics } from '../../hooks/useHaptics';

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
    const [isPressed, setIsPressed] = React.useState(false);

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
        <MotiView
            animate={{ scale: isPressed ? 0.97 : 1, translateY: isPressed ? 1 : 0 }}
            transition={{ type: 'timing', duration: 120 }}
        >
            <Button
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={[styles.button, style]}
                contentStyle={[styles.content, contentStyle]}
                labelStyle={[styles.label, labelStyle]}
                {...props}
            >
                {children}
            </Button>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: 12,
    },
    content: {
        minHeight: 42,
        paddingVertical: 2,
    },
    label: {
        fontWeight: '600',
        letterSpacing: 0.1,
    },
});
