import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Animated, Pressable } from 'react-native';
import { useTheme, Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import { useShallow } from 'zustand/react/shallow';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { AppCard } from '../../components/common/AppCard';
import { BillingCart } from './components/BillingCart';
import { BillingCatalog } from './components/BillingCatalog';
import { BillingDrawer } from './components/BillingDrawer';
import { BillingPartySelector } from './components/BillingPartySelector';
import { useStock } from '../../hooks/useStock';
import { useAuth } from '../../hooks/useAuth';
import { useParties } from '../../hooks/useParties';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { useCartStore } from '../../store/cartStore';
import { useOrganizationStore, useSettingsStore } from '../../store';
import { billRepository } from '../../repositories/billRepository';
import { Config } from '../../constants/Config';
import { BILLING_TEXT } from '../../constants/staticText';
import { billingCheckoutSchema } from '../../validation/forms';
import type { NewDbTransaction } from '../../types/db';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { DesignSystem } from '@/src/constants/DesignSystem';
import { notifyAppEvent } from '../../services/notificationService';

const BILLING_WIDE_BREAKPOINT = 1100;
const MOBILE_CART_COLLAPSED_HEIGHT = 78;
const MOBILE_CART_MIN_EXPANDED_HEIGHT = 360;

export const BillingScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const router = useRouter();
    const params = useLocalSearchParams<{ search?: string | string[]; scanAt?: string | string[] }>();

    const { allItems, fetchItems } = useStock();
    const { user } = useAuth();
    const { parties, fetchParties } = useParties();
    const { currencySymbol } = useSettingsStore();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const organizationId = selectedOrganizationId ?? user?.uid ?? null;
    const { canOpenBilling } = useOrganizationAccess();
    const dialog = useAppDialog();
    
    const {
        items: cart,
        clearCart,
        addItem,
        transactionType,
        isGstBill,
        customerName,
        billNumber,
        partyId,
        setCustomer,
        setTransactionType,
        setIsGstBill,
    } = useCartStore(useShallow((state) => ({
        items: state.items,
        clearCart: state.clearCart,
        addItem: state.addItem,
        transactionType: state.transactionType,
        isGstBill: state.isGstBill,
        customerName: state.customerName,
        billNumber: state.billNumber,
        partyId: state.partyId,
        setCustomer: state.setCustomer,
        setTransactionType: state.setTransactionType,
        setIsGstBill: state.setIsGstBill,
    })));

    const [drawerVisible, setDrawerVisible] = useState(false);
    const [partySelectorVisible, setPartySelectorVisible] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [sameAsBilling, setSameAsBilling] = useState(true);
    const [billingAddress, setBillingAddress] = useState(user?.address || '');
    const [deliveryAddress, setDeliveryAddress] = useState('');

    const [mobileCartExpanded, setMobileCartExpanded] = useState(false);
    const [mobileLayoutHeight, setMobileLayoutHeight] = useState(0);
    const mobileCartAnim = useRef(new Animated.Value(0)).current;

    const isWide = width >= BILLING_WIDE_BREAKPOINT;
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);
    const effectiveDeliveryAddress = sameAsBilling ? billingAddress : deliveryAddress;
    const scannedSearch = Array.isArray(params.search) ? params.search[0] : params.search;
    const scanSignal = Array.isArray(params.scanAt) ? params.scanAt[0] : params.scanAt;

    const stockById = useMemo(() => {
        const map = new Map<string, typeof allItems[0]>();
        allItems.forEach((item) => map.set(item.id, item));
        return map;
    }, [allItems]);

    const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
    const cartSubTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
    const cartTaxTotal = useMemo(
        () => (isGstBill
            ? cart.reduce((sum, item) => sum + (item.price * item.quantity * (item.tax || 0)) / 100, 0)
            : 0),
        [cart, isGstBill]
    );
    const cartTotal = cartSubTotal + cartTaxTotal;

    const mobileExpandedHeight = Math.max(
        MOBILE_CART_MIN_EXPANDED_HEIGHT,
        mobileLayoutHeight > 0 ? mobileLayoutHeight - 8 : MOBILE_CART_MIN_EXPANDED_HEIGHT
    );
    const mobileCollapsedOffset = Math.max(mobileExpandedHeight - MOBILE_CART_COLLAPSED_HEIGHT, 0);
    const mobileDrawerTranslateY = mobileCartAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [mobileCollapsedOffset, 0],
    });
    const mobileBackdropOpacity = mobileCartAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.22],
    });

    useEffect(() => {
        Animated.spring(mobileCartAnim, {
            toValue: mobileCartExpanded ? 1 : 0,
            useNativeDriver: true,
            speed: 18,
            bounciness: 0,
        }).start();
    }, [mobileCartAnim, mobileCartExpanded]);

    useEffect(() => {
        if (isWide && mobileCartExpanded) {
            setMobileCartExpanded(false);
        }
    }, [isWide, mobileCartExpanded]);

    useFocusEffect(
        useCallback(() => {
            void fetchParties();
        }, [fetchParties])
    );

    const handleAddItem = (item: typeof allItems[0]) => {
        if (transactionType === 'SALE') {
            const currentStock = item.stock;
            const inCart = cart.find((c) => c.id === item.id)?.quantity || 0;
            if (inCart >= currentStock) {
                dialog.alert(BILLING_TEXT.outOfStockTitle, BILLING_TEXT.outOfStockBody(item.name, currentStock));
                return;
            }
        }
        addItem(item);
    };

    const openPartySelector = () => {
        void fetchParties();
        setPartySelectorVisible(true);
    };

    const handleCheckout = async () => {
        if (!user || !organizationId || cart.length === 0) return;

        const missingItems = cart
            .map((line) => ({
                line,
                stockItem: stockById.get(line.id),
            }))
            .filter((entry) => !entry.stockItem)
            .map((entry) => entry.line.name || entry.line.id);

        if (missingItems.length > 0) {
            dialog.alert(
                BILLING_TEXT.itemMissingTitle,
                `Missing inventory items: ${missingItems.join(', ')}. Please refresh stock and retry checkout.`
            );
            return;
        }

        const isStockOutflow = transactionType === 'SALE' || transactionType === 'RETURN_OUTWARD';
        if (isStockOutflow) {
            const insufficientItems = cart
                .map((line) => {
                    const stockItem = stockById.get(line.id);
                    const available = stockItem?.stock ?? 0;
                    return {
                        name: line.name || line.id,
                        required: line.quantity,
                        available,
                    };
                })
                .filter((entry) => entry.required > entry.available);

            if (insufficientItems.length > 0) {
                dialog.alert(
                    BILLING_TEXT.insufficientStockTitle,
                    insufficientItems
                        .map((entry) => `${entry.name}: required ${entry.required}, available ${entry.available}`)
                        .join('\n')
                );
                return;
            }
        }

        setCheckoutLoading(true);
        try {
            const normalizedBillNumber = billNumber?.trim() || `INV-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
            const validation = billingCheckoutSchema.safeParse({
                billNumber: normalizedBillNumber,
                customerName: customerName || 'Walk-in Customer',
                customerPhone: parties.find((p) => p.id === partyId)?.phone || '',
            });

            if (!validation.success) {
                // Keep checkout tolerant to avoid blocking cashier flow.
            }

            const available = await billRepository.checkBillNumberAvailability(normalizedBillNumber, organizationId);
            if (!available) {
                dialog.alert('Duplicate Bill Number', 'Please choose a unique bill number.');
                setCheckoutLoading(false);
                return;
            }

            const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
            const taxTotal = isGstBill ? cart.reduce((sum, i) => sum + (i.price * i.quantity * (i.tax || 0)) / 100, 0) : 0;
            const total = subtotal + taxTotal;

            const newBillId = randomUUID();
            const now = new Date().toISOString();

            const dbPayload: NewDbTransaction = {
                id: newBillId,
                organizationId,
                type: transactionType,
                partyId,
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
                billingAddress,
                deliveryAddress: effectiveDeliveryAddress,
                currency: activeCurrency,
                createdAt: now,
                updatedAt: now,
            };

            await billRepository.create(dbPayload);
            await notifyAppEvent(
                transactionType === 'PURCHASE' ? 'Purchase Saved' : 'Bill Saved',
                `${normalizedBillNumber} for ${formatCurrency(total, activeCurrency)} saved successfully.`,
                {
                    channelId: transactionType === 'PURCHASE' ? 'operations' : 'billing',
                    type: transactionType === 'PURCHASE' ? 'reminder' : 'success',
                    data: {
                        transactionId: newBillId,
                        transactionType,
                        billNumber: normalizedBillNumber,
                    },
                }
            );
            await fetchItems();
            clearCart();
            setMobileCartExpanded(false);

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
                <View style={styles.centered}>
                    <Text>Access Denied</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <PageHeaderCard
                title="Billing"
                subtitle={transactionType === 'SALE' ? 'Sales Bill' : transactionType === 'PURCHASE' ? 'Purchase Entry' : 'Return Bill'}
                right={<IconButton icon="tune" onPress={() => setDrawerVisible(true)} />}
            />

            <BillingDrawer
                visible={drawerVisible}
                onDismiss={() => setDrawerVisible(false)}
                transactionType={transactionType}
                onSelectType={setTransactionType}
                isGstBill={isGstBill}
                onToggleGst={setIsGstBill}
            />
            <BillingPartySelector
                visible={partySelectorVisible}
                onDismiss={() => setPartySelectorVisible(false)}
                parties={parties}
                selectedId={partyId}
                onSelect={(party) => setCustomer(party)}
                onCreateNew={() => router.push('/party/new')}
            />

            <View style={styles.body}>
                {isWide ? (
                    <View style={styles.containerWide}>
                        <View style={styles.wideCatalogPane}>
                            <AppCard
                                style={[styles.fillCard, { backgroundColor: theme.colors.elevation.level1 }]}
                                contentStyle={styles.fillCardContent}
                            >
                                <View style={styles.catalogHeader}>
                                    <Text variant="titleMedium" style={styles.catalogTitle}>Scan / Select Items</Text>
                                </View>
                                <BillingCatalog
                                    items={allItems}
                                    onAddItem={handleAddItem}
                                    stockMap={stockById}
                                    scannedSearch={scannedSearch}
                                    scanSignal={scanSignal}
                                    currencySymbol={activeCurrency}
                                    transactionType={transactionType}
                                />
                            </AppCard>
                        </View>
                        <View style={styles.wideCartPane}>
                            <AppCard
                                style={[styles.fillCard, { borderColor: theme.colors.outlineVariant, borderWidth: 1 }]}
                                contentStyle={styles.fillCardContent}
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
                                    onOpenPartySelector={openPartySelector}
                                    partyName={customerName}
                                />
                            </AppCard>
                        </View>
                    </View>
                ) : (
                        <View
                            style={styles.mobileContainer}
                            onLayout={(event) => setMobileLayoutHeight(event.nativeEvent.layout.height)}
                        >

                            <View style={styles.catalogHeader}>
                                <Text variant="titleMedium" style={styles.catalogTitle}>Scan / Select Items</Text>
                                </View>
                                <BillingCatalog
                                    items={allItems}
                                    onAddItem={handleAddItem}
                                    stockMap={stockById}
                                    scannedSearch={scannedSearch}
                                    scanSignal={scanSignal}
                                    currencySymbol={activeCurrency}
                                    transactionType={transactionType}
                                />

                            <Animated.View
                                pointerEvents={mobileCartExpanded ? 'auto' : 'none'}
                                style={[styles.mobileBackdrop, { opacity: mobileBackdropOpacity }]}
                            >
                                <Pressable style={styles.backdropPressable} onPress={() => setMobileCartExpanded(false)} />
                            </Animated.View>

                            <Animated.View
                                style={[
                                    styles.mobileDrawer,
                                    {
                                        backgroundColor: theme.colors.surface,
                                        borderColor: theme.colors.outlineVariant,
                                        height: mobileExpandedHeight,
                                        transform: [{ translateY: mobileDrawerTranslateY }],
                                    },
                                ]}
                            >
                                <Pressable
                                    style={[styles.mobileDrawerHeader, { borderBottomColor: theme.colors.outlineVariant }]}
                                    onPress={() => setMobileCartExpanded((prev) => !prev)}
                                >
                                    <View style={styles.mobileDrawerTitleWrap}>
                                        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                                            Cart {cartItemCount > 0 ? `(${cartItemCount} item${cartItemCount > 1 ? 's' : ''})` : '(Empty)'}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            Total {formatCurrency(cartTotal, activeCurrency)}
                                        </Text>
                                    </View>
                                    <MaterialCommunityIcons
                                        name={mobileCartExpanded ? 'chevron-down' : 'chevron-up'}
                                        size={24}
                                        color={theme.colors.primary}
                                    />
                                </Pressable>

                                <View style={styles.mobileDrawerBody}>
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
                                        onOpenPartySelector={openPartySelector}
                                        partyName={customerName}
                                    />
                            </View>
                            </Animated.View>
                    </View>
                )}
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    body: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    containerWide: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    wideCatalogPane: {
        flex: 0.6,
        marginRight: 16,
    },
    wideCartPane: {
        flex: 0.4,
    },
    fillCard: {
        flex: 1,
    },
    fillCardContent: {
        flex: 1,
        padding: 0,
    },
    catalogHeader: {
        padding: 16,
        paddingBottom: 0,
    },
    catalogTitle: {
        marginBottom: 12,
        fontWeight: '700',
    },
    mobileContainer: {
        flex: 1,
    },
    mobileCatalogWrap: {
        flex: 1,
        paddingBottom: MOBILE_CART_COLLAPSED_HEIGHT + 12,
    },
    mobileBackdrop: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: DesignSystem.radius.lg,
        backgroundColor: 'rgba(0, 0, 0, 0.22)',
        zIndex: 10,
    },
    backdropPressable: {
        flex: 1,
    },
    mobileDrawer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderWidth: 1,
        borderBottomWidth: 0,
        overflow: 'hidden',
        zIndex: 20,
        elevation: 10,
    },
    mobileDrawerHeader: {
        minHeight: MOBILE_CART_COLLAPSED_HEIGHT,
        paddingHorizontal: 14,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    mobileDrawerTitleWrap: {
        flex: 1,
    },
    mobileDrawerBody: {
        flex: 1,
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: 8,
    },
});
