import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { AppDialog, type AppDialogAction } from '../ui/AppDialog';

type NativeAlertAction = {
    text?: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

type DialogContextValue = {
    alert: (title: string, message?: string, actions?: NativeAlertAction[]) => void;
    confirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
    hide: () => void;
};

type DialogState = {
    visible: boolean;
    title: string;
    message?: string;
    actions: AppDialogAction[];
};

const DEFAULT_ACTIONS: AppDialogAction[] = [{ label: 'OK', variant: 'default' }];

const DialogContext = createContext<DialogContextValue | null>(null);

const mapActions = (actions?: NativeAlertAction[]): AppDialogAction[] => {
    if (!actions || actions.length === 0) return DEFAULT_ACTIONS;
    return actions.map((action) => ({
        label: action.text?.trim() || 'OK',
        onPress: action.onPress,
        variant: action.style ?? 'default',
    }));
};

export function DialogProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<DialogState>({
        visible: false,
        title: '',
        message: '',
        actions: DEFAULT_ACTIONS,
    });

    const hide = useCallback(() => {
        setState((current) => ({ ...current, visible: false }));
    }, []);

    const alert = useCallback((title: string, message?: string, actions?: NativeAlertAction[]) => {
        setState({
            visible: true,
            title,
            message,
            actions: mapActions(actions),
        });
    }, []);

    const confirm = useCallback(
        (title: string, message: string, onConfirm: () => void, confirmLabel = 'Confirm') => {
            alert(title, message, [
                { text: 'Cancel', style: 'cancel' },
                { text: confirmLabel, style: 'default', onPress: onConfirm },
            ]);
        },
        [alert]
    );

    const value = useMemo<DialogContextValue>(
        () => ({
            alert,
            confirm,
            hide,
        }),
        [alert, confirm, hide]
    );

    return (
        <DialogContext.Provider value={value}>
            {children}
            <AppDialog
                visible={state.visible}
                title={state.title}
                message={state.message}
                actions={state.actions}
                onClose={hide}
            />
        </DialogContext.Provider>
    );
}

export function useAppDialog() {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useAppDialog must be used within DialogProvider');
    }
    return context;
}
