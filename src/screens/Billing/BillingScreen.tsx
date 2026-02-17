
import React, { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useState, useTransition } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Searchbar, Divider, useTheme, IconButton, SegmentedButtons, Switch, TextInput, Chip } from 'react-native-paper';
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
import { getStockHealth, resolveLowStockThreshold } from '../../utils/stockStatus';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import type { BillItem } from '../../types';

type StockFilter = 'available' | 'low' | 'out' | 'all';

interface CartSummaryState {
    subtotal: number;
    taxTotal: number;
    grandTotal: number;
}

type CartSummaryAction = {
    type: 'recalculate';
    cart: BillItem[];
    isGstBill: boolean;
};

const computeCartSummary = (cart: BillItem[], isGstBill: boolean): CartSummaryState => {
    const subtotal = cart.reduce((sum, entry) => sum + (entry.price * entry.quantity), 0);
    const taxTotal = isGstBill
        ? cart.reduce((sum, entry) => {
            const lineTotal = entry.price * entry.quantity;
            return sum + ((lineTotal * Number(entry.tax ?? 0)) / 100);
        }, 0)
        : 0;

    return {
        subtotal,
        taxTotal,
        grandTotal: subtotal + taxTotal,
    };
};

const cartSummaryReducer = (_state: CartSummaryState, action: CartSummaryAction): CartSummaryState => {
    if (action.type === 'recalculate') {
        return computeCartSummary(action.cart, action.isGstBill);
    }
    return _state;
};

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
        canOpenBilling,
        canCreateSale,
        canCreatePurchase,
        canManageParties,
    } = useOrganizationAccess();

    const {
        items: cart,
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
    const [stockFilter, setStockFilter] = useState<StockFilter>('available');
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [searchPending, startSearchTransition] = useTransition();
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [cartSummary, dispatchCartSummary] = useReducer(
        cartSummaryReducer,
        computeCartSummary(cart, isGstBill)
    );

    useEffect(() => {
        const scannedSearch = Array.isArray(params.search) ? params.search[0] : params.search;
        if (scannedSearch) {
            setSearchQuery(scannedSearch);
        }
    }, [params.search]);

    useEffect(() => {
        if (transactionType === 'SALE' && !canCreateSale && canCreatePurchase) {
            setTransactionType('PURCHASE');
            return;
        }
        if (transactionType === 'PURCHASE' && !canCreatePurchase && canCreateSale) {
            setTransactionType('SALE');
            return;
        }
        setStockFilter(transactionType === 'SALE' ? 'available' : 'all');
    }, [canCreatePurchase, canCreateSale, setTransactionType, transactionType]);

    useFocusEffect(
        useCallback(() => {
            void fetchItems();
        }, [fetchItems])
    );

    const handleSearchChange = useCallback((value: string) => {
        startSearchTransition(() => {
            setSearchQuery(value);
        });
    }, [startSearchTransition]);

    useEffect(() => {
        dispatchCartSummary({
            type: 'recalculate',
            cart,
            isGstBill,
        });
    }, [cart, isGstBill]);

    const searchTerm = deferredSearchQuery.trim();
    const normalizedQuery = searchTerm.toLowerCase();

    const inventorySummary = useMemo(() => {
        const summary = {
            available: 0,
            low: 0,
            out: 0,
        };

        for (const item of allItems) {
            if (item.isActive === false) continue;
            const health = getStockHealth(item);
            if (health === 'out') {
                summary.out += 1;
                continue;
            }

            if (health === 'low') {
                summary.low += 1;
            }
            summary.available += 1;
        }

        return summary;
    }, [allItems]);

    const filteredItems = useMemo(() => {
        const base = allItems
            .filter((item) => item.isActive !== false)
            .filter((item) =>
                !normalizedQuery ||
                item.nameLowercase.includes(normalizedQuery) ||
                (item.barcode && item.barcode.includes(searchTerm))
            );

        const byStockFilter = base.filter((item) => {
            if (stockFilter === 'all') return true;
            if (stockFilter === 'available') return item.stock > 0;
            if (stockFilter === 'low') return getStockHealth(item) === 'low';
            return getStockHealth(item) === 'out';
        });

        const ranked = [...byStockFilter].sort((a, b) => {
            if (transactionType === 'SALE') {
                const rank = (health: ReturnType<typeof getStockHealth>) => {
                    if (health === 'in') return 0;
                    if (health === 'low') return 1;
                    return 2;
                };
                const delta = rank(getStockHealth(a)) - rank(getStockHealth(b));
                if (delta !== 0) return delta;
            }

            return a.nameLowercase.localeCompare(b.nameLowercase);
        });

        return ranked;
    }, [allItems, normalizedQuery, searchTerm, stockFilter, transactionType]);

    const canUseBilling = canOpenBilling && (canCreateSale || canCreatePurchase);

    const transactionTypeButtons = useMemo(() => {
        const buttons: { value: 'SALE' | 'PURCHASE'; label: string }[] = [];
        if (canCreateSale) {
            buttons.push({ value: 'SALE', label: 'Sale (Out)' });
        }
        if (canCreatePurchase) {
            buttons.push({ value: 'PURCHASE', label: 'Purchase (In)' });
        }
        return buttons;
    }, [canCreatePurchase, canCreateSale]);

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
        if (transactionType === 'SALE' && !canCreateSale) {
            dialog.alert('Access Denied', 'Sales billing is disabled for your role.');
            return;
        }
        if (transactionType === 'PURCHASE' && !canCreatePurchase) {
            dialog.alert('Access Denied', 'Purchase entry is disabled for your role.');
            return;
        }

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

            const adjustedTotal = cartSummary.grandTotal;
            const billMode: 'GST' | 'ESTIMATE' = isGstBill ? 'GST' : 'ESTIMATE';


            const billData = {
                userId: user.uid,
                type: transactionType,
                billMode,
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

    const renderCartItem = ({ item, index }: { item: (typeof cart)[number]; index: number }) => {
        const stockItem = stockById.get(item.id);
        const stockHealth = stockItem ? getStockHealth(stockItem) : null;
        const lowStockThreshold = stockItem ? resolveLowStockThreshold(stockItem) : 0;

        return (
            <AppCard style={styles.cartItemCard} animationDelay={Math.min(index * 18, 180)}>
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
                        {transactionType === 'SALE' && stockItem && stockHealth === 'low' && (
                            <Text variant="labelSmall" style={{ color: theme.colors.error, marginTop: 4 }}>
                                Low stock warning: {stockItem.stock} left (threshold {lowStockThreshold})
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
                                const stockEntry = stockById.get(item.id);
                                if (transactionType === 'SALE' && stockEntry && item.quantity >= stockEntry.stock) {
                                    dialog.alert(BILLING_TEXT.outOfStockTitle, BILLING_TEXT.outOfStockBody(item.name, stockEntry.stock));
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
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setBillDetails(selectedDate, billNumber);
        }
    };

    return (
        <ScreenWrapper>
            {!canUseBilling ? (
                <AppCard animationDelay={40}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Billing access is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Ask owner/admin to enable billing permissions for your staff account.
                    </Text>
                </AppCard>
            ) : (
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
            >
            <AppCard animationDelay={40} style={{ backgroundColor: theme.colors.primaryContainer, marginBottom: 16 }}>
                <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.onPrimaryContainer }}>
                    Create Bill
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                    {transactionType === 'SALE' ? 'New Sale' : 'Stock Purchase'}
                </Text>
                <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer, marginTop: 2 }}>
                    {isGstBill ? 'Mode: GST Bill' : 'Mode: Estimate / Rough'}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, marginTop: 6 }}>
                    Subtotal {formatCurrency(cartSummary.subtotal, activeCurrency)} | Tax {formatCurrency(cartSummary.taxTotal, activeCurrency)} | Total {formatCurrency(cartSummary.grandTotal, activeCurrency)}
                </Text>
                </AppCard>


                {/* Transaction Type */}
                {transactionTypeButtons.length > 1 && (
                    <SegmentedButtons
                        value={transactionType}
                        onValueChange={(value) => {
                            const next = value as 'SALE' | 'PURCHASE';
                            if (next === 'SALE' && !canCreateSale) return;
                            if (next === 'PURCHASE' && !canCreatePurchase) return;
                            setTransactionType(next);
                        }}
                        buttons={transactionTypeButtons}
                        style={{ marginBottom: 16 }}
                    />
                )}
                {transactionTypeButtons.length === 1 && (
                    <Text variant="bodySmall" style={{ marginBottom: 12, color: theme.colors.outline }}>
                        {transactionTypeButtons[0].label} mode active for your account.
                    </Text>
                )}

                <SegmentedButtons
                    value={isGstBill ? 'GST' : 'ESTIMATE'}
                    onValueChange={(value) => setIsGstBill(value === 'GST')}
                    buttons={[
                        { value: 'GST', label: 'GST Bill' },
                        { value: 'ESTIMATE', label: 'Estimate / Rough' },
                    ]}
                    style={{ marginBottom: 16 }}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                        <Searchbar
                            placeholder={BILLING_TEXT.searchPlaceholder}
                            onChangeText={handleSearchChange}
                            value={searchQuery}
                            elevation={1}
                            style={{ backgroundColor: theme.colors.elevation.level1 }}
                        />
                        {searchPending && (
                            <Text variant="labelSmall" style={{ marginTop: 4, color: theme.colors.outline }}>
                                Updating search...
                            </Text>
                        )}
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

                <AppCard animationDelay={70} style={[styles.searchResultCard, { backgroundColor: theme.colors.elevation.level2, marginBottom: 16 }]}>
                    <View style={styles.catalogHeaderRow}>
                        <Text variant="titleSmall" style={styles.sectionTitle}>
                            Item Catalog
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                            {inventorySummary.available} in stock | {inventorySummary.low} low | {inventorySummary.out} out
                        </Text>
                    </View>
                    <View style={styles.filterRow}>
                        <Chip
                            compact
                            selected={stockFilter === 'available'}
                            onPress={() => setStockFilter('available')}
                            mode={stockFilter === 'available' ? 'flat' : 'outlined'}
                        >
                            Available ({inventorySummary.available})
                        </Chip>
                        <Chip
                            compact
                            selected={stockFilter === 'low'}
                            onPress={() => setStockFilter('low')}
                            mode={stockFilter === 'low' ? 'flat' : 'outlined'}
                        >
                            Low ({inventorySummary.low})
                        </Chip>
                        <Chip
                            compact
                            selected={stockFilter === 'out'}
                            onPress={() => setStockFilter('out')}
                            mode={stockFilter === 'out' ? 'flat' : 'outlined'}
                        >
                            Out ({inventorySummary.out})
                        </Chip>
                        <Chip
                            compact
                            selected={stockFilter === 'all'}
                            onPress={() => setStockFilter('all')}
                            mode={stockFilter === 'all' ? 'flat' : 'outlined'}
                        >
                            All ({inventorySummary.available + inventorySummary.out})
                        </Chip>
                    </View>

                    {filteredItems.length === 0 ? (
                        <Text style={{ paddingVertical: 12, textAlign: 'center', color: theme.colors.outline }}>
                            No items match this filter.
                        </Text>
                    ) : (
                        filteredItems.map((item, index) => {
                            const stockHealth = getStockHealth(item);
                            const lowStockThreshold = resolveLowStockThreshold(item);
                            const cannotSell = transactionType === 'SALE' && item.stock <= 0;

                            return (
                                <View key={item.id}>
                                    <View style={styles.searchItemRow}>
                                        <View style={styles.searchItemInfo}>
                                            <Text variant="titleSmall" style={styles.searchItemName}>
                                                {item.name}
                                            </Text>
                                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                                {formatCurrency(item.price, activeCurrency)} | Stock: {item.stock}
                                            </Text>
                                            {stockHealth === 'low' && (
                                                <Text variant="labelSmall" style={{ color: theme.colors.error, marginTop: 2 }}>
                                                    Low stock warning (threshold {lowStockThreshold})
                                                </Text>
                                            )}
                                            {stockHealth === 'out' && transactionType === 'SALE' && (
                                                <Text variant="labelSmall" style={{ color: theme.colors.error, marginTop: 2 }}>
                                                    Out of stock for sale
                                                </Text>
                                            )}
                                        </View>
                                        <AppButton
                                            compact
                                            mode="contained-tonal"
                                            onPress={() => handleAddItem(item)}
                                            disabled={cannotSell}
                                        >
                                            Add
                                        </AppButton>
                                    </View>
                                    {index !== filteredItems.length - 1 && <Divider style={styles.itemDivider} />}
                                </View>
                            );
                        })
                    )}
                </AppCard>

                {/* Bill Details */}
                <AppCard animationDelay={95} style={{ marginBottom: 16 }}>
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
                    <Text variant="bodySmall" style={{ marginTop: 8, color: theme.colors.outline }}>
                        {isGstBill
                            ? 'GST mode includes tax in calculations and reports.'
                            : 'Estimate mode excludes tax from this bill.'}
                    </Text>
                </AppCard>

                {/* Customer Details */}
                <AppCard animationDelay={120} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text variant="titleSmall" style={styles.sectionTitle}>
                            {transactionType === 'PURCHASE' ? 'Supplier' : 'Customer'}
                        </Text>
                        <AppButton
                            mode="text"
                            compact
                            onPress={() => router.push({ pathname: '/party', params: { mode: 'select' } })}
                            disabled={!canManageParties}
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
                    <AppCard animationDelay={145} style={styles.emptyCard}>
                        <View style={{ alignItems: 'center', padding: 20 }}>
                            <IconButton icon="cart-outline" size={48} iconColor={theme.colors.outline} />
                            <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center' }}>
                                Your cart is empty.
                            </Text>
                        </View>
                    </AppCard>
                ) : (
                    <View>
                        {cart.map((item, index) => (
                            <View key={item.id} style={{ marginBottom: 8 }}>
                                {renderCartItem({ item, index })}
                            </View>
                        ))}
                    </View>
                )}

                <AppCard
                    animationDelay={170}
                    style={[
                        styles.checkoutCard,
                        {
                            backgroundColor: theme.colors.primaryContainer,
                            borderColor: theme.colors.primary,
                        },
                    ]}
                    contentStyle={styles.checkoutContent}
                >
                    <View>
                        <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                            Total Amount
                        </Text>
                        <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: theme.colors.onPrimaryContainer }}>
                            {formatCurrency(cartSummary.grandTotal, activeCurrency)}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>
                            {isGstBill ? `Includes tax ${formatCurrency(cartSummary.taxTotal, activeCurrency)}` : 'Tax excluded'}
                        </Text>
                    </View>
                    <AppButton
                        mode="contained"
                        onPress={handleCheckout}
                        loading={checkoutLoading}
                        disabled={cart.length === 0 || (transactionType === 'SALE' ? !canCreateSale : !canCreatePurchase)}
                        icon="check"
                        contentStyle={{ paddingHorizontal: 16 }}
                    >
                        Checkout
                    </AppButton>
                </AppCard>
            </ScrollView>
            )}
        </ScreenWrapper>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 24,
    },
    sectionTitle: {
        fontWeight: '700',
    },
    searchResultCard: {
        overflow: 'hidden',
    },
    catalogHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    searchItemRow: {
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchItemInfo: {
        flex: 1,
        marginRight: 10,
    },
    searchItemName: {
        fontWeight: '600',
    },
    itemDivider: {
        marginBottom: 2,
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
        marginTop: 8,
        borderWidth: 1,
        elevation: 3,
    },
    checkoutContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
});
