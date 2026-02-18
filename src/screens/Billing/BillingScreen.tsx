
import React, { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useState, useTransition } from 'react';
import { Image, Pressable, StyleSheet, View, ScrollView, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Text, useTheme, IconButton, Portal, SegmentedButtons, Surface, Switch, TextInput, Chip } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { AppSkeleton } from '../../components/common/AppSkeleton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { useStock } from '../../hooks/useStock';
import { useAuth } from '../../hooks/useAuth';
import { useCartStore } from '../../store/cartStore';
import { useOrganizationStore, useSettingsStore } from '../../store';
import { Config } from '../../constants/Config';
import { DesignSystem } from '../../constants/DesignSystem';
import { BILLING_TEXT, COMMON_TEXT } from '../../constants/staticText';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { billService } from '../../api/billService';
import { shareBillPDF } from '../../utils/pdfGenerator';
import { getStockHealth, resolveLowStockThreshold } from '../../utils/stockStatus';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import type { Bill, BillItem } from '../../types';
import { useShallow } from 'zustand/react/shallow';
import { MotionPresence, MotionView } from '../../components/motion/Motion';
import { transactionService } from '../../api/transactionService';
import { billingCheckoutSchema } from '../../validation/forms';
import { buildUpiPaymentUri, buildUpiQrImageUrl } from '../../utils/upi';

type StockFilter = 'available' | 'low' | 'out' | 'all';

const MAX_VISIBLE_CATALOG_ITEMS = 80;

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

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

type BillSharePayload = Omit<Bill, 'id' | 'createdAt'> & {
    id: string;
    createdAt: Date;
};

interface CheckoutResultState {
    paymentStatus: 'PAID' | 'PENDING';
    upiUri?: string;
    qrImageUrl?: string;
    bill: BillSharePayload;
}

export const BillingScreen = () => {
    const { allItems, loading: stockLoading, fetchItems } = useStock();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const organizationSettings = useOrganizationStore((state) => state.context.settings);
    const theme = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
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
    } = useCartStore(useShallow((state) => ({
        items: state.items,
        addItem: state.addItem,
        updateQuantity: state.updateQuantity,
        removeItem: state.removeItem,
        clearCart: state.clearCart,
        customerName: state.customerName,
        customerPhone: state.customerPhone,
        partyId: state.partyId,
        customerGst: state.customerGst,
        customerAddress: state.customerAddress,
        transactionType: state.transactionType,
        billNumber: state.billNumber,
        billDate: state.billDate,
        isGstBill: state.isGstBill,
        setCustomerDetails: state.setCustomerDetails,
        setCustomer: state.setCustomer,
        setTransactionType: state.setTransactionType,
        setBillDetails: state.setBillDetails,
        setIsGstBill: state.setIsGstBill,
    })));

    const [searchQuery, setSearchQuery] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [stockFilter, setStockFilter] = useState<StockFilter>('available');
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [paymentStatusLoading, setPaymentStatusLoading] = useState(false);
    const [checkoutResult, setCheckoutResult] = useState<CheckoutResultState | null>(null);
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

    useFocusRefresh(fetchItems, {
        enabled: canOpenBilling && (canCreateSale || canCreatePurchase),
        minIntervalMs: 10_000,
    });

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

    const visibleCatalogItems = useMemo(() => {
        return filteredItems.slice(0, MAX_VISIBLE_CATALOG_ITEMS);
    }, [filteredItems]);

    const hiddenCatalogCount = Math.max(0, filteredItems.length - visibleCatalogItems.length);

    const canUseBilling = canOpenBilling && (canCreateSale || canCreatePurchase);
    const useWideWorkspace = width >= 1080;
    const printTemplateMetadata = useMemo(() => {
        const settings = asRecord(organizationSettings);
        const customization = asRecord(settings.customization);
        const print = asRecord(settings.print);
        const payment = asRecord(settings.payment);
        const signatureImageUrl =
            typeof settings.signatureImageUrl === 'string'
                ? settings.signatureImageUrl
                : (typeof customization.signatureImageUrl === 'string' ? customization.signatureImageUrl : undefined);

        const printerType: 'STANDARD' | 'THERMAL' = print.printerType === 'THERMAL' ? 'THERMAL' : 'STANDARD';
        const resolvedPaperSizeRaw = typeof print.paperSize === 'string' ? print.paperSize.toUpperCase() : 'A4';
        const paperSize: 'A4' | 'A5' | '2INCH' | '3INCH' =
            resolvedPaperSizeRaw === 'A5'
                ? 'A5'
                : resolvedPaperSizeRaw === '2INCH'
                    ? '2INCH'
                    : resolvedPaperSizeRaw === '3INCH'
                        ? '3INCH'
                        : 'A4';

        return {
            templateKey: typeof customization.templateKey === 'string' ? customization.templateKey : undefined,
            acknowledgmentText: typeof customization.acknowledgmentText === 'string'
                ? customization.acknowledgmentText
                : undefined,
            footerText: typeof customization.footerText === 'string' ? customization.footerText : undefined,
            printerType,
            paperSize,
            upiId: typeof payment.upiId === 'string' ? payment.upiId : undefined,
            upiReceiverName: typeof payment.receiverName === 'string' ? payment.receiverName : undefined,
            qrImageDataUrl: typeof payment.qrImageDataUrl === 'string' ? payment.qrImageDataUrl : undefined,
            signatureImageUrl,
        };
    }, [organizationSettings]);

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

    const cartQtyById = useMemo(() => {
        const entries = cart.map((entry) => [entry.id, entry.quantity] as const);
        return new Map(entries);
    }, [cart]);

    const getCartQuantity = useCallback((itemId: string) => {
        return cartQtyById.get(itemId) ?? 0;
    }, [cartQtyById]);

    const canCheckout = useMemo(() => {
        if (cart.length === 0) return false;
        return transactionType === 'SALE' ? canCreateSale : canCreatePurchase;
    }, [canCreatePurchase, canCreateSale, cart.length, transactionType]);
    const qrSize = useMemo(() => {
        if (useWideWorkspace) {
            return Math.min(220, Math.max(170, Math.floor(width * 0.19)));
        }
        return Math.min(210, Math.max(148, Math.floor(width * 0.44)));
    }, [useWideWorkspace, width]);

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
            const normalizedBillNumber = billNumber?.trim()
                ? billNumber.trim()
                : `INV-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;
            const normalizedCustomerName = customerName.trim();
            const normalizedCustomerPhone = customerPhone.trim();
            const checkoutValidation = billingCheckoutSchema.safeParse({
                billNumber: normalizedBillNumber,
                customerName: normalizedCustomerName,
                customerPhone: normalizedCustomerPhone,
            });
            if (!checkoutValidation.success) {
                dialog.alert('Billing', checkoutValidation.error.issues[0]?.message || 'Please check bill details.');
                return;
            }

            const billNumberCheck = await transactionService.checkBillNumberAvailability(normalizedBillNumber);
            if (!billNumberCheck.available) {
                dialog.alert(
                    'Duplicate Bill Number',
                    `Bill number ${normalizedBillNumber} already exists. Use a unique bill number or settle the existing bill.`,
                    [
                        {
                            text: 'Open Settlements',
                            onPress: () => router.push('/transaction/settlements' as never),
                        },
                        {
                            text: COMMON_TEXT.actions.cancel,
                            style: 'cancel',
                        },
                    ]
                );
                return;
            }

            setBillDetails(billDate, normalizedBillNumber);

            // Recalculate tax based on isGstBill flag
            const itemsWithTaxAdjusted = cart.map(item => ({
                ...item,
                tax: isGstBill ? item.tax : 0,
                // total is re-calculated in backend/service usually, but let's be safe
            }));

            const adjustedTotal = cartSummary.grandTotal;
            const billMode: 'GST' | 'ESTIMATE' = isGstBill ? 'GST' : 'ESTIMATE';
            const upiPaymentUri = printTemplateMetadata.upiId
                ? buildUpiPaymentUri({
                    upiId: printTemplateMetadata.upiId,
                    amount: adjustedTotal,
                    payeeName: printTemplateMetadata.upiReceiverName ?? user.businessName ?? user.displayName ?? 'BillTap Merchant',
                    note: `Bill ${normalizedBillNumber}`,
                    transactionRef: normalizedBillNumber,
                    currency: activeCurrency,
                })
                : null;
            const dynamicQrImageUrl = upiPaymentUri
                ? buildUpiQrImageUrl(upiPaymentUri, 300)
                : printTemplateMetadata.qrImageDataUrl;


            const billData = {
                userId: user.uid,
                type: transactionType,
                billMode,
                partyId: partyId,
                customerName: normalizedCustomerName || undefined,
                customerPhone: normalizedCustomerPhone || undefined,
                customerAddress: customerAddress?.trim() || undefined,
                customerGstNumber: customerGst?.trim() || undefined,
                businessName: user.businessName || undefined,
                businessAddress: user.address || undefined,
                gstNumber: user.gstNumber || undefined,
                currency: activeCurrency,
                billNumber: normalizedBillNumber,
                billDate: billDate,
                items: itemsWithTaxAdjusted,
                total: adjustedTotal,
                ...printTemplateMetadata,
                upiId: printTemplateMetadata.upiId,
                qrImageDataUrl: dynamicQrImageUrl,
            };

            const billId = await billService.createBillWithStockValidation(billData);
            await fetchItems();
            const billForShare: BillSharePayload = {
                ...billData,
                id: billId,
                createdAt: new Date(),
            };
            clearCart();
            setCheckoutResult({
                bill: billForShare,
                paymentStatus: 'PENDING',
                upiUri: upiPaymentUri ?? undefined,
                qrImageUrl: dynamicQrImageUrl,
            });
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : BILLING_TEXT.checkoutFailed);
        } finally {
            setCheckoutLoading(false);
        }
    };

    const handleShareCreatedBill = useCallback(async () => {
        if (!checkoutResult) return;
        try {
            await shareBillPDF(checkoutResult.bill);
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to share bill.');
        }
    }, [checkoutResult, dialog]);

    const handlePaymentStatusChange = useCallback(async (nextStatus: 'PAID' | 'PENDING') => {
        if (!checkoutResult) return;
        setPaymentStatusLoading(true);
        try {
            await transactionService.updatePayment(checkoutResult.bill.id, {
                markAsPaid: nextStatus === 'PAID',
                paidAmount: nextStatus === 'PAID' ? checkoutResult.bill.total : 0,
            });
            setCheckoutResult((current) => (
                current
                    ? { ...current, paymentStatus: nextStatus }
                    : current
            ));
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to update payment status.');
        } finally {
            setPaymentStatusLoading(false);
        }
    }, [checkoutResult, dialog]);

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
            <View style={[styles.contentInner, useWideWorkspace && styles.contentInnerWide]}>
            <PageHeaderCard
                title="Billing Terminal"
                subtitle={transactionType === 'SALE' ? 'Create sale bills quickly' : 'Record stock purchases'}
                right={(
                    <View style={styles.headerActions}>
                        <AppButton mode="outlined" compact onPress={() => router.push('/transaction/settlements' as never)}>
                            Settlements
                        </AppButton>
                        {canManageParties && (
                            <AppButton mode="contained-tonal" compact onPress={() => router.push('/party')}>
                                Parties
                            </AppButton>
                        )}
                    </View>
                )}
            />
            <AppCard
                animationDelay={40}
                style={styles.heroCard}
            >
                <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.onSurface }}>
                    Create Bill
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {transactionType === 'SALE' ? 'New Sale' : 'Stock Purchase'}
                </Text>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                    {isGstBill ? 'Mode: GST Bill' : 'Mode: Estimate / Rough'}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                    Subtotal {formatCurrency(cartSummary.subtotal, activeCurrency)} | Tax {formatCurrency(cartSummary.taxTotal, activeCurrency)} | Total {formatCurrency(cartSummary.grandTotal, activeCurrency)}
                </Text>
                <View style={styles.heroChipRow}>
                    <Chip compact>{transactionType === 'SALE' ? 'Sales' : 'Purchase'}</Chip>
                    <Chip compact>{isGstBill ? 'GST Mode' : 'Estimate Mode'}</Chip>
                    <Chip compact>Items: {cart.length}</Chip>
                </View>
                </AppCard>

                <View style={[styles.workspaceGrid, useWideWorkspace && styles.workspaceGridWide]}>
                <View style={[styles.workspaceColumn, useWideWorkspace && styles.workspaceLeftColumn]}>

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
                <View style={[styles.searchRow, useWideWorkspace && styles.searchRowWide]}>
                    <View style={styles.searchInputWrap}>
                        <AppInput
                            label="Search Items"
                            placeholder={BILLING_TEXT.searchPlaceholder}
                            onChangeText={handleSearchChange}
                            value={searchQuery}
                            inputType="search"
                            style={styles.searchInput}
                        />
                        {searchPending && (
                            <Text variant="labelSmall" style={styles.searchPendingText}>
                                Updating search...
                            </Text>
                        )}
                    </View>
                    <View style={styles.scanButtonWrap}>
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
                    <AppInput
                        label="Scan Barcode (Enter)"
                        value={barcodeInput}
                        onChangeText={setBarcodeInput}
                        onSubmitEditing={() => { handleBarcodeSubmit(); }}
                        inputType="search"
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

                    {stockLoading && allItems.length === 0 ? (
                        Array.from({ length: 6 }).map((_, index) => (
                            <View key={`catalog-skeleton-${index}`} style={styles.catalogSkeletonRow}>
                                <View style={{ flex: 1 }}>
                                    <AppSkeleton width="52%" height={12} />
                                    <AppSkeleton width="36%" height={10} style={{ marginTop: 8 }} />
                                </View>
                                <AppSkeleton width={66} height={30} borderRadius={DesignSystem.radius.pill} />
                            </View>
                        ))
                    ) : filteredItems.length === 0 ? (
                        <Text style={{ paddingVertical: 12, textAlign: 'center', color: theme.colors.outline }}>
                            No items match this filter.
                        </Text>
                    ) : (
                        visibleCatalogItems.map((item, index) => {
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
                                </View>
                            );
                        })
                    )}
                    {hiddenCatalogCount > 0 && (
                        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 8 }}>
                            Showing first {visibleCatalogItems.length} results. Refine search to narrow {hiddenCatalogCount} more items.
                        </Text>
                    )}
                </AppCard>
                </View>

                <View style={[styles.workspaceColumn, useWideWorkspace && styles.workspaceRightColumn]}>

                {/* Bill Details */}
                <AppCard animationDelay={95} style={{ marginBottom: 16 }}>
                    <Text variant="titleSmall" style={[styles.sectionTitle, { marginBottom: 12 }]}>Bill Details</Text>

                    <View style={[styles.billMetaRow, useWideWorkspace && styles.billMetaRowWide]}>
                        <View style={{ flex: 1 }}>
                            <AppInput
                                label="Bill No."
                                inputType="text"
                                value={billNumber || ''}
                                onChangeText={(val) => setBillDetails(billDate, val.toUpperCase().replace(/\s+/g, ''))}
                                placeholder="Auto-generated"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppButton
                                mode="outlined"
                                onPress={() => setShowDatePicker(true)}
                                style={{ marginTop: 6, borderColor: theme.colors.outline }}
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
                        <View style={{ backgroundColor: theme.colors.surfaceVariant, padding: 12, borderRadius: DesignSystem.radius.sm }}>
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
                        <View style={[styles.partyInputRow, useWideWorkspace && styles.partyInputRowWide]}>
                            <View style={{ flex: 1 }}>
                                <AppInput
                                    label="Name"
                                    inputType="name"
                                    value={customerName}
                                    onChangeText={(value) => setCustomerDetails(value, customerPhone)}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <AppInput
                                    label="Phone"
                                    inputType="phone"
                                    value={customerPhone}
                                    onChangeText={(value) => setCustomerDetails(customerName, value)}
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
                    style={[styles.checkoutCard, { backgroundColor: theme.colors.primaryContainer }]}
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
                        disabled={!canCheckout}
                        icon="check"
                        contentStyle={{ paddingHorizontal: 16 }}
                    >
                        Checkout
                    </AppButton>
                </AppCard>
                </View>
                </View>
            </View>
            </ScrollView>
            )}
            <Portal>
                <MotionPresence>
                    {checkoutLoading && (
                        <MotionView style={[styles.blockingOverlay, { backgroundColor: theme.colors.backdrop }]}>
                            <Surface style={[styles.loadingSheet, { backgroundColor: theme.colors.surface }]}>
                                <ActivityIndicator animating size="small" />
                                <Text variant="bodyMedium">Creating bill...</Text>
                            </Surface>
                        </MotionView>
                    )}
                </MotionPresence>
                <MotionPresence>
                    {checkoutResult && (
                        <MotionView style={[styles.drawerBackdrop, { backgroundColor: theme.colors.backdrop }]}>
                            <Pressable style={StyleSheet.absoluteFill} onPress={() => setCheckoutResult(null)} />
                            <Surface
                                style={[
                                    styles.checkoutDrawer,
                                    {
                                        backgroundColor: theme.colors.surface,
                                        borderColor: theme.colors.outlineVariant,
                                    },
                                ]}
                            >
                                <View style={styles.checkoutDrawerHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                                            Bill #{checkoutResult.bill.billNumber || checkoutResult.bill.id.slice(0, 8)}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {formatCurrency(checkoutResult.bill.total, checkoutResult.bill.currency || activeCurrency)}
                                        </Text>
                                    </View>
                                    <Chip compact>{checkoutResult.paymentStatus}</Chip>
                                </View>
                                {checkoutResult.qrImageUrl ? (
                                    <View style={styles.qrBlock}>
                                        <Image source={{ uri: checkoutResult.qrImageUrl }} style={[styles.qrImage, { width: qrSize, height: qrSize }]} />
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            Scan to pay exact amount
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {checkoutResult.bill.upiId || 'UPI configured in profile'}
                                        </Text>
                                    </View>
                                ) : (
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 10 }}>
                                        Add UPI ID in Profile to generate payment QR automatically.
                                    </Text>
                                )}

                                <View style={styles.drawerActionsRow}>
                                    <AppButton
                                        mode={checkoutResult.paymentStatus === 'PENDING' ? 'contained-tonal' : 'outlined'}
                                        onPress={() => { void handlePaymentStatusChange('PENDING'); }}
                                        loading={paymentStatusLoading}
                                        disabled={paymentStatusLoading}
                                    >
                                        Mark Pending
                                    </AppButton>
                                    <AppButton
                                        mode={checkoutResult.paymentStatus === 'PAID' ? 'contained' : 'outlined'}
                                        onPress={() => { void handlePaymentStatusChange('PAID'); }}
                                        loading={paymentStatusLoading}
                                        disabled={paymentStatusLoading}
                                    >
                                        Mark Paid
                                    </AppButton>
                                </View>

                                <View style={styles.drawerActionsRow}>
                                    <AppButton
                                        mode="outlined"
                                        onPress={() => { void handleShareCreatedBill(); }}
                                    >
                                        Print / Share
                                    </AppButton>
                                    <AppButton
                                        mode="contained"
                                        onPress={() => router.push('/transaction/settlements' as never)}
                                    >
                                        Settlements
                                    </AppButton>
                                </View>
                            </Surface>
                        </MotionView>
                    )}
                </MotionPresence>
            </Portal>
        </ScreenWrapper>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: 24,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.dashboardMaxWidth,
    },
    workspaceGrid: {
        gap: 12,
    },
    workspaceGridWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    workspaceColumn: {
        minWidth: 0,
    },
    workspaceLeftColumn: {
        flex: 1.15,
    },
    workspaceRightColumn: {
        flex: 1,
    },
    heroCard: {
        marginBottom: 16,
    },
    heroChipRow: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    headerActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
    },
    searchRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    searchRowWide: {
        alignItems: 'center',
    },
    searchInputWrap: {
        flex: 1,
    },
    searchInput: {
        marginBottom: 0,
    },
    searchPendingText: {
        marginTop: 4,
    },
    scanButtonWrap: {
        width: 60,
        justifyContent: 'center',
    },
    sectionTitle: {
        fontWeight: '700',
    },
    searchResultCard: {
        overflow: 'hidden',
    },
    catalogSkeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
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
    billMetaRow: {
        flexDirection: 'column',
        gap: 12,
        marginBottom: 12,
    },
    billMetaRowWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    partyInputRow: {
        flexDirection: 'column',
        gap: 10,
    },
    partyInputRowWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
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
        borderWidth: 0,
        elevation: 0,
    },
    checkoutContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    blockingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingSheet: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DesignSystem.spacing.xs,
        paddingHorizontal: DesignSystem.spacing.md,
        paddingVertical: DesignSystem.spacing.sm,
        borderRadius: DesignSystem.radius.lg,
    },
    drawerBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    checkoutDrawer: {
        borderTopLeftRadius: DesignSystem.radius.xl,
        borderTopRightRadius: DesignSystem.radius.xl,
        borderWidth: 0,
        paddingHorizontal: DesignSystem.spacing.md,
        paddingTop: DesignSystem.spacing.md,
        paddingBottom: DesignSystem.spacing.lg,
        gap: DesignSystem.spacing.xs,
    },
    checkoutDrawerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DesignSystem.spacing.sm,
    },
    qrBlock: {
        alignItems: 'center',
        gap: 6,
        marginVertical: 8,
    },
    qrImage: {
        borderRadius: DesignSystem.radius.sm,
    },
    drawerActionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
    },
});
