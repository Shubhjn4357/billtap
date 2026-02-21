
import React, { useState, useMemo, useEffect } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, useTheme, SegmentedButtons, IconButton, Divider, Menu, Button, List } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { randomUUID } from 'expo-crypto';
import type { TransactionItem, Party, Item } from '../../types';
import { useAuth } from '../../hooks/useAuth';
// import { transactionService } from '../../api/transactionService';
// import { offlineSyncService } from '../../api/offlineSyncService';
import type { NewDbTransaction } from '../../types/db';
import { taskNotificationService } from '../../services/taskNotificationService';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { shareViaWhatsApp, shareViaSMS } from '../../utils/shareIntent';
// import { transactionCreditSchema } from '../../validation/forms';
// import { isNetworkLikeError } from '../../utils/errorGuards';
import { billRepository } from '../../repositories/billRepository';

export const TransactionScreen = () => {
    const router = useRouter();
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 980;
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const { parties } = usePartyStore();
    const { allItems } = useStock();
    const { loading } = useTransactionStore();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? 'INR');
    const dialog = useAppDialog();

    const params = useLocalSearchParams<{ id: string }>();
    const id = params.id;
    const isEditMode = !!id;

    // Delivery Address State
    const [sameAsBilling, setSameAsBilling] = useState(true);
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryContactName, setDeliveryContactName] = useState('');
    const [deliveryContactPhone, setDeliveryContactPhone] = useState('');

    // State
    const [type, setType] = useState<'SALE' | 'PURCHASE'>('SALE');
    const [billNo, setBillNo] = useState('');
    const [billDate, setBillDate] = useState(new Date());
    const [remarks, setRemarks] = useState('');
    const [paymentMode, setPaymentMode] = useState<'CASH' | 'CREDIT'>('CASH');
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [paidAmountInput, setPaidAmountInput] = useState('');
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderFrequencyDays, setReminderFrequencyDays] = useState('3');
    const [showPartyMenu, setShowPartyMenu] = useState(false);
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);
    const [showItemMenu, setShowItemMenu] = useState(false);

    // Computed
    const totals = useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const taxAmount = items.reduce((sum, item) => sum + (item.price * item.quantity * (item.tax || 0)) / 100, 0);
        return {
            subtotal,
            taxAmount,
            total: subtotal + taxAmount,
        };
    }, [items]);

    // Helpers
    const handleAddItem = (item: Item) => {
        const existingItemIndex = items.findIndex((i) => i.id === item.id);
        if (existingItemIndex >= 0) {
            const newItems = [...items];
            newItems[existingItemIndex].quantity += 1;
            setItems(newItems);
        } else {
            setItems([...items, {
                id: item.id,
                name: item.name,
                quantity: 1,
                price: item.price,
                tax: item.gstPercentage || 0,
                total: item.price // Initial total for qty 1
            }]);
        }
        setShowItemMenu(false);
    };

    const updateItemQuantity = (index: number, quantityStr: string) => {
        const newItems = [...items];
        const quantity = parseInt(quantityStr) || 0;
        if (quantity <= 0) {
            newItems.splice(index, 1);
        } else {
            newItems[index].quantity = quantity;
        }
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleShareReminder = async (platform: 'whatsapp' | 'sms') => {
        const phoneToUse = deliveryContactPhone || (selectedParty?.phone ?? null);

        if (!phoneToUse) {
            dialog.alert('No Phone Number', 'Please select a party with a phone number or enter a delivery contact phone first.');
            return;
        }

        const dueAmount = Math.max(totals.total - Number(paidAmountInput || 0), 0);
        if (dueAmount <= 0) {
            dialog.alert('No Due Amount', 'This transaction is fully paid.');
            return;
        }

        const billName = user?.businessName || 'Us';

        const message = `Hello${selectedParty?.name ? ` ${selectedParty.name}` : ''},\n\nThis is a friendly reminder from ${billName} regarding your bill (${billNo}).\n\nTotal Amount: ${formatCurrency(totals.total, activeCurrency)}\nDue Amount: ${formatCurrency(dueAmount, activeCurrency)}\n\nPlease pay at your earliest convenience.\nThank you!`;

        try {
            if (platform === 'whatsapp') {
                await shareViaWhatsApp(phoneToUse, message);
            } else {
                await shareViaSMS(phoneToUse, message);
            }
        } catch (error: any) {
            dialog.alert('Error', error.message || `Failed to open ${platform}`);
        }
    };

    const handleDelete = () => {
        if (!id) return;
        dialog.confirm('Delete Transaction', 'Are you sure you want to delete this transaction? This action cannot be undone.', async () => {
            try {
                await billRepository.delete(id);
                router.back();
            } catch (e: any) {
                dialog.alert('Error', e.message || 'Failed to delete transaction');
            }
        });
    };

    // Effect to load existing transaction
    useEffect(() => {
        if (!id) return;

        const loadTransaction = async () => {
            try {
                const transaction = await billRepository.getById(id);
                if (!transaction) {
                    dialog.alert(COMMON_TEXT.alerts.error, 'Transaction not found');
                    router.back();
                    return;
                }

                setType(transaction.type as 'SALE' | 'PURCHASE');
                setBillNo(transaction.billNumber || '');
                setBillDate(new Date(transaction.billDate));
                setRemarks(transaction.remark || '');
                setPaymentMode(transaction.paymentMode as 'CASH' | 'CREDIT');

                // Set Delivery Address
                // Set Delivery Address
                if (transaction.deliveryAddress) {
                    setSameAsBilling(false);
                    setDeliveryAddress(transaction.deliveryAddress);
                    setDeliveryContactName(transaction.deliveryContactName || '');
                    setDeliveryContactPhone(transaction.deliveryContactPhone || '');
                } else {
                    setSameAsBilling(true);
                    setDeliveryContactName('');
                    setDeliveryContactPhone('');
                }

                if (transaction.dueDate) {
                    setDueDate(new Date(transaction.dueDate));
                }

                // Parse items
                try {
                    const parsedItems = transaction.itemsSnapshot ? JSON.parse(transaction.itemsSnapshot) : [];
                    setItems(parsedItems);
                } catch (e) {
                    console.error('Failed to parse items', e);
                }

                // Set party
                if (transaction.partyId) {
                    const party = parties.find(p => p.id === transaction.partyId);
                    if (party) setSelectedParty(party);
                    else setSelectedParty({ id: transaction.partyId, name: transaction.partyName } as Party);
                }

                if (transaction.paymentMode === 'CREDIT') {
                    setPaidAmountInput((transaction.paidAmount || 0).toString());
                }

            } catch (error) {
                console.error('Failed to load transaction', error);
                dialog.alert(COMMON_TEXT.alerts.error, 'Failed to load transaction details');
            }
        };

        loadTransaction();
    }, [id, parties, dialog, router]);

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

        if (!isEditMode) {
            const isAvailable = await billRepository.checkBillNumberAvailability(normalizedBillNo, user.uid);
            if (!isAvailable) {
                dialog.alert(COMMON_TEXT.alerts.validation, `Bill number "${normalizedBillNo}" already exists.`);
                return;
            }
        }

        const paidAmount = paymentMode === 'CREDIT'
            ? Number(paidAmountInput || 0)
            : totals.total;

        const dbPayload: NewDbTransaction = {
            id: id || randomUUID(),
            organizationId: user.uid,
            type,
            partyId: selectedParty.id,
            partyName: selectedParty.name,
            billNumber: normalizedBillNo,
            billDate: billDate.toISOString(),
            itemsSnapshot: JSON.stringify(items),
            totalAmount: totals.total,
            discountAmount: 0,
            taxAmount: totals.taxAmount,
            paidAmount,
            paymentMode,
            paymentStatus: paidAmount >= totals.total ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'),
            dueDate: dueDate ? dueDate.toISOString() : null,
            remark: remarks || null,
            deliveryAddress: sameAsBilling ? null : deliveryAddress, // Logic for delivery address
            deliveryContactName: sameAsBilling ? null : deliveryContactName,
            deliveryContactPhone: sameAsBilling ? null : deliveryContactPhone,
            currency: activeCurrency,
            createdAt: isEditMode ? (await billRepository.getById(id!))?.createdAt || new Date().toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        try {
            if (isEditMode) {
                await billRepository.update(id!, dbPayload);
            } else {
                await billRepository.create(dbPayload);
            }

            await taskNotificationService.notify('Transaction Saved', `${type} transaction ${normalizedBillNo} saved successfully.`);

            // Navigate to Success Screen on Creation (not necessarily edit, or maybe both? usually creation)
            if (!isEditMode) {
                router.replace({ pathname: '/bill-success', params: { id: dbPayload.id } });
            } else {
                dialog.alert(COMMON_TEXT.alerts.success, 'Transaction saved successfully.');
                router.back();
            }
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to save transaction.');
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

                    <List.AccordionGroup>
                        <AppCard style={styles.sectionCard}>
                            <List.Accordion title="Party & Logistics" id="1" left={props => <List.Icon {...props} icon="truck-fast-outline" />} titleStyle={{ fontWeight: '700' }} style={styles.accordionHeader}>
                                <View style={styles.accordionContent}>
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

                                    {/* Delivery Address Section */}
                                    <View style={styles.section}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                            <IconButton
                                                icon={sameAsBilling ? "checkbox-marked" : "checkbox-blank-outline"}
                                                size={20}
                                                onPress={() => setSameAsBilling(!sameAsBilling)}
                                                iconColor={theme.colors.primary}
                                                style={{ margin: 0 }}
                                            />
                                            <Text variant="bodyMedium" onPress={() => setSameAsBilling(!sameAsBilling)} style={{ marginLeft: 4 }}>
                                                Same as billing address
                                            </Text>
                                        </View>
                                        {!sameAsBilling && (
                                            <View style={{ gap: DesignSystem.spacing.sm }}>
                                                <AppInput
                                                    label="Delivery Address"
                                                    value={deliveryAddress}
                                                    onChangeText={setDeliveryAddress}
                                                    inputType="text"
                                                    multiline
                                                    numberOfLines={2}
                                                />
                                                <AppInput
                                                    label="Contact Name (Optional)"
                                                    value={deliveryContactName}
                                                    onChangeText={setDeliveryContactName}
                                                    inputType="text"
                                                />
                                                <AppInput
                                                    label="Contact Phone (Optional)"
                                                    value={deliveryContactPhone}
                                                    onChangeText={setDeliveryContactPhone}
                                                    inputType="phone"
                                                    maxLength={10}
                                                />
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </List.Accordion>
                        </AppCard>

                        <AppCard style={styles.sectionCard}>
                            <List.Accordion title="Billing & Payment" id="2" left={props => <List.Icon {...props} icon="receipt-text-outline" />} titleStyle={{ fontWeight: '700' }} style={styles.accordionHeader}>
                                <View style={styles.accordionContent}>
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
                                </View>
                            </List.Accordion>
                        </AppCard>
                    </List.AccordionGroup>

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

                    {isEditMode && (
                        <AppButton
                            mode="outlined"
                            textColor={theme.colors.error}
                            style={{ borderColor: theme.colors.error, marginBottom: DesignSystem.spacing.md }}
                            onPress={handleDelete}
                            icon="delete-outline"
                        >
                            Delete Transaction
                        </AppButton>
                    )}

                    <AppButton
                        mode="contained"
                        onPress={handleSave}
                        loading={loading}
                        style={styles.saveButton}
                    >
                        Save {type === 'SALE' ? 'Sale' : 'Purchase'}
                    </AppButton>

                    {isEditMode && paymentMode === 'CREDIT' && Math.max(totals.total - Number(paidAmountInput || 0), 0) > 0 && (
                        <View style={styles.shareRow}>
                            <AppButton
                                mode="contained-tonal"
                                onPress={() => void handleShareReminder('whatsapp')}
                                icon="whatsapp"
                                style={[styles.actionBtn, styles.flexBtn]}
                                buttonColor="#25D366" // Optional brand coloring
                                textColor="#FFF"
                            >
                                WhatsApp Reminder
                            </AppButton>
                            <AppButton
                                mode="contained-tonal"
                                onPress={() => void handleShareReminder('sms')}
                                icon="message-text-outline"
                                style={[styles.actionBtn, styles.flexBtn]}
                            >
                                SMS Reminder
                            </AppButton>
                        </View>
                    )}
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
    sectionCard: {
        marginBottom: DesignSystem.spacing.xs,
        padding: 0,
        overflow: 'hidden',
    },
    accordionHeader: {
        backgroundColor: 'transparent',
    },
    accordionContent: {
        paddingHorizontal: DesignSystem.spacing.md,
        paddingBottom: DesignSystem.spacing.md,
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
    shareRow: {
        flexDirection: 'row',
        gap: DesignSystem.spacing.md,
        width: '100%',
        marginTop: DesignSystem.spacing.md,
    },
    actionBtn: {
        marginBottom: DesignSystem.spacing.md,
    },
    flexBtn: {
        flex: 1,
    }
});
