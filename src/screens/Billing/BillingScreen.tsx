import React, { useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { AppCard } from '../../components/common/AppCard';
import { useStock } from '../../hooks/useStock';
import { useAuth } from '../../hooks/useAuth';
import { useCartStore } from '../../store/cartStore';
import { useSettingsStore } from '../../store';
import { Config } from '../../constants/Config';
import { normalizeCurrencyCode } from '../../utils/formatters';

import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { billRepository } from '../../repositories/billRepository';
import { randomUUID } from 'expo-crypto';
import type { NewDbTransaction } from '../../types/db';
import { BILLING_TEXT } from '../../constants/staticText';
import { billingCheckoutSchema } from '../../validation/forms';
import { useShallow } from 'zustand/react/shallow';
import { useRouter } from 'expo-router';
import { BillingCart } from './components/BillingCart';
import { BillingCatalog } from './components/BillingCatalog';

export const BillingScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 900;
    const router = useRouter();
    // Hooks
    const { allItems, fetchItems } = useStock();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const { canOpenBilling } = useOrganizationAccess();
    const dialog = useAppDialog();

    // Store
    const {
        items: cart,
        clearCart,
        addItem,
        transactionType,
        isGstBill,
        customerName,
        billNumber,
    } = useCartStore(useShallow((state) => ({
        items: state.items,
        clearCart: state.clearCart,
        addItem: state.addItem,
        transactionType: state.transactionType,
        isGstBill: state.isGstBill,
        customerName: state.customerName,
        billNumber: state.billNumber,
    })));

    // Local State
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [sameAsBilling, setSameAsBilling] = useState(true);
    const [billingAddress, setBillingAddress] = useState(user?.address || '');
    const [deliveryAddress, setDeliveryAddress] = useState('');

    // Sync delivery with billing if requested
    const effectiveDeliveryAddress = sameAsBilling ? billingAddress : deliveryAddress;

    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);

    // Derived State
    const stockById = useMemo(() => {
        const map = new Map<string, typeof allItems[0]>();
        allItems.forEach(item => map.set(item.id, item));
        return map;
    }, [allItems]);

    // Handlers
    const handleAddItem = (item: typeof allItems[0]) => {
        // Stock check
        if (transactionType === 'SALE') {
            const currentStock = item.stock;
            // Count already in cart
            const inCart = cart.find(c => c.id === item.id)?.quantity || 0;
            if (inCart >= currentStock) {
                dialog.alert(BILLING_TEXT.outOfStockTitle, BILLING_TEXT.outOfStockBody(item.name, currentStock));
                return;
            }
        }
        addItem(item);
    };

    const handleCheckout = async () => {
        if (!user) return;
        if (cart.length === 0) return;

        setCheckoutLoading(true);
        try {
            // 1. Validation
            const normalizedBillNumber = billNumber?.trim() || `INV-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
            const validation = billingCheckoutSchema.safeParse({
                billNumber: normalizedBillNumber,
                customerName: customerName || 'Walk-in Customer',
                customerPhone: '0000000000'
            });

            if (!validation.success) {
            // Allow loose validation? currently swallowing error or using defaults
            }

            // 2. Availability Check
            const available = await billRepository.checkBillNumberAvailability(normalizedBillNumber, user.uid);
            if (!available) {
                dialog.alert('Duplicate Bill Number', 'Please choose a unique bill number.');
                setCheckoutLoading(false);
                return;
            }

            // 3. Prepare Payload
            const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
            const taxTotal = isGstBill ? cart.reduce((sum, i) => sum + (i.price * i.quantity * (i.tax || 0)) / 100, 0) : 0;
            const total = subtotal + taxTotal;

            const newBillId = randomUUID();
            const now = new Date().toISOString();

            const dbPayload: NewDbTransaction = {
                id: newBillId,
                organizationId: user.uid,
                type: transactionType,
                billNumber: normalizedBillNumber,
                billDate: now,
                itemsSnapshot: JSON.stringify(cart),
                totalAmount: total,
                discountAmount: 0,
                taxAmount: taxTotal,
                paidAmount: 0,
                paymentMode: 'CASH',
                paymentStatus: 'PENDING',
                billMode: isGstBill ? 'GST' : 'ESTIMATE',
                partyName: customerName || 'Walk-in',
                billingAddress: billingAddress,
                deliveryAddress: effectiveDeliveryAddress,
                currency: activeCurrency,
                createdAt: now,
                updatedAt: now,
            };

            await billRepository.create(dbPayload);
            await fetchItems(); // Update stock locally

            clearCart();
            // Navigate to Success Screen instead of just alert
            // dialog.alert('Success', 'Bill created successfully!');
           
            router.push({ pathname: '/bill-success', params: { id: newBillId } });

        } catch (e: unknown) {
            dialog.alert('Error', e instanceof Error ? e.message : 'Checkout failed');
        } finally {
            setCheckoutLoading(false);
        }
    };

    if (!canOpenBilling) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Access Denied</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <PageHeaderCard
                title="Billing"
                subtitle={transactionType === 'SALE' ? 'New Sale' : 'Purchase Entry'}
            />

            <View style={{ flex: 1 }}>
                {isWide ? (
                    // ── Wide: side-by-side layout ─────────────────────────────────
                    <View key="billing-wide" style={styles.containerWide}>
                        <View style={{ flex: 0.6, marginRight: 16 }}>
                            <AppCard style={{ flex: 1, backgroundColor: theme.colors.elevation.level1 }} contentStyle={{ padding: 0 }}>
                                <View style={{ padding: 16, paddingBottom: 0 }}>
                                    <Text variant="titleMedium" style={{ marginBottom: 12, fontWeight: 'bold' }}>
                                        Scan / Select Items
                                    </Text>
                                </View>
                                <BillingCatalog
                                    items={allItems}
                                    onAddItem={handleAddItem}
                                    stockMap={stockById}
                                    currencySymbol={activeCurrency}
                                    transactionType={transactionType}
                                />
                            </AppCard>
                        </View>
                        <View style={{ flex: 0.4 }}>
                            <AppCard style={{ flex: 1, borderColor: theme.colors.outlineVariant, borderWidth: 1 }}>
                                <BillingCart
                                    currencySymbol={currencySymbol}
                                    activeCurrency={activeCurrency}
                                    onCheckout={handleCheckout}
                                    checkoutLoading={checkoutLoading}
                                    transactionType={transactionType}
                                    stockMap={stockById}
                                    isGstBill={isGstBill}
                                    sameAsBilling={sameAsBilling}
                                    setSameAsBilling={setSameAsBilling}
                                    billingAddress={billingAddress}
                                    setBillingAddress={setBillingAddress}
                                    deliveryAddress={deliveryAddress}
                                    setDeliveryAddress={setDeliveryAddress}
                                />
                            </AppCard>
                        </View>
                    </View>
                ) : (
                    // ── Mobile: stacked layout ────────────────────────────────────
                    <View key="billing-mobile" style={{ flex: 1 }}>
                        {/* Catalog section */}
                        <View style={{ flex: 1, marginBottom: 16 }}>
                            <AppCard
                                style={{ flex: 1, backgroundColor: theme.colors.elevation.level1 }}
                                contentStyle={{ padding: 0, flex: 1 }}
                            >
                                <View style={{ padding: 16, paddingBottom: 0 }}>
                                    <Text variant="titleMedium" style={{ marginBottom: 12, fontWeight: 'bold' }}>
                                        Scan / Select Items
                                    </Text>
                                </View>
                                <BillingCatalog
                                    items={allItems}
                                    onAddItem={handleAddItem}
                                    stockMap={stockById}
                                    currencySymbol={activeCurrency}
                                    transactionType={transactionType}
                                />
                                </AppCard>
                            </View>

                            {/* Cart section */}
                            <View style={{ flex: 1 }}>
                                <AppCard
                                    style={{ flex: 1, borderColor: theme.colors.outlineVariant, borderWidth: 1 }}
                                    contentStyle={{ flex: 1 }}
                                >
                                    <BillingCart
                                        currencySymbol={currencySymbol}
                                        activeCurrency={activeCurrency}
                                        onCheckout={handleCheckout}
                                        checkoutLoading={checkoutLoading}
                                        transactionType={transactionType}
                                        stockMap={stockById}
                                        isGstBill={isGstBill}
                                        sameAsBilling={sameAsBilling}
                                        setSameAsBilling={setSameAsBilling}
                                        billingAddress={billingAddress}
                                        setBillingAddress={setBillingAddress}
                                        deliveryAddress={deliveryAddress}
                                        setDeliveryAddress={setDeliveryAddress}
                                    />
                                </AppCard>
                            </View>
                    </View>
                )}
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    containerWide: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'stretch',
    },
});
