
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { AppButton } from '../../../components/common/AppButton';
import { AppCard } from '../../../components/common/AppCard';
import { AppInput } from '../../../components/common/AppInput';
import { useCartStore } from '../../../store/cartStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCurrency } from '../../../utils/formatters';
import { DesignSystem } from '../../../constants/DesignSystem';
import { Item } from '../../../types';

interface BillingCartProps {
    currencySymbol: string;
    onCheckout: () => void;
    checkoutLoading: boolean;
    activeCurrency: string;
    isGstBill: boolean;
    stockMap: Map<string, Item>;
    transactionType: 'SALE' | 'PURCHASE';
    sameAsBilling: boolean;
    setSameAsBilling: (val: boolean) => void;
    deliveryAddress: string;
    setDeliveryAddress: (val: string) => void;
}

export const BillingCart = ({
    onCheckout,
    checkoutLoading,
    activeCurrency,
    isGstBill,
    stockMap,
    transactionType,
    sameAsBilling,
    setSameAsBilling,
    deliveryAddress,
    setDeliveryAddress,
}: BillingCartProps) => {
    const theme = useTheme();
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
    const total = subtotal + taxTotal;

    if (items.length === 0) {
        return (
            <AppCard style={styles.emptyCartCard}>
                <IconButton icon="cart-outline" size={48} iconColor={theme.colors.outline} />
                <Text variant="bodyLarge" style={{ color: theme.colors.outline, marginTop: 8 }}>
                    Cart is empty
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outlineVariant }}>
                    Scan or select items to start billing
                </Text>
            </AppCard>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Current Bill</Text>
                <AppButton
                    mode="text"
                    compact
                    textColor={theme.colors.error}
                    onPress={clearCart}
                >
                    Clear All
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
                {/* Delivery Address Section */}
                <View style={styles.deliverySection}>
                    <View style={styles.checkboxRow}>
                        <IconButton
                            icon={sameAsBilling ? "checkbox-marked" : "checkbox-blank-outline"}
                            size={20}
                            onPress={() => setSameAsBilling(!sameAsBilling)}
                            iconColor={theme.colors.primary}
                            style={{ margin: 0, padding: 0 }}
                        />
                        <Text variant="bodyMedium" onPress={() => setSameAsBilling(!sameAsBilling)} style={{ marginLeft: 4 }}>
                            Same as billing address
                        </Text>
                    </View>
                    {!sameAsBilling && (
                        <View style={styles.addressInputContainer}>
                            <AppInput
                                label="Delivery Address"
                                value={deliveryAddress}
                                onChangeText={setDeliveryAddress}
                                inputType="text"
                                multiline
                                numberOfLines={2}
                            />
                        </View>
                    )}
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
                    Checkout · {formatCurrency(total, activeCurrency)}
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
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200, // Reasonable height for empty state
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderStyle: 'dashed',
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
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    addressInputContainer: {
        marginTop: 4,
    },
});
