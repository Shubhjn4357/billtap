import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme, Button, Modal, Portal, Surface, Text } from 'react-native-paper';
import { isNetworkLikeMessage } from '../../utils/errorGuards';
import { DesignSystem } from '../../constants/DesignSystem';

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
const DUPLICATE_ALERT_WINDOW_MS = 2400;

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
    const lastAlertRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });

    const hide = useCallback(() => {
        setVisible(false);
    }, []);

    const show = useCallback((opts: DialogOptions) => {
        setOptions(opts);
        setVisible(true);
    }, []);

    const alert = useCallback((title: string, message?: string, actions?: DialogAction[]) => {
        const normalizedTitle = title?.trim() ?? '';
        const normalizedMessage = message?.trim() ?? '';

        // Connectivity failures are surfaced via the global online/offline avatar indicator.
        if (isNetworkLikeMessage(normalizedTitle) || isNetworkLikeMessage(normalizedMessage)) {
            return;
        }

        const dedupeKey = `${normalizedTitle}::${normalizedMessage}`;
        const now = Date.now();
        if (lastAlertRef.current.key === dedupeKey && now - lastAlertRef.current.at < DUPLICATE_ALERT_WINDOW_MS) {
            return;
        }
        lastAlertRef.current = { key: dedupeKey, at: now };

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
                <Modal
                    visible={visible}
                    onDismiss={options.dismissable !== false ? hide : undefined}
                    dismissable={options.dismissable !== false}
                    contentContainerStyle={styles.modalContainer}
                >
                    <Surface
                        style={[
                            styles.drawer,
                            {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.outlineVariant,
                            },
                        ]}
                    >
                        <View
                            style={[
                                styles.handle,
                                { backgroundColor: theme.colors.outline },
                            ]}
                        />
                        {options.title ? (
                            <Text variant="titleMedium" style={styles.title}>
                                {options.title}
                            </Text>
                        ) : null}
                        {options.message ? (
                            <Text variant="bodyMedium" style={styles.message}>
                                {options.message}
                            </Text>
                        ) : null}
                        <View style={styles.actions}>
                            {options.actions?.map((action, index) => {
                                const isDestructive = action.style === 'destructive';
                                const isCancel = action.style === 'cancel';
                                const mode = isDestructive ? 'contained-tonal' : (isCancel ? 'outlined' : 'contained');

                                return (
                                    <Button
                                        key={`${action.text}-${index}`}
                                        mode={mode}
                                        onPress={() => { void handleActionPress(action); }}
                                        loading={loading}
                                        disabled={loading}
                                        style={styles.actionButton}
                                        textColor={isDestructive ? theme.colors.error : undefined}
                                    >
                                        {action.text}
                                    </Button>
                                );
                            })}
                        </View>
                    </Surface>
                </Modal>
            </Portal>
        </DialogContext.Provider>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        justifyContent: 'flex-end',
        margin: 0,
        paddingHorizontal: 0,
    },
    drawer: {
        borderTopLeftRadius: DesignSystem.radius.xl,
        borderTopRightRadius: DesignSystem.radius.xl,
        borderWidth: 1,
        borderBottomWidth: 0,
        paddingHorizontal: DesignSystem.spacing.md,
        paddingTop: DesignSystem.spacing.xs,
        paddingBottom: DesignSystem.spacing.md,
    },
    handle: {
        alignSelf: 'center',
        width: 42,
        height: 4,
        borderRadius: 999,
        marginBottom: DesignSystem.spacing.sm,
    },
    title: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.xs,
    },
    message: {
        marginBottom: DesignSystem.spacing.sm,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
    },
    actionButton: {
        minWidth: 96,
    },
});
