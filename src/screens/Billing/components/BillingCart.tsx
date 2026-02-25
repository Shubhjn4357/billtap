import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { AppButton } from '../../../components/common/AppButton';
import { AppCard } from '../../../components/common/AppCard';
import { AppDateField } from '../../../components/common/AppDateField';
import { AppInput } from '../../../components/common/AppInput';
import { AppAccordion } from '../../../components/common/AppAccordion';
import { useCartStore } from '../../../store/cartStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCurrency } from '../../../utils/formatters';
import { DesignSystem } from '../../../constants/DesignSystem';
import { Item, TransactionType } from '../../../types';

interface BillingCartProps {
    currencySymbol: string;
    onCheckout: () => void;
    checkoutLoading: boolean;
    activeCurrency: string;
    isGstBill: boolean;
    stockMap: Map<string, Item>;
    transactionType: TransactionType;
    billDate: Date;
    setBillDate: (value: Date) => void;
    dueDate?: Date;
    setDueDate: (value: Date | undefined) => void;
    discountInput: string;
    setDiscountInput: (value: string) => void;
    discountAmount: number;
    sameAsBilling: boolean;
    setSameAsBilling: (val: boolean) => void;
    billingAddress: string;
    setBillingAddress: (val: string) => void;
    deliveryAddress: string;
    setDeliveryAddress: (val: string) => void;
    onOpenPartySelector: () => void;
    partyName?: string;
}

export const BillingCart = ({
    onCheckout,
    checkoutLoading,
    activeCurrency,
    isGstBill,
    stockMap,
    transactionType,
    billDate,
    setBillDate,
    dueDate,
    setDueDate,
    discountInput,
    setDiscountInput,
    discountAmount,
    sameAsBilling,
    setSameAsBilling,
    billingAddress,
    setBillingAddress,
    deliveryAddress,
    setDeliveryAddress,
    onOpenPartySelector,
    partyName,
}: BillingCartProps) => {
    const theme = useTheme();
    const [addressExpanded, setAddressExpanded] = useState(false);
    const [billControlsExpanded, setBillControlsExpanded] = useState(false);
    const { items, updateQuantity, removeItem, clearCart } = useCartStore(
        useShallow((state) => ({
            items: state.items,
            updateQuantity: state.updateQuantity,
            removeItem: state.removeItem,
            clearCart: state.clearCart,
        }))
    );

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxTotal = isGstBill
        ? items.reduce((sum, item) => sum + (item.price * item.quantity * (item.tax || 0)) / 100, 0)
        : 0;
    const baseTotal = subtotal + taxTotal;
    const total = Math.max(baseTotal - discountAmount, 0);
    const isInboundFlow = transactionType === 'PURCHASE' || transactionType === 'RETURN_INWARD';
    const primaryAddressLabel = isInboundFlow ? 'From Address (Party)' : 'Billing Address';
    const primaryAddressPlaceholder = isInboundFlow ? 'Enter supplier/party address...' : 'Enter business location...';
    const secondaryAddressLabel = isInboundFlow ? 'To Address (Business)' : 'Delivery Address';
    const secondaryAddressPlaceholder = isInboundFlow ? 'Where goods are received?' : 'Where should items be sent?';
    const sameAddressLabel = isInboundFlow
        ? 'To address is same as from address'
        : 'Delivery is same as billing address';
    const dueDateEnabled = Boolean(dueDate);

    if (items.length === 0) {
        return (
            <AppCard style={styles.emptyCartCard} mode="outlined">
                <View style={styles.emptyRow}>
                    <IconButton icon="cart-outline" size={48} iconColor={theme.colors.outline} />
                    <View style={styles.emptyTextWrap}>
                        <Text variant="bodyLarge" style={{ color: theme.colors.outline, marginTop: 8 }}>
                            Cart is empty
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outlineVariant }}>
                            Scan or select items to start billing
                        </Text>
                    </View>
                </View>
            </AppCard>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                        {transactionType === 'SALE' ? 'Sales Bill' : transactionType === 'PURCHASE' ? 'Purchase Bill' : 'Return Bill'}
                        {isGstBill ? ' (GST)' : ' (Estimate)'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flexShrink: 1 }} numberOfLines={1}>
                            Party: {partyName || 'Walk-in'}
                        </Text>
                        <AppButton mode="text" compact onPress={onOpenPartySelector} style={{ marginLeft: 4 }} labelStyle={{ fontSize: 12 }}>
                            Change
                        </AppButton>
                    </View>
                </View>
                <AppButton
                    mode="text"
                    compact
                    textColor={theme.colors.error}
                    onPress={clearCart}
                >
                    Clear
                </AppButton>
            </View>

            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 16 }}>
                {items.map((item) => {
                    const stockItem = stockMap.get(item.id);
                    const stock = stockItem?.stock ?? 0;
                    const isLowStock = transactionType === 'SALE' && stockItem && stock <= (stockItem.lowStockThreshold ?? 5);

                    return (
                        <View key={item.id} style={[styles.itemRow, { borderBottomColor: theme.colors.elevation.level3 }]}>
                            <View style={styles.itemInfo}>
                                <Text variant="bodyMedium" style={styles.itemName} numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>
                                    {formatCurrency(item.price, activeCurrency)} x {item.quantity}
                                    {isGstBill && item.tax ? ` (+${item.tax}%)` : ''}
                                </Text>
                                {isLowStock && (
                                    <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                                        Low Stock: {stock}
                                    </Text>
                                )}
                            </View>

                            <View style={styles.qtyControls}>
                                <IconButton
                                    icon="minus"
                                    size={16}
                                    mode="contained-tonal"
                                    onPress={() => updateQuantity(item.id, -1)}
                                    style={styles.qtyBtn}
                                />
                                <Text variant="bodyMedium" style={{ marginHorizontal: 8, minWidth: 20, textAlign: 'center' }}>
                                    {item.quantity}
                                </Text>
                                <IconButton
                                    icon="plus"
                                    size={16}
                                    mode="contained-tonal"
                                    onPress={() => updateQuantity(item.id, 1)}
                                    style={styles.qtyBtn}
                                />
                            </View>

                            <Text variant="bodyMedium" style={styles.itemTotal}>
                                {formatCurrency(item.price * item.quantity, activeCurrency)}
                            </Text>

                            <IconButton
                                icon="close"
                                size={14}
                                iconColor={theme.colors.outline}
                                onPress={() => removeItem(item.id)}
                            />
                        </View>
                    );
                })}
            </ScrollView>

            <View style={[styles.footer, { backgroundColor: theme.colors.elevation.level2 }]}>
                <View style={styles.deliverySection}>
                    <AppAccordion
                        title="Bill Controls"
                        icon="calendar-edit-outline"
                        expanded={billControlsExpanded}
                        onExpandedChange={setBillControlsExpanded}
                        containerStyle={[styles.addressAccordion, { backgroundColor: theme.colors.elevation.level1 }]}
                        contentStyle={styles.addressAccordionBody}
                        titleStyle={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}
                    >
                        <AppDateField
                            label="Bill Date"
                            value={billDate}
                            onChange={setBillDate}
                            maximumDate={new Date()}
                        />
                        <View style={styles.dueDateToggleRow}>
                            <IconButton
                                icon={dueDateEnabled ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                size={20}
                                onPress={() => {
                                    if (dueDateEnabled) {
                                        setDueDate(undefined);
                                        return;
                                    }
                                    const defaultDueDate = new Date(billDate);
                                    defaultDueDate.setDate(defaultDueDate.getDate() + 7);
                                    setDueDate(defaultDueDate);
                                }}
                                iconColor={theme.colors.primary}
                                style={{ margin: 0, paddingLeft: 0 }}
                            />
                            <Text
                                variant="bodySmall"
                                onPress={() => {
                                    if (dueDateEnabled) {
                                        setDueDate(undefined);
                                        return;
                                    }
                                    const defaultDueDate = new Date(billDate);
                                    defaultDueDate.setDate(defaultDueDate.getDate() + 7);
                                    setDueDate(defaultDueDate);
                                }}
                                style={{ color: theme.colors.outline }}
                            >
                                Enable due date (for credit/reminder)
                            </Text>
                        </View>
                        {dueDateEnabled ? (
                            <AppDateField
                                label="Due Date"
                                value={dueDate}
                                onChange={setDueDate}
                                minimumDate={billDate}
                            />
                        ) : null}
                        <AppInput
                            label="Bill Discount"
                            placeholder="0"
                            value={discountInput}
                            onChangeText={(value) => setDiscountInput(value.replace(/[^0-9.]/g, ''))}
                            inputType="decimal"
                        />
                    </AppAccordion>
                </View>

                <View style={styles.deliverySection}>
                    <AppAccordion
                        title="Addresses"
                        icon="map-marker-outline"
                        expanded={addressExpanded}
                        onExpandedChange={setAddressExpanded}
                        containerStyle={[styles.addressAccordion, { backgroundColor: theme.colors.elevation.level1 }]}
                        contentStyle={styles.addressAccordionBody}
                        titleStyle={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}
                    >
                        <View style={styles.addressInputContainer}>
                            <AppInput
                                label={primaryAddressLabel}
                                placeholder={primaryAddressPlaceholder}
                                value={billingAddress}
                                onChangeText={setBillingAddress}
                                inputType="text"
                                multiline
                                numberOfLines={2}
                            />
                        </View>

                        {!isInboundFlow ? (
                            <View style={styles.checkboxRow}>
                                <IconButton
                                    icon={sameAsBilling ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                    size={20}
                                    onPress={() => setSameAsBilling(!sameAsBilling)}
                                    iconColor={theme.colors.primary}
                                    style={{ margin: 0, paddingLeft: 0 }}
                                />
                                <Text
                                    variant="bodySmall"
                                    onPress={() => setSameAsBilling(!sameAsBilling)}
                                    style={{ color: theme.colors.outline }}
                                >
                                    {sameAddressLabel}
                                </Text>
                            </View>
                        ) : null}

                        {!sameAsBilling || isInboundFlow ? (
                            <View style={styles.addressInputContainer}>
                                <AppInput
                                    label={secondaryAddressLabel}
                                    placeholder={secondaryAddressPlaceholder}
                                    value={deliveryAddress}
                                    onChangeText={setDeliveryAddress}
                                    inputType="text"
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>
                        ) : null}
                    </AppAccordion>
                </View>

                <View style={styles.summaryRow}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Subtotal</Text>
                    <Text variant="bodyMedium">{formatCurrency(subtotal, activeCurrency)}</Text>
                </View>
                {isGstBill && (
                    <View style={styles.summaryRow}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Tax (GST)</Text>
                        <Text variant="bodyMedium">{formatCurrency(taxTotal, activeCurrency)}</Text>
                    </View>
                )}
                {discountAmount > 0 ? (
                    <View style={styles.summaryRow}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Discount</Text>
                        <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                            -{formatCurrency(discountAmount, activeCurrency)}
                        </Text>
                    </View>
                ) : null}
                <View style={[styles.summaryRow, { marginTop: 8 }]}>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Total</Text>
                    <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                        {formatCurrency(total, activeCurrency)}
                    </Text>
                </View>

                <AppButton
                    mode="contained"
                    style={{ marginTop: 16 }}
                    onPress={onCheckout}
                    loading={checkoutLoading}
                    contentStyle={{ height: 48 }}
                >
                    Checkout - {formatCurrency(total, activeCurrency)}
                </AppButton>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
    },
    emptyCartCard: {
        padding: DesignSystem.spacing.xl,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        backgroundColor: 'transparent',
    },
    emptyRow: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    emptyTextWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: DesignSystem.spacing.sm,
        paddingHorizontal: DesignSystem.spacing.xs,
    },
    list: {
        flex: 1,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    itemInfo: {
        flex: 1,
        marginRight: 8,
    },
    itemName: {
        fontWeight: '500',
    },
    qtyControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    qtyBtn: {
        margin: 0,
        height: 28,
        width: 28,
    },
    itemTotal: {
        fontWeight: 'bold',
        marginLeft: 8,
        minWidth: 60,
        textAlign: 'right',
    },
    footer: {
        marginTop: 16,
        padding: 16,
        borderRadius: DesignSystem.radius.md,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    deliverySection: {
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    addressAccordion: {
        paddingHorizontal: 0,
    },
    addressAccordionBody: {
        paddingHorizontal: DesignSystem.spacing.xs,
        paddingTop: DesignSystem.spacing.xs,
        paddingBottom: DesignSystem.spacing.sm,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    addressInputContainer: {
        marginTop: 4,
    },
    dueDateToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
});
