
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Text, Searchbar, Divider, useTheme, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
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

export const BillingScreen = () => {
    const { allItems, fetchItems } = useStock();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const theme = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams<{ search?: string | string[] }>();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);

    const {
        items: cart,
        total,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        customerName,
        customerPhone,
        setCustomerDetails,
    } = useCartStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [checkoutLoading, setCheckoutLoading] = useState(false);

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
        if (!normalizedQuery) return [];

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
        if (qtyInCart >= item.stock) {
            Alert.alert(BILLING_TEXT.outOfStockTitle, BILLING_TEXT.outOfStockBody(item.name, item.stock));
            return;
        }
        addItem(item);
        setSearchQuery('');
    };

    const renderCartItem = useCallback(({ item }: { item: (typeof cart)[number] }) => (
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
                </View>
                <View style={styles.qtyControls}>
                    <IconButton
                        icon="minus-circle-outline"
                        size={20}
                        onPress={() => updateQuantity(item.id, -1)}
                        accessibilityLabel="Decrease quantity"
                    />
                    <Text variant="labelLarge" style={styles.qtyValue}>
                        {item.quantity}
                    </Text>
                    <IconButton
                        icon="plus-circle-outline"
                        size={20}
                        onPress={() => {
                            const stockItem = stockById.get(item.id);
                            if (stockItem && item.quantity >= stockItem.stock) {
                                Alert.alert(BILLING_TEXT.outOfStockTitle, BILLING_TEXT.outOfStockBody(item.name, stockItem.stock));
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
    ), [activeCurrency, removeItem, stockById, theme.colors.error, theme.colors.outline, updateQuantity]);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (!user) return;

        for (const line of cart) {
            const stockItem = allItems.find((item) => item.id === line.id);
            if (!stockItem) {
                Alert.alert(BILLING_TEXT.itemMissingTitle, BILLING_TEXT.itemMissingBody(line.name));
                return;
            }
            if (line.quantity > stockItem.stock) {
                Alert.alert(
                    BILLING_TEXT.insufficientStockTitle,
                    BILLING_TEXT.insufficientStockBody(line.name, stockItem.stock)
                );
                return;
            }
        }

        setCheckoutLoading(true);
        try {
            const billData = {
                userId: user.uid,
                customerName: customerName.trim() || undefined,
                customerPhone: customerPhone.trim() || undefined,
                businessName: user.businessName || undefined,
                businessAddress: user.address || undefined,
                gstNumber: user.gstNumber || undefined,
                currency: activeCurrency,
                items: cart,
                total,
            };

            const billId = await billService.createBillWithStockValidation(billData);
            await fetchItems();

            Alert.alert(
                BILLING_TEXT.billCreatedTitle,
                BILLING_TEXT.billCreatedPrompt,
                [
                    { text: COMMON_TEXT.actions.cancel, onPress: () => clearCart() },
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
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : BILLING_TEXT.checkoutFailed);
        } finally {
            setCheckoutLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.container}>
                <AppCard style={{ backgroundColor: theme.colors.primaryContainer }}>
                    <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.onPrimaryContainer }}>
                        Create Bill
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                        Scan or search products, then checkout in one tap.
                    </Text>
                </AppCard>

                <Searchbar
                    placeholder={BILLING_TEXT.searchPlaceholder}
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchbar}
                    right={(props) => (
                        <IconButton
                            iconColor={props.color}
                            style={props.style}
                            size={20}
                            icon="barcode-scan"
                            onPress={() => router.push({ pathname: '/scan', params: { target: 'billing' } })}
                        />
                    )}
                />

                <AppCard>
                    <Text variant="titleSmall" style={styles.sectionTitle}>
                        Customer Details
                    </Text>
                    <AppInput
                        label={BILLING_TEXT.customerName}
                        value={customerName}
                        onChangeText={(value) => setCustomerDetails(value, customerPhone)}
                        style={styles.customerInput}
                    />
                    <AppInput
                        label={BILLING_TEXT.customerPhone}
                        value={customerPhone}
                        onChangeText={(value) => setCustomerDetails(customerName, value)}
                        keyboardType="phone-pad"
                    />
                </AppCard>

                {searchQuery.length > 0 && (
                    <AppCard style={[styles.searchResultCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                        <Text variant="labelMedium" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                            Product matches
                        </Text>
                        {filteredItems.length === 0 ? (
                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                {`No matching item for "${searchQuery.trim()}".`}
                            </Text>
                        ) : (
                            <FlatList
                                data={filteredItems}
                                keyExtractor={(item) => item.id}
                                keyboardShouldPersistTaps="handled"
                                initialNumToRender={10}
                                maxToRenderPerBatch={10}
                                windowSize={5}
                                ItemSeparatorComponent={() => <Divider />}
                                renderItem={({ item }) => (
                                    <AppButton
                                        mode="text"
                                        onPress={() => handleAddItem(item)}
                                        contentStyle={styles.searchItemButtonContent}
                                    >
                                        {item.name} | {formatCurrency(item.price, activeCurrency)} ({item.stock} {BILLING_TEXT.inStockSuffix})
                                    </AppButton>
                                )}
                            />
                        )}
                    </AppCard>
                )}

                <View style={styles.cartHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        {BILLING_TEXT.currentBillTitle}
                    </Text>
                    {cart.length > 0 && (
                        <AppButton mode="text" compact onPress={clearCart}>
                            Clear
                        </AppButton>
                    )}
                </View>

                <FlatList
                    data={cart}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCartItem}
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    windowSize={7}
                    removeClippedSubviews
                    contentContainerStyle={styles.cartListContent}
                    ListEmptyComponent={(
                        <AppCard style={styles.emptyCard}>
                            <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center' }}>
                                Add products to start building the bill.
                            </Text>
                        </AppCard>
                    )}
                />
            </View>

            <AppCard
                style={[styles.checkoutCard, { backgroundColor: theme.colors.primaryContainer }]}
                contentStyle={styles.checkoutContent}
            >
                <View>
                    <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                        {BILLING_TEXT.totalLabel}
                    </Text>
                    <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.onPrimaryContainer }}>
                        {formatCurrency(total, activeCurrency)}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                        {cart.length} item(s)
                    </Text>
                </View>
                <AppButton
                    mode="contained"
                    onPress={handleCheckout}
                    loading={checkoutLoading}
                    disabled={cart.length === 0}
                >
                    {BILLING_TEXT.checkoutButton}
                </AppButton>
            </AppCard>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    searchbar: {
        marginBottom: 10,
    },
    sectionTitle: {
        fontWeight: '700',
    },
    customerInput: {
        marginBottom: 8,
    },
    searchResultCard: {
        maxHeight: 220,
    },
    searchItemButtonContent: {
        justifyContent: 'flex-start',
    },
    cartHeader: {
        marginTop: 2,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cartListContent: {
        paddingBottom: 12,
    },
    cartItemCard: {
        marginBottom: 8,
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
        minWidth: 18,
        textAlign: 'center',
    },
    emptyCard: {
        marginTop: 8,
    },
    checkoutCard: {
        marginBottom: 72,
    },
    checkoutContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});
