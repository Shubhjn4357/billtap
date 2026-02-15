
import React, { useState, useMemo } from 'react';
import { View, ScrollView, Alert, StyleSheet } from 'react-native';
import { Text, useTheme, SegmentedButtons, IconButton, Divider, Menu, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { usePartyStore, useTransactionStore } from '../../store';
import { useStock } from '../../hooks/useStock';
import { COMMON_TEXT } from '../../constants/staticText';
import { nanoid } from 'nanoid/non-secure';
import type { Transaction, TransactionItem, Party, Item } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { transactionService } from '../../api/transactionService';
import { taskNotificationService } from '../../services/taskNotificationService';
import { formatCurrency } from '../../utils/formatters';

export const TransactionScreen = () => {
    const router = useRouter();
    const theme = useTheme();
    const { user } = useAuth();
    const { parties } = usePartyStore();
    const { allItems } = useStock();
    const { addTransaction, loading } = useTransactionStore();

    const [type, setType] = useState<'SALE' | 'PURCHASE'>('SALE');
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [billNo, setBillNo] = useState(`INV-${Date.now().toString().slice(-6)}`);
    const [remarks, setRemarks] = useState('');
    const [paymentMode, setPaymentMode] = useState<'CASH' | 'CREDIT'>('CASH');
    const [paidAmountInput, setPaidAmountInput] = useState('');
    const [dueDateInput, setDueDateInput] = useState('');
    const [reminderEnabled, setReminderEnabled] = useState(true);
    const [reminderFrequencyDays, setReminderFrequencyDays] = useState('3');

    // Item Selection Modal/Menu State (Simplified as a list for now)
    const [showItemMenu, setShowItemMenu] = useState(false);
    const [showPartyMenu, setShowPartyMenu] = useState(false);

    const handleAddItem = (item: Item) => {
        const existing = items.find(i => i.id === item.id);
        if (existing) {
            setItems(items.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i));
        } else {
            setItems([...items, {
                id: item.id,
                name: item.name,
                quantity: 1,
                price: type === 'SALE' ? item.price : (item.purchasePrice || 0),
                tax: item.gstPercentage || 0,
                total: 1 * (type === 'SALE' ? item.price : (item.purchasePrice || 0))
            }]);
        }
        setShowItemMenu(false);
    };

    const updateItemQuantity = (index: number, quantity: string) => {
        const qty = Number(quantity);
        if (isNaN(qty) || qty < 0) return;
        const newItems = [...items];
        newItems[index].quantity = qty;
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const totals = useMemo(() => {
        let subtotal = 0;
        let taxAmount = 0;
        items.forEach(item => {
            const itemTotal = item.quantity * item.price;
            subtotal += itemTotal;
            taxAmount += (itemTotal * item.tax) / 100;
        });
        return { subtotal, taxAmount, total: subtotal + taxAmount };
    }, [items]);

    const handleSave = async () => {
        if (!selectedParty) {
            return Alert.alert(COMMON_TEXT.alerts.error, 'Please select a party.');
        }
        if (items.length === 0) {
            return Alert.alert(COMMON_TEXT.alerts.error, 'Please add at least one item.');
        }
        if (!user) {
            return Alert.alert(COMMON_TEXT.alerts.error, 'You must be logged in.');
        }

        const paidAmount = paymentMode === 'CREDIT'
            ? Number(paidAmountInput || 0)
            : totals.total;
        if (Number.isNaN(paidAmount) || paidAmount < 0 || paidAmount > totals.total) {
            return Alert.alert(COMMON_TEXT.alerts.validation, 'Invalid paid amount.');
        }

        const dueDate = paymentMode === 'CREDIT'
            ? (dueDateInput.trim() ? new Date(`${dueDateInput.trim()}T00:00:00`) : undefined)
            : undefined;
        if (paymentMode === 'CREDIT' && dueDate && Number.isNaN(dueDate.getTime())) {
            return Alert.alert(COMMON_TEXT.alerts.validation, 'Due date must be YYYY-MM-DD.');
        }

        const reminderDays = Number(reminderFrequencyDays || 3);
        if (paymentMode === 'CREDIT' && (Number.isNaN(reminderDays) || reminderDays <= 0)) {
            return Alert.alert(COMMON_TEXT.alerts.validation, 'Reminder frequency must be a positive number.');
        }

        const localId = nanoid();
        const transaction: Transaction = {
            id: localId,
            type,
            partyId: selectedParty.id,
            partyName: selectedParty.name,
            partyPhone: selectedParty.phone,
            userId: user.uid,
            items,
            totalAmount: totals.total,
            taxAmount: totals.taxAmount,
            discountAmount: 0,
            paidAmount,
            paymentMode,
            paymentStatus: paidAmount >= totals.total ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'),
            dueDate: dueDate ? dueDate.toISOString() : undefined,
            reminderEnabled: paymentMode === 'CREDIT' ? reminderEnabled : false,
            reminderFrequencyDays: paymentMode === 'CREDIT' ? reminderDays : undefined,
            currency: 'INR',
            billDate: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            billNumber: billNo,
            remark: remarks || undefined
        };

        try {
            const transactionId = await transactionService.createTransaction({
                id: localId,
                type,
                partyId: selectedParty.id,
                partyName: selectedParty.name,
                partyPhone: selectedParty.phone,
                billNumber: billNo,
                billDate: new Date(),
                items,
                totalAmount: totals.total,
                discountAmount: 0,
                taxAmount: totals.taxAmount,
                paidAmount,
                paymentMode,
                paymentStatus: paidAmount >= totals.total ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'),
                dueDate,
                reminderEnabled: paymentMode === 'CREDIT' ? reminderEnabled : false,
                reminderFrequencyDays: paymentMode === 'CREDIT' ? reminderDays : undefined,
                nextReminderAt: paymentMode === 'CREDIT' && reminderEnabled
                    ? (dueDate ?? new Date(Date.now() + reminderDays * 24 * 60 * 60 * 1000))
                    : undefined,
                currency: user.currency || 'INR',
                remark: remarks || undefined,
            });
            addTransaction({
                ...transaction,
                id: transactionId,
            });
            await taskNotificationService.notify('Transaction Saved', `${type} transaction ${billNo} saved successfully.`);
            Alert.alert(COMMON_TEXT.alerts.success, 'Transaction saved successfully.');
            router.back();
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to save transaction.');
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                <PageHeaderCard
                    title="New Transaction"
                    subtitle="Create a sale or purchase with payment and reminder controls."
                />

                <AppCard>
                    <SegmentedButtons
                        value={type}
                        onValueChange={(val) => {
                            setType(val as 'SALE' | 'PURCHASE');
                            setItems([]); // Clear items on type switch as prices differ
                        }}
                        buttons={[
                            { value: 'SALE', label: 'Sale' },
                            { value: 'PURCHASE', label: 'Purchase' },
                        ]}
                    />
                </AppCard>

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.label}>Party</Text>
                    <Menu
                        visible={showPartyMenu}
                        onDismiss={() => setShowPartyMenu(false)}
                        anchor={
                            <Button mode="outlined" onPress={() => setShowPartyMenu(true)} style={styles.selector}>
                                {selectedParty ? selectedParty.name : 'Select Party'}
                            </Button>
                        }
                    >
                        {parties.map(party => (
                            <Menu.Item
                                key={party.id}
                                onPress={() => { setSelectedParty(party); setShowPartyMenu(false); }}
                                title={party.name}
                            />
                        ))}
                        <Menu.Item onPress={() => { setShowPartyMenu(false); router.push('/party/new' as never); }} title="+ Add New Party" />
                    </Menu>
                </View>

                <View style={styles.section}>
                    <AppInput
                        label="Bill Number"
                        value={billNo}
                        onChangeText={setBillNo}
                    />
                </View>

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.label}>Payment Mode</Text>
                    <SegmentedButtons
                        value={paymentMode}
                        onValueChange={(value) => setPaymentMode(value as 'CASH' | 'CREDIT')}
                        buttons={[
                            { value: 'CASH', label: 'Cash' },
                            { value: 'CREDIT', label: 'Credit' },
                        ]}
                    />
                    {paymentMode === 'CREDIT' && (
                        <View style={{ marginTop: 10 }}>
                            <AppInput
                                label="Paid Amount (optional)"
                                value={paidAmountInput}
                                onChangeText={setPaidAmountInput}
                                keyboardType="decimal-pad"
                            />
                            <AppInput
                                label="Due Date (YYYY-MM-DD)"
                                value={dueDateInput}
                                onChangeText={setDueDateInput}
                            />
                            <AppInput
                                label="Reminder Every (Days)"
                                value={reminderFrequencyDays}
                                onChangeText={setReminderFrequencyDays}
                                keyboardType="number-pad"
                            />
                            <Button
                                mode={reminderEnabled ? 'contained-tonal' : 'outlined'}
                                onPress={() => setReminderEnabled((current) => !current)}
                            >
                                {reminderEnabled ? 'Reminder Enabled' : 'Enable Reminder'}
                            </Button>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text variant="titleMedium" style={styles.label}>Items</Text>
                        <Menu
                            visible={showItemMenu}
                            onDismiss={() => setShowItemMenu(false)}
                            anchor={
                                <Button mode="contained-tonal" compact onPress={() => setShowItemMenu(true)}>
                                    + Add Item
                                </Button>
                            }
                        >
                            {allItems.map(item => (
                                <Menu.Item
                                    key={item.id}
                                    onPress={() => handleAddItem(item)}
                                    title={`${item.name} (Stock: ${item.stock})`}
                                />
                            ))}
                        </Menu>
                    </View>

                    {items.map((item, index) => (
                        <View key={index} style={styles.itemRow}>
                            <View style={{ flex: 3 }}>
                                <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>{item.name}</Text>
                                <Text variant="bodySmall">Price: {item.price}</Text>
                            </View>
                            <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                                <IconButton icon="minus" size={16} onPress={() => updateItemQuantity(index, (item.quantity - 1).toString())} />
                                <Text>{item.quantity}</Text>
                                <IconButton icon="plus" size={16} onPress={() => updateItemQuantity(index, (item.quantity + 1).toString())} />
                            </View>
                            <View style={{ flex: 2, alignItems: 'flex-end' }}>
                                <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                                    {formatCurrency(item.quantity * item.price, 'INR')}
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    GST: {item.tax}%
                                </Text>
                            </View>
                            <IconButton icon="delete" size={20} iconColor={theme.colors.error} onPress={() => removeItem(index)} />
                        </View>
                    ))}
                </View>

                <Divider style={{ marginVertical: 20 }} />

                <View style={[styles.summary, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <View style={styles.summaryRow}>
                        <Text>Subtotal</Text>
                        <Text>{formatCurrency(totals.subtotal, 'INR')}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text>Tax</Text>
                        <Text>{formatCurrency(totals.taxAmount, 'INR')}</Text>
                    </View>
                    <View style={[styles.summaryRow, { marginTop: 10 }]}>
                        <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>Total</Text>
                        <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                            {formatCurrency(totals.total, 'INR')}
                        </Text>
                    </View>
                    {paymentMode === 'CREDIT' && (
                        <View style={[styles.summaryRow, { marginTop: 8 }]}>
                            <Text variant="bodyLarge" style={{ fontWeight: '700' }}>Due</Text>
                            <Text variant="bodyLarge" style={{ fontWeight: '700', color: theme.colors.error }}>
                                {formatCurrency(Math.max(totals.total - Number(paidAmountInput || 0), 0), 'INR')}
                            </Text>
                        </View>
                    )}
                </View>

                <AppInput
                    label="Remarks (Optional)"
                    value={remarks}
                    onChangeText={setRemarks}
                    multiline
                    numberOfLines={2}
                    style={{ marginTop: 20 }}
                />

                <AppButton
                    mode="contained"
                    onPress={handleSave}
                    loading={loading}
                    style={{ marginTop: 30 }}
                >
                    Save {type === 'SALE' ? 'Sale' : 'Purchase'}
                </AppButton>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    section: { marginBottom: 20 },
    label: { marginBottom: 8, fontWeight: 'bold' },
    selector: { alignItems: 'flex-start' },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    summary: { padding: 16, borderRadius: 12 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
});
