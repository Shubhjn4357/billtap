
import React, { useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput, SegmentedButtons, HelperText, useTheme } from 'react-native-paper';

interface StockAdjustmentDialogProps {
    visible: boolean;
    onDismiss: () => void;
    onSubmit: (qty: number, type: 'IN' | 'OUT', reason: string) => Promise<void>;
    itemName: string;
    currentStock: number;
}

export const StockAdjustmentDialog = ({ visible, onDismiss, onSubmit, itemName, currentStock }: StockAdjustmentDialogProps) => {
    const theme = useTheme();
    const [type, setType] = useState<'IN' | 'OUT'>('IN');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss} style={{ backgroundColor: theme.colors.surface }}>
                <Dialog.Title>Adjust Stock: {itemName}</Dialog.Title>
                <Dialog.Content>
                    <SegmentedButtons
                        value={type}
                        onValueChange={val => setType(val as 'IN' | 'OUT')}
                        buttons={[
                            { value: 'IN', label: 'Add (+)', style: { backgroundColor: type === 'IN' ? theme.colors.primaryContainer : undefined } },
                            { value: 'OUT', label: 'Remove (-)', style: { backgroundColor: type === 'OUT' ? theme.colors.errorContainer : undefined } },
                        ]}
                        style={styles.segment}
                    />

                    <TextInput
                        label="Quantity"
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.input}
                    />

                    <TextInput
                        label="Reason (Optional)"
                        value={reason}
                        onChangeText={setReason}
                        mode="outlined"
                        placeholder="e.g. New Shipment, Damaged"
                        style={styles.input}
                    />

                    <Text variant="bodySmall" style={{ marginTop: 8, color: theme.colors.outline }}>
                        Current Stock: {currentStock}{' -> '}New Stock: {type === 'IN' ? currentStock + (parseInt(quantity) || 0) : currentStock - (parseInt(quantity) || 0)}
                    </Text>

                    <HelperText type="error" visible={!!error}>
                        {error}
                    </HelperText>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>Cancel</Button>
                    <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={loading}>
                        Update
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

const styles = StyleSheet.create({
    segment: {
        marginBottom: 16,
    },
    input: {
        marginBottom: 12,
        backgroundColor: 'transparent',
    },
});
