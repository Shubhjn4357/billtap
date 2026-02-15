
import React from 'react';
import { StyleSheet, type GestureResponderEvent } from 'react-native';
import { Button, ButtonProps } from 'react-native-paper';
import { useHaptics } from '../../hooks/useHaptics';

interface AppButtonProps extends ButtonProps {
    haptic?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({ 
    onPress, 
    haptic = true, 
    style, 
    contentStyle,
    labelStyle,
    children, 
    ...props 
}) => {
    const { triggerSelection } = useHaptics();

    const handlePress = (e: GestureResponderEvent) => {
        if (haptic) triggerSelection();
        onPress && onPress(e);
    };

    return (
        <Button 
            onPress={handlePress} 
            style={[styles.button, style]}
            contentStyle={[styles.content, contentStyle]}
            labelStyle={[styles.label, labelStyle]}
            {...props}
        >
            {children}
        </Button>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: 14,
    },
    content: {
        minHeight: 48,
        paddingVertical: 5,
    },
    label: {
        fontWeight: '700',
        letterSpacing: 0.15,
    },
});
