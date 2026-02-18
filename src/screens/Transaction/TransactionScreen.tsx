
import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, useTheme, SegmentedButtons, IconButton, Divider, Menu, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppInput } from '../../components/common/AppInput';
import { AppDateField } from '../../components/common/AppDateField';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { DesignSystem } from '../../constants/DesignSystem';
import { usePartyStore, useSettingsStore, useTransactionStore } from '../../store';
import { useStock } from '../../hooks/useStock';
import { COMMON_TEXT } from '../../constants/staticText';
import { nanoid } from 'nanoid/non-secure';
import type { Transaction, TransactionItem, Party, Item } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { transactionService } from '../../api/transactionService';
import { offlineSyncService } from '../../api/offlineSyncService';
import { taskNotificationService } from '../../services/taskNotificationService';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { transactionCreditSchema } from '../../validation/forms';
import { isNetworkLikeError } from '../../utils/errorGuards';

export const TransactionScreen = () => {
    const router = useRouter();
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 980;
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const { parties } = usePartyStore();
    const { allItems } = useStock();
    const { addTransaction, loading } = useTransactionStore();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? 'INR');
    const dialog = useAppDialog();

    const [type, setType] = useState<'SALE' | 'PURCHASE'>('SALE');
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [billNo, setBillNo] = useState(`INV-${Date.now().toString().slice(-6)}`);
    const [billDate, setBillDate] = useState<Date>(new Date());
    const [remarks, setRemarks] = useState('');
    const [paymentMode, setPaymentMode] = useState<'CASH' | 'CREDIT'>('CASH');
    const [paidAmountInput, setPaidAmountInput] = useState('');
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);
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
            dialog.alert(COMMON_TEXT.alerts.error, 'Please select a party.');
            return;
        }
        if (items.length === 0) {
            dialog.alert(COMMON_TEXT.alerts.error, 'Please add at least one item.');
            return;
        }
        if (!user) {
            dialog.alert(COMMON_TEXT.alerts.error, 'You must be logged in.');
            return;
        }

        const normalizedBillNo = billNo.trim().toUpperCase();
        if (!normalizedBillNo) {
            dialog.alert(COMMON_TEXT.alerts.validation, 'Bill number is required.');
            return;
        }

        const cachedBills = await offlineSyncService.getCachedBills<Record<string, unknown> & { id: string }>();
        const duplicateBill = cachedBills.find((entry) => {
            const raw = entry.billNumber;
            return typeof raw === 'string' && raw.trim().toUpperCase() === normalizedBillNo;
        });
        if (duplicateBill) {
            dialog.alert(COMMON_TEXT.alerts.validation, `Bill number "${normalizedBillNo}" already exists.`);
            return;
        }

        const paidAmount = paymentMode === 'CREDIT'
            ? Number(paidAmountInput || 0)
            : totals.total;
        const reminderDays = Number(reminderFrequencyDays || 3);
        if (paymentMode === 'CREDIT') {
            if (!dueDate) {
                dialog.alert(COMMON_TEXT.alerts.validation, 'Please choose a due date.');
                return;
            }
            const validation = transactionCreditSchema.safeParse({
                paidAmount,
                totalAmount: totals.total,
                reminderFrequencyDays: reminderDays,
                dueDate,
            });
            if (!validation.success) {
                dialog.alert(COMMON_TEXT.alerts.validation, validation.error.issues[0]?.message || 'Invalid credit payment details.');
                return;
            }
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
            currency: activeCurrency,
            billDate: billDate.getTime(),
            createdAt: billDate.getTime(),
            updatedAt: Date.now(),
            billNumber: normalizedBillNo,
            remark: remarks || undefined
        };

        try {
            const transactionId = await transactionService.createTransaction({
                id: localId,
                type,
                partyId: selectedParty.id,
                partyName: selectedParty.name,
                partyPhone: selectedParty.phone,
                billNumber: normalizedBillNo,
                billDate,
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
                currency: activeCurrency,
                remark: remarks || undefined,
            });
            addTransaction({
                ...transaction,
                id: transactionId,
            });
            await taskNotificationService.notify('Transaction Saved', `${type} transaction ${normalizedBillNo} saved successfully.`);
            dialog.alert(COMMON_TEXT.alerts.success, 'Transaction saved successfully.');
            router.back();
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to save transaction.');
            }
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="New Transaction"
                        subtitle="Create a sale or purchase with payment and reminder controls."
                    />

                    <AppCard>
                        <SegmentedButtons
                            value={type}
                            onValueChange={(val) => {
                                setType(val as 'SALE' | 'PURCHASE');
                                setItems([]);
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
                            anchor={(
                                <Button mode="outlined" onPress={() => setShowPartyMenu(true)} style={styles.selector}>
                                    {selectedParty ? selectedParty.name : 'Select Party'}
                                </Button>
                            )}
                        >
                            {parties.map((party) => (
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
                            onChangeText={(value) => setBillNo(value.toUpperCase().replace(/\s+/g, ''))}
                            inputType="text"
                        />
                        <AppDateField
                            label="Bill Date"
                            value={billDate}
                            onChange={setBillDate}
                        />
                    </View>

                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.label}>Payment Mode</Text>
                        <SegmentedButtons
                            value={paymentMode}
                            onValueChange={(value) => {
                                const nextMode = value as 'CASH' | 'CREDIT';
                                setPaymentMode(nextMode);
                                if (nextMode === 'CASH') {
                                    setDueDate(undefined);
                                    setPaidAmountInput('');
                                }
                            }}
                            buttons={[
                                { value: 'CASH', label: 'Cash' },
                                { value: 'CREDIT', label: 'Credit' },
                            ]}
                        />
                        {paymentMode === 'CREDIT' && (
                            <View style={styles.creditSection}>
                                <AppInput
                                    label="Paid Amount (optional)"
                                    value={paidAmountInput}
                                    onChangeText={setPaidAmountInput}
                                    inputType="decimal"
                                />
                                <AppButton
                                    mode="outlined"
                                    onPress={() => setShowDueDatePicker(true)}
                                    icon="calendar"
                                    contentStyle={{ justifyContent: 'flex-start' }}
                                >
                                    {dueDate ? dueDate.toLocaleDateString() : 'Select Due Date'}
                                </AppButton>
                                {showDueDatePicker && (
                                    <DateTimePicker
                                        value={dueDate ?? new Date()}
                                        mode="date"
                                        display="default"
                                        onChange={(_event, selectedDate) => {
                                            setShowDueDatePicker(false);
                                            if (selectedDate) {
                                                setDueDate(selectedDate);
                                            }
                                        }}
                                    />
                                )}
                                <AppInput
                                    label="Reminder Every (Days)"
                                    value={reminderFrequencyDays}
                                    onChangeText={setReminderFrequencyDays}
                                    inputType="number"
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
                        <View style={styles.itemsHeaderRow}>
                            <Text variant="titleMedium" style={styles.label}>Items</Text>
                            <Menu
                                visible={showItemMenu}
                                onDismiss={() => setShowItemMenu(false)}
                                anchor={(
                                    <Button mode="contained-tonal" compact onPress={() => setShowItemMenu(true)}>
                                        + Add Item
                                    </Button>
                                )}
                            >
                                {allItems.map((item) => (
                                    <Menu.Item
                                        key={item.id}
                                        onPress={() => handleAddItem(item)}
                                        title={`${item.name} (Stock: ${item.stock})`}
                                    />
                                ))}
                            </Menu>
                        </View>

                        {items.map((item, index) => (
                            <View key={item.id} style={[styles.itemRow, { borderBottomColor: theme.colors.outline }]}>
                                <View style={styles.itemInfo}>
                                    <Text variant="bodyMedium" style={styles.itemName}>{item.name}</Text>
                                    <Text variant="bodySmall">Price: {item.price}</Text>
                                </View>
                                <View style={styles.itemQtyControl}>
                                    <IconButton icon="minus" size={16} onPress={() => updateItemQuantity(index, (item.quantity - 1).toString())} />
                                    <Text>{item.quantity}</Text>
                                    <IconButton icon="plus" size={16} onPress={() => updateItemQuantity(index, (item.quantity + 1).toString())} />
                                </View>
                                <View style={styles.itemTotalInfo}>
                                    <Text variant="bodyMedium" style={styles.itemName}>
                                        {formatCurrency(item.quantity * item.price, activeCurrency)}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                        GST: {item.tax}%
                                    </Text>
                                </View>
                                <IconButton icon="delete" size={20} iconColor={theme.colors.error} onPress={() => removeItem(index)} />
                            </View>
                        ))}
                    </View>

                    <Divider style={styles.sectionDivider} />

                    <View style={[styles.summary, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <View style={styles.summaryRow}>
                            <Text>Subtotal</Text>
                            <Text>{formatCurrency(totals.subtotal, activeCurrency)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text>Tax</Text>
                            <Text>{formatCurrency(totals.taxAmount, activeCurrency)}</Text>
                        </View>
                        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                            <Text variant="titleLarge" style={styles.summaryTotalText}>Total</Text>
                            <Text variant="titleLarge" style={[styles.summaryTotalText, { color: theme.colors.primary }]}>
                                {formatCurrency(totals.total, activeCurrency)}
                            </Text>
                        </View>
                        {paymentMode === 'CREDIT' && (
                            <View style={[styles.summaryRow, styles.summaryDueRow]}>
                                <Text variant="bodyLarge" style={styles.summaryDueText}>Due</Text>
                                <Text variant="bodyLarge" style={[styles.summaryDueText, { color: theme.colors.error }]}>
                                    {formatCurrency(Math.max(totals.total - Number(paidAmountInput || 0), 0), activeCurrency)}
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
                        inputType="text"
                        style={styles.remarksInput}
                    />

                    <AppButton
                        mode="contained"
                        onPress={handleSave}
                        loading={loading}
                        style={styles.saveButton}
                    >
                        Save {type === 'SALE' ? 'Sale' : 'Purchase'}
                    </AppButton>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    section: {
        marginBottom: DesignSystem.spacing.md + 2,
    },
    label: {
        marginBottom: DesignSystem.spacing.xs,
        fontWeight: '700',
    },
    selector: {
        alignItems: 'flex-start',
    },
    creditSection: {
        marginTop: DesignSystem.spacing.sm,
    },
    itemsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: DesignSystem.spacing.sm,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: DesignSystem.spacing.sm,
        borderBottomWidth: 1,
    },
    itemInfo: {
        flex: 3,
    },
    itemQtyControl: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemTotalInfo: {
        flex: 2,
        alignItems: 'flex-end',
    },
    itemName: {
        fontWeight: '700',
    },
    sectionDivider: {
        marginVertical: DesignSystem.spacing.lg + 2,
    },
    summary: {
        padding: DesignSystem.spacing.md + 2,
        borderRadius: DesignSystem.radius.md,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: DesignSystem.spacing.xxs,
    },
    summaryTotalRow: {
        marginTop: DesignSystem.spacing.sm,
    },
    summaryTotalText: {
        fontWeight: '700',
    },
    summaryDueRow: {
        marginTop: DesignSystem.spacing.xs,
    },
    summaryDueText: {
        fontWeight: '700',
    },
    remarksInput: {
        marginTop: DesignSystem.spacing.lg + 2,
    },
    saveButton: {
        marginTop: DesignSystem.spacing.xl + 6,
    },
});
