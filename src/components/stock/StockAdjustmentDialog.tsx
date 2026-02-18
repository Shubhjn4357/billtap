import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
    Button,
    Divider,
    HelperText,
    Portal,
    SegmentedButtons,
    Surface,
    Text,
    useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppInput } from '../common/AppInput';

interface StockAdjustmentDialogProps {
    visible: boolean;
    onDismiss: () => void;
    onSubmit: (qty: number, type: 'IN' | 'OUT', reason: string) => Promise<void>;
    itemName: string;
    currentStock: number;
}

export const StockAdjustmentDialog = ({ visible, onDismiss, onSubmit, itemName, currentStock }: StockAdjustmentDialogProps) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [type, setType] = useState<'IN' | 'OUT'>('IN');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const quantityValue = useMemo(() => Number.parseInt(quantity, 10) || 0, [quantity]);
    const nextStock = type === 'IN' ? currentStock + quantityValue : currentStock - quantityValue;

    useEffect(() => {
        if (visible) {
            setType('IN');
            setQuantity('');
            setReason('');
            setError('');
            setLoading(false);
        }
    }, [visible]);

    const handleSubmit = async () => {
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) {
            setError('Please enter a valid quantity.');
            return;
        }

        if (type === 'OUT' && qty > currentStock) {
            setError(`Cannot remove more than current stock (${currentStock}).`);
            return;
        }

        setError('');
        setLoading(true);
        try {
            await onSubmit(qty, type, reason.trim());
            onDismiss();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to update stock.');
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <Portal>
            <View style={styles.overlay} pointerEvents="box-none">
                <Pressable
                    style={[
                        styles.backdrop,
                        { backgroundColor: theme.colors.backdrop },
                    ]}
                    onPress={onDismiss}
                />
                <Surface
                    style={[
                        styles.drawer,
                        {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.outlineVariant ?? theme.colors.outline,
                            paddingBottom: insets.bottom + 12,
                        },
                    ]}
                >
                    <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant ?? theme.colors.outline }]} />
                    <Text variant="titleMedium" style={styles.title}>
                        Adjust Stock
                    </Text>
                    <Text variant="bodySmall" style={[styles.subtitle, { color: theme.colors.outline }]}>
                        {itemName}
                    </Text>
                    <Divider style={styles.divider} />

                    <SegmentedButtons
                        value={type}
                        onValueChange={(val) => setType(val as 'IN' | 'OUT')}
                        buttons={[
                            {
                                value: 'IN',
                                label: 'Add (+)',
                                style: { backgroundColor: type === 'IN' ? theme.colors.primaryContainer : undefined },
                            },
                            {
                                value: 'OUT',
                                label: 'Remove (-)',
                                style: { backgroundColor: type === 'OUT' ? theme.colors.errorContainer : undefined },
                            },
                        ]}
                        style={styles.segment}
                    />

                    <AppInput
                        label="Quantity"
                        value={quantity}
                        onChangeText={setQuantity}
                        inputType="number"
                        style={styles.input}
                    />

                    <AppInput
                        label="Reason (Optional)"
                        value={reason}
                        onChangeText={setReason}
                        inputType="text"
                        placeholder="e.g. New shipment, damaged stock"
                        style={styles.input}
                    />

                    <Text variant="bodySmall" style={{ marginTop: 2, color: theme.colors.outline }}>
                        Current Stock: {currentStock}{' -> '}New Stock: {nextStock}
                    </Text>

                    <HelperText type="error" visible={!!error}>
                        {error}
                    </HelperText>

                    <View style={styles.actions}>
                        <Button onPress={onDismiss}>Cancel</Button>
                        <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={loading}>
                            Update
                        </Button>
                    </View>
                </Surface>
            </View>
        </Portal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    drawer: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    handle: {
        alignSelf: 'center',
        width: 44,
        height: 4,
        borderRadius: 2,
        marginBottom: 10,
    },
    title: {
        fontWeight: '700',
    },
    subtitle: {
        marginTop: 2,
    },
    divider: {
        marginTop: 10,
        marginBottom: 12,
    },
    segment: {
        marginBottom: 16,
    },
    input: {
        marginBottom: 12,
        backgroundColor: 'transparent',
    },
    actions: {
        marginTop: 6,
        marginBottom: 6,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 8,
    },
});
