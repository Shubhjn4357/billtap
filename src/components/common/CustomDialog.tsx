
import React from 'react';

import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';

interface CustomDialogProps {
    visible: boolean;
    onDismiss?: () => void;
    title: string;
    content: string;
    actions?: {
        label: string;
        onPress: () => void;
        mode?: 'text' | 'outlined' | 'contained' | 'elevated' | 'contained-tonal';
        loading?: boolean;
        textColor?: string;
    }[];
}

export const CustomDialog = ({ visible, onDismiss, title, content, actions }: CustomDialogProps) => {
    const theme = useTheme();

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss} style={{ backgroundColor: theme.colors.surface }}>
                <Dialog.Title style={{ color: theme.colors.onSurface }}>{title}</Dialog.Title>
                <Dialog.Content>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        {content}
                    </Text>
                </Dialog.Content>
                <Dialog.Actions>
                    {actions?.map((action, index) => (
                        <Button
                            key={index}
                            onPress={action.onPress}
                            mode={action.mode || 'text'}
                            loading={action.loading}
                            textColor={action.textColor}
                        >
                            {action.label}
                        </Button>
                    ))}
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};
