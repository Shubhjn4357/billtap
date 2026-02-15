import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useTheme, Button, Dialog, Paragraph, Portal } from 'react-native-paper';

interface DialogAction {
    text: string;
    onPress?: () => void | Promise<void>;
    style?: 'default' | 'cancel' | 'destructive';
}

interface DialogOptions {
    title?: string;
    message?: string;
    actions?: DialogAction[];
    dismissable?: boolean;
}

interface DialogContextType {
    alert: (title: string, message?: string, actions?: DialogAction[]) => void;
    confirm: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
    show: (options: DialogOptions) => void;
    hide: () => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useAppDialog = () => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useAppDialog must be used within a DialogProvider');
    }
    return context;
};

interface DialogProviderProps {
    children: ReactNode;
}

export const DialogProvider = ({ children }: DialogProviderProps) => {
    const theme = useTheme();
    const [visible, setVisible] = useState(false);
    const [options, setOptions] = useState<DialogOptions>({});
    const [loading, setLoading] = useState(false);

    const hide = useCallback(() => {
        setVisible(false);
    }, []);

    const show = useCallback((opts: DialogOptions) => {
        setOptions(opts);
        setVisible(true);
    }, []);

    const alert = useCallback((title: string, message?: string, actions?: DialogAction[]) => {
        show({
            title,
            message,
            actions: actions || [{ text: 'OK' }],
            dismissable: true,
        });
    }, [show]);

    const confirm = useCallback((title: string, message: string, onConfirm: () => void | Promise<void>) => {
        show({
            title,
            message,
            actions: [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: onConfirm },
            ],
            dismissable: true,
        });
    }, [show]);

    const handleActionPress = async (action: DialogAction) => {
        try {
            if (action.onPress) {
                const result = action.onPress();
                if (result instanceof Promise) {
                    setLoading(true);
                    await result;
                }
            }
        } finally {
            setLoading(false);
            hide();
        }
    };

    return (
        <DialogContext.Provider value={{ alert, confirm, show, hide }}>
            {children}
            <Portal>
                <Dialog 
                    visible={visible} 
                    onDismiss={options.dismissable !== false ? hide : undefined}
                    style={{ backgroundColor: theme.colors.surface, borderRadius: 12 }}
                >
                    {options.title && <Dialog.Title style={{ fontWeight: 'bold' }}>{options.title}</Dialog.Title>}
                    <Dialog.Content>
                        {options.message && <Paragraph>{options.message}</Paragraph>}
                    </Dialog.Content>
                    <Dialog.Actions>
                        {options.actions?.map((action, index) => {
                             const isDestructive = action.style === 'destructive';
                             const isCancel = action.style === 'cancel';
                             
                             return (
                                <Button
                                    key={index}
                                    onPress={() => handleActionPress(action)}
                                    loading={loading}
                                    disabled={loading}
                                    textColor={isDestructive ? theme.colors.error : (isCancel ? theme.colors.secondary : theme.colors.primary)}
                                >
                                    {action.text}
                                </Button>
                             );
                        })}
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </DialogContext.Provider>
    );
};
