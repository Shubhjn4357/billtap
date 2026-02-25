import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Portal, Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiFeedbackStore } from '../../store';

export const GlobalToastHost: React.FC = () => {
    const insets = useSafeAreaInsets();
    const toastMessage = useUiFeedbackStore((state) => state.toastMessage);
    const toastToken = useUiFeedbackStore((state) => state.toastToken);
    const hideToast = useUiFeedbackStore((state) => state.hideToast);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (toastMessage) {
            setVisible(true);
        }
    }, [toastMessage, toastToken]);

    const onDismiss = () => {
        setVisible(false);
        hideToast();
    };

    return (
        <Portal>
            <Snackbar
                visible={visible && Boolean(toastMessage)}
                onDismiss={onDismiss}
                duration={2600}
                style={[styles.snackbar, { bottom: insets.bottom + 78 }]}
            >
                {toastMessage ?? ''}
            </Snackbar>
        </Portal>
    );
};

const styles = StyleSheet.create({
    snackbar: {
        position: 'absolute',
        left: 12,
        right: 12,
    },
});
