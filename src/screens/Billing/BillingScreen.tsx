
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Searchbar, Divider, useTheme, IconButton, SegmentedButtons, Switch, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { useStock } from '../../hooks/useStock';
import { useAuth } from '../../hooks/useAuth';
import { useCartStore } from '../../store/cartStore';
import { useSettingsStore } from '../../store';
import { Config } from '../../constants/Config';
import { BILLING_TEXT, COMMON_TEXT } from '../../constants/staticText';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { billService } from '../../api/billService';
import { shareBillPDF } from '../../utils/pdfGenerator';
import { useAppDialog } from '../../components/providers/DialogProvider';
export const BillingScreen = () => {
    const { allItems, fetchItems } = useStock();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const theme = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams<{ search?: string | string[] }>();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);
    const dialog = useAppDialog();

    const {
        items: cart,
        total,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        customerName,
        customerPhone,
        partyId,
        customerGst,
        customerAddress,
        transactionType,
        billNumber,
        billDate,
        isGstBill,
        setCustomerDetails,
        setCustomer,
        setTransactionType,
        setBillDetails,
        setIsGstBill,
    } = useCartStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        const scannedSearch = Array.isArray(params.search) ? params.search[0] : params.search;
        if (scannedSearch) {
            setSearchQuery(scannedSearch);
        }
    }, [params.search]);

    useFocusEffect(
        useCallback(() => {
            void fetchItems();
        }, [fetchItems])
    );

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredItems = useMemo(() => {
        if (!normalizedQuery) {
            return allItems.slice(0, 5);
        }

        return allItems
            .filter((item) =>
                item.nameLowercase.includes(normalizedQuery) ||
                (item.barcode && item.barcode.includes(searchQuery.trim()))
            )
            .slice(0, 20);
    }, [allItems, normalizedQuery, searchQuery]);

    const stockById = useMemo(() => {
        const entries = allItems.map((item) => [item.id, item] as const);
        return new Map(entries);
    }, [allItems]);

    const getCartQuantity = (itemId: string) =>
        cart.find((entry) => entry.id === itemId)?.quantity ?? 0;

    const handleAddItem = (item: (typeof allItems)[number]) => {
        const qtyInCart = getCartQuantity(item.id);
        const currentStock = item.stock;

        // For SALES, check stock. For PURCHASES, we ignore stock limits for adding.
        if (transactionType === 'SALE' && qtyInCart >= currentStock) {
            dialog.alert(BILLING_TEXT.outOfStockTitle, BILLING_TEXT.outOfStockBody(item.name, currentStock));
            return;
        }

        // Use logic regarding GST bill or not? 
        // Logic handled in calculation, adding item is same.
        addItem(item);
        setSearchQuery('');
    };

    const handleBarcodeSubmit = () => {
        const code = barcodeInput.trim();
        if (!code) return;

        const item = allItems.find(i => i.barcode === code);
        if (item) {
            handleAddItem(item);
            setBarcodeInput('');
        } else {
            dialog.alert('Item Not Found', `No item found with barcode: ${code}`);
        }
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (!user) return;

        for (const line of cart) {
            if (transactionType === 'SALE') {
                const stockItem = allItems.find((item) => item.id === line.id);
                if (!stockItem) {
                    dialog.alert(BILLING_TEXT.itemMissingTitle, BILLING_TEXT.itemMissingBody(line.name));
                    return;
                }
                if (line.quantity > stockItem.stock) {
                    dialog.alert(
                        BILLING_TEXT.insufficientStockTitle,
                        BILLING_TEXT.insufficientStockBody(line.name, stockItem.stock)
                    );
                    return;
                }
            }
        }

        setCheckoutLoading(true);
        try {
            // Recalculate tax based on isGstBill flag
            const itemsWithTaxAdjusted = cart.map(item => ({
                ...item,
                tax: isGstBill ? item.tax : 0,
                // total is re-calculated in backend/service usually, but let's be safe
            }));

            // Re-calculate total
            const adjustedTotal = itemsWithTaxAdjusted.reduce((sum, item) => {
                const lineTotal = item.price * item.quantity; // Pre-tax subtotal
                const taxAmount = (lineTotal * (item.tax || 0)) / 100;
                return sum + lineTotal + taxAmount;
            }, 0);


            const billData = {
                userId: user.uid,
                type: transactionType,
                partyId: partyId,
                customerName: customerName.trim() || undefined,
                customerPhone: customerPhone.trim() || undefined,
                businessName: user.businessName || undefined,
                businessAddress: user.address || undefined,
                gstNumber: user.gstNumber || undefined,
                currency: activeCurrency,
                billNumber: billNumber,
                billDate: billDate,
                items: itemsWithTaxAdjusted,
                total: adjustedTotal,
            };

            const billId = await billService.createBillWithStockValidation(billData);
            await fetchItems();

            dialog.alert(
                BILLING_TEXT.billCreatedTitle,
                BILLING_TEXT.billCreatedPrompt,
                [
                    { text: COMMON_TEXT.actions.cancel, onPress: () => clearCart(), style: 'cancel' },
                    {
                        text: BILLING_TEXT.sharePdfButton,
                        onPress: async () => {
                            try {
                                await shareBillPDF({ ...billData, id: billId, createdAt: new Date() });
                            } finally {
                                clearCart();
                            }
                        }
                    }
                ]
            );
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : BILLING_TEXT.checkoutFailed);
        } finally {
            setCheckoutLoading(false);
        }
    };

    const renderCartItem = ({ item }: { item: (typeof cart)[number] }) => (
        <AppCard style={styles.cartItemCard}>
            <View style={styles.cartItemRow}>
                <View style={styles.cartItemInfo}>
                    <Text variant="bodyLarge" style={styles.cartItemName}>
                        {item.name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        {formatCurrency(item.price, activeCurrency)} x {item.quantity} ={' '}
                        {formatCurrency(item.price * item.quantity, activeCurrency)}
                    </Text>
                    {!isGstBill && (
                        <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>
                            (Tax Exempt)
                        </Text>
                    )}
                </View>
                <View style={styles.qtyControls}>
                    <IconButton
                        icon="minus-circle-outline"
                        size={24}
                        onPress={() => updateQuantity(item.id, -1)}
                        accessibilityLabel="Decrease quantity"
                    />
                    <Text variant="titleMedium" style={styles.qtyValue}>
                        {item.quantity}
                    </Text>
                    <IconButton
                        icon="plus-circle-outline"
                        size={24}
                        onPress={() => {
                            const stockItem = stockById.get(item.id);
                            if (transactionType === 'SALE' && stockItem && item.quantity >= stockItem.stock) {
                                dialog.alert(BILLING_TEXT.outOfStockTitle, BILLING_TEXT.outOfStockBody(item.name, stockItem.stock));
                                return;
                            }
                            updateQuantity(item.id, 1);
                        }}
                        accessibilityLabel="Increase quantity"
                    />
                    <IconButton
                        icon="trash-can-outline"
                        size={20}
                        iconColor={theme.colors.error}
                        onPress={() => removeItem(item.id)}
                        accessibilityLabel="Remove item"
                    />
                </View>
            </View>
        </AppCard>
    );

    const onDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setBillDetails(selectedDate, billNumber);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
            >
                <AppCard style={{ backgroundColor: theme.colors.primaryContainer, marginBottom: 16 }}>
                    <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.onPrimaryContainer }}>
                        Create Bill
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                        {transactionType === 'SALE' ? 'New Sale' : 'Stock Purchase'}
                    </Text>
                </AppCard>


                {/* Transaction Type */}
                <SegmentedButtons
                    value={transactionType}
                    onValueChange={val => setTransactionType(val as 'SALE' | 'PURCHASE')}
                    buttons={[
                        { value: 'SALE', label: 'Sale (Out)' },
                        { value: 'PURCHASE', label: 'Purchase (In)' },
                    ]}
                    style={{ marginBottom: 16 }}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                        <Searchbar
                            placeholder={BILLING_TEXT.searchPlaceholder}
                            onChangeText={setSearchQuery}
                            value={searchQuery}
                            elevation={1}
                            style={{ backgroundColor: theme.colors.elevation.level1 }}
                        />
                    </View>
                    <View style={{ width: 60 }}>
                        <IconButton
                            icon="barcode-scan"
                            mode="contained"
                            size={28}
                            onPress={() => router.push({ pathname: '/scan', params: { target: 'billing' } })}
                        />
                    </View>
                </View>

                {/* Quick Barcode Input for Hardware Scanners */}
                <View style={{ marginBottom: 16 }}>
                    <TextInput
                        label="Scan Barcode (Enter)"
                        value={barcodeInput}
                        onChangeText={setBarcodeInput}
                        onSubmitEditing={handleBarcodeSubmit}
                        mode="outlined"
                        right={<TextInput.Icon icon="arrow-right-circle" onPress={handleBarcodeSubmit} />}
                        placeholder="Type or scan barcode..."
                    />
                </View>

                {/* Search Results */}
                {searchQuery.length > 0 && (
                    <AppCard style={[styles.searchResultCard, { backgroundColor: theme.colors.elevation.level2, marginBottom: 16 }]}>
                        {filteredItems.length === 0 ? (
                            <Text style={{ padding: 16, textAlign: 'center', color: theme.colors.outline }}>No items found.</Text>
                        ) : (
                                filteredItems.map(item => (
                                    <View key={item.id}>
                                    <AppButton
                                        mode="text"
                                        onPress={() => handleAddItem(item)}
                                        contentStyle={styles.searchItemButtonContent}
                                    >
                                            {item.name} | {formatCurrency(item.price, activeCurrency)} ({item.stock})
                                    </AppButton>
                                        <Divider />
                                    </View>
                                ))
                        )}
                    </AppCard>
                )}

                {/* Bill Details */}
                <AppCard style={{ marginBottom: 16 }}>
                    <Text variant="titleSmall" style={[styles.sectionTitle, { marginBottom: 12 }]}>Bill Details</Text>

                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                        <View style={{ flex: 1 }}>
                            <AppInput
                                label="Bill No."
                                value={billNumber || ''}
                                onChangeText={val => setBillDetails(billDate, val)}
                                placeholder="Auto"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppButton
                                mode="outlined"
                                onPress={() => setShowDatePicker(true)}
                                style={{ marginTop: 6 }}
                                contentStyle={{ height: 50, justifyContent: 'flex-start' }}
                                icon="calendar"
                            >
                                {billDate ? billDate.toLocaleDateString() : 'Today'}
                            </AppButton>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={billDate || new Date()}
                                    mode="date"
                                    display="default"
                                    onChange={onDateChange}
                                />
                            )}
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text variant="bodyMedium">Apply GST / Tax</Text>
                        <Switch value={isGstBill} onValueChange={setIsGstBill} />
                    </View>
                </AppCard>

                {/* Customer Details */}
                <AppCard style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text variant="titleSmall" style={styles.sectionTitle}>
                            {transactionType === 'PURCHASE' ? 'Supplier' : 'Customer'}
                        </Text>
                        <AppButton
                            mode="text"
                            compact
                            onPress={() => router.push({ pathname: '/party', params: { mode: 'select' } })}
                        >
                            Select
                        </AppButton>
                    </View>

                    {partyId ? (
                        <View style={{ backgroundColor: theme.colors.surfaceVariant, padding: 12, borderRadius: 8 }}>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{customerName}</Text>
                            <Text variant="bodyMedium">{customerPhone}</Text>
                            {!!customerGst && <Text variant="bodySmall">GST: {customerGst}</Text>}
                            {!!customerAddress && <Text variant="bodySmall">{customerAddress}</Text>}
                            <AppButton
                                mode="text"
                                compact
                                onPress={() => setCustomer(null)}
                                style={{ alignSelf: 'flex-end', marginTop: -10 }}
                            >
                                Remove
                            </AppButton>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <AppInput
                                    label="Name"
                                    value={customerName}
                                    onChangeText={(value) => setCustomerDetails(value, customerPhone)}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <AppInput
                                    label="Phone"
                                    value={customerPhone}
                                    onChangeText={(value) => setCustomerDetails(customerName, value)}
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>
                    )}
                </AppCard>

                {/* Cart Items */}
                <View style={styles.cartHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Items ({cart.length})
                    </Text>
                    {cart.length > 0 && (
                        <AppButton mode="text" compact onPress={clearCart} textColor={theme.colors.error}>
                            Clear All
                        </AppButton>
                    )}
                </View>

                {cart.length === 0 ? (
                    <AppCard style={styles.emptyCard}>
                        <View style={{ alignItems: 'center', padding: 20 }}>
                            <IconButton icon="cart-outline" size={48} iconColor={theme.colors.outline} />
                            <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center' }}>
                                Your cart is empty.
                            </Text>
                        </View>
                    </AppCard>
                ) : (
                    <View>
                        {cart.map((item) => (
                            <View key={item.id} style={{ marginBottom: 8 }}>
                                {renderCartItem({ item })}
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Sticky Checkout Footer */}
            <AppCard
                style={[styles.checkoutCard, { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary }]}
                contentStyle={styles.checkoutContent}
            >
                <View>
                    <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                        Total Amount
                    </Text>
                    <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: theme.colors.onPrimaryContainer }}>
                        {formatCurrency(total, activeCurrency)}
                    </Text>
                    {!isGstBill && <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>Tax Excluded</Text>}
                </View>
                <AppButton
                    mode="contained"
                    onPress={handleCheckout}
                    loading={checkoutLoading}
                    disabled={cart.length === 0}
                    icon="check"
                    contentStyle={{ paddingHorizontal: 16 }}
                >
                    Checkout
                </AppButton>
            </AppCard>
        </ScreenWrapper>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 20,
    },
    searchbar: {
        marginBottom: 0,
    },
    sectionTitle: {
        fontWeight: '700',
    },
    customerInput: {
        marginBottom: 8,
    },
    searchResultCard: {
        maxHeight: 300,
        overflow: 'hidden',
    },
    searchItemButtonContent: {
        justifyContent: 'flex-start',
        paddingVertical: 4,
    },
    cartHeader: {
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cartListContent: {
        paddingBottom: 12,
    },
    cartItemCard: {
        marginBottom: 0,
    },
    cartItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cartItemInfo: {
        flex: 1,
        marginRight: 8,
    },
    cartItemName: {
        fontWeight: '700',
    },
    qtyControls: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    qtyValue: {
        minWidth: 24,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    emptyCard: {
        marginTop: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkoutCard: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 1,
        borderRadius: 0,
        elevation: 8,
    },
    checkoutContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
});
