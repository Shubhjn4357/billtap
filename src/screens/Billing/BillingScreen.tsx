
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, Alert } from 'react-native';
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
        <AppCard style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                    <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>{item.name}</Text>
                    <Text variant="bodyMedium">{formatCurrency(item.price, activeCurrency)} x {item.quantity}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AppButton mode="text" onPress={() => updateQuantity(item.id, -1)} compact>-</AppButton>
                    <Text>{item.quantity}</Text>
                    <AppButton
                        mode="text"
                        onPress={() => {
                            const stockItem = stockById.get(item.id);
                            if (stockItem && item.quantity >= stockItem.stock) {
                                Alert.alert(BILLING_TEXT.outOfStockTitle, BILLING_TEXT.outOfStockBody(item.name, stockItem.stock));
                                return;
                            }
                            updateQuantity(item.id, 1);
                        }}
                        compact
                    >
                        +
                    </AppButton>
                    <AppButton
                        mode="text"
                        onPress={() => removeItem(item.id)}
                        textColor={theme.colors.error}
                        compact
                        icon="delete"
                        accessibilityLabel="Remove item"
                    >
                        {' '}
                    </AppButton>
                </View>
            </View>
        </AppCard>
    ), [activeCurrency, removeItem, stockById, theme.colors.error, updateQuantity]);

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
            <View style={{ paddingVertical: 10 }}>
                <Searchbar
                    placeholder={BILLING_TEXT.searchPlaceholder}
                    onChangeText={setSearchQuery}
                    value={searchQuery}
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
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
                <AppInput
                    label={BILLING_TEXT.customerName}
                    value={customerName}
                    onChangeText={(value) => setCustomerDetails(value, customerPhone)}
                    style={{ flex: 1 }}
                />
                <AppInput
                    label={BILLING_TEXT.customerPhone}
                    value={customerPhone}
                    onChangeText={(value) => setCustomerDetails(customerName, value)}
                    keyboardType="phone-pad"
                    style={{ flex: 1 }}
                />
            </View>

            {searchQuery.length > 0 && (
                <View style={{ maxHeight: 200, backgroundColor: theme.colors.elevation.level1, borderRadius: 8, marginBottom: 10 }}>
                    <FlatList
                        data={filteredItems}
                        keyExtractor={i => i.id}
                        keyboardShouldPersistTaps="handled"
                        initialNumToRender={10}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        renderItem={({ item }) => (
                            <AppButton
                                mode="text"
                                onPress={() => handleAddItem(item)}
                                contentStyle={{ justifyContent: 'flex-start' }}
                            >
                                {item.name} - {formatCurrency(item.price, activeCurrency)} ({item.stock} {BILLING_TEXT.inStockSuffix})
                            </AppButton>
                        )}
                    />
                </View>
            )}

            <Divider style={{ marginVertical: 10 }} />

            <View style={{ flex: 1 }}>
                <Text variant="titleMedium" style={{ marginBottom: 10 }}>{BILLING_TEXT.currentBillTitle}</Text>
                <FlatList
                    data={cart}
                    keyExtractor={i => i.id}
                    renderItem={renderCartItem}
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    windowSize={7}
                    removeClippedSubviews
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            </View>

            <View style={{
                position: 'absolute',
                bottom: 80,
                left: 16,
                right: 16,
                backgroundColor: theme.colors.primaryContainer,
                padding: 16,
                borderRadius: 16,
                elevation: 4,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <View>
                    <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>{BILLING_TEXT.totalLabel}</Text>
                    <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.onPrimaryContainer }}>
                        {formatCurrency(total, activeCurrency)}
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
            </View>
        </ScreenWrapper>
    );
};
