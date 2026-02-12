
import React from 'react';
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
    children, 
    ...props 
}) => {
    const { triggerSelection } = useHaptics();

    const handlePress = (e: any) => {
        if (haptic) triggerSelection();
        onPress && onPress(e);
    };

    return (
        <Button 
            onPress={handlePress} 
            style={[{ borderRadius: 8 }, style]}
            contentStyle={[{ paddingVertical: 4 }, contentStyle]}
            {...props}
        >
            {children}
        </Button>
    );
};
