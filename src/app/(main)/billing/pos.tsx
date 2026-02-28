// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, useColorScheme, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePosStore } from '../../../store/posStore';
import { posApi, itemApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, Typography, type ColorPalette } from '../../../constants/theme';
import type { Item } from '../../../types/domain';

export default function PosScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];
    const store = usePosStore();
    const params = useLocalSearchParams<{ search?: string | string[]; scanAt?: string | string[] }>();
    const subtotal = store.getSubtotal();
    const totalTax = store.getTotalTax();
    const total = store.getTotal();
    const queryClient = useQueryClient();
    const s = styles(colors);
    const [search, setSearch] = useState('');

    const { data: itemsData } = useQuery({
        queryKey: ['items'],
        queryFn: () => itemApi.list({ limit: 200 }),
        staleTime: 5 * 60_000,
    });

    useEffect(() => {
        const scannedSearch = Array.isArray(params.search) ? params.search[0] : params.search;
        if (scannedSearch) {
            setSearch(scannedSearch);
        }
    }, [params.search, params.scanAt]);

    const filteredItems = useMemo(() => {
        const list = itemsData?.items ?? [];
        const query = search.trim().toLowerCase();
        if (!query) return list;

        return list.filter((item) =>
            item.name.toLowerCase().includes(query)
            || (item.barcode ?? '').toLowerCase().includes(query)
            || (item.sku ?? '').toLowerCase().includes(query)
        );
    }, [itemsData?.items, search]);

    const { mutate: checkout, isPending } = useMutation({
        mutationFn: () => posApi.createSale({
            partyId: store.partyId ?? undefined,
            items: store.cartItems.map((ci) => ({
                itemId: ci.itemId ?? undefined,
                description: ci.description,
                quantity: ci.quantity,
                rate: ci.rate,
                gstRate: ci.gstRate,
                discountPercent: ci.discountPercent,
                isInterState: ci.isInterState,
                unit: ci.unit,
            })),
            paymentMode: store.paymentMode,
            paidAmount: store.paidAmount > 0 ? store.paidAmount : total,
            discountAmount: store.discountAmount,
            roundOffAmount: store.roundOffAmount,
            notes: store.notes || undefined,
        }),
        onSuccess: (res) => {
            Alert.alert('Sale Recorded', `Invoice: ${res.data.invoiceNumber}`, [
                {
                    text: 'View Invoice',
                    onPress: () => {
                        store.clearCart();
                        queryClient.invalidateQueries({ queryKey: ['invoices'] });
                        if (res.data.id) {
                            router.replace(`/(main)/billing/${res.data.id}` as Parameters<typeof router.replace>[0]);
                        }
                    },
                },
                {
                    text: 'New Sale',
                    onPress: () => {
                        store.clearCart();
                        queryClient.invalidateQueries({ queryKey: ['invoices'] });
                    },
                },
            ]);
        },
        onError: (err) => {
            Alert.alert('Error', err instanceof Error ? err.message : 'Sale failed');
        },
    });

    const handleAddItem = (item: Item) => {
        store.addItem({
            itemId: item.id,
            description: item.name,
            quantity: 1,
            unit: item.unit ?? 'pcs',
            rate: item.salePrice,
            mrp: item.mrp,
            discountPercent: 0,
            gstRate: item.gstRate,
            isInterState: store.isInterState,
        });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()} style={s.backBtn}>
                    <Text style={[s.backText, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={[s.headerTitle, { color: colors.text }]}>POS Mode</Text>
                {store.cartItems.length > 0 ? (
                    <Pressable style={s.clearBtn} onPress={store.clearCart}>
                        <Text style={[s.clearBtnText, { color: colors.error }]}>Clear</Text>
                    </Pressable>
                ) : (
                    <View style={{ width: 42 }} />
                )}
            </View>

            <View style={s.layout}>
                <View style={s.catalog}>
                    <View style={s.searchRow}>
                        <TextInput
                            style={[s.searchInput, { color: colors.text }]}
                            placeholder="Search item / barcode..."
                            placeholderTextColor={colors.textSecondary}
                            value={search}
                            onChangeText={setSearch}
                        />
                        <Pressable
                            style={[s.scanBtn, { backgroundColor: colors.surfaceVariant }]}
                            onPress={() => router.push('/scan?target=billing' as Parameters<typeof router.push>[0])}
                        >
                            <Text style={{ color: colors.primary, fontWeight: '700' }}>Scan</Text>
                        </Pressable>
                    </View>

                    <FlatList
                        data={filteredItems}
                        keyExtractor={(i) => i.id}
                        renderItem={({ item }) => (
                            <Pressable
                                style={({ pressed }) => [s.catalogItem, { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]}
                                onPress={() => handleAddItem(item)}
                            >
                                <Text style={[s.itemName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
                                <Text style={[s.itemPrice, { color: colors.primary }]}>Rs {item.salePrice}</Text>
                                <Text style={[s.itemStock, { color: item.stock <= 0 ? colors.error : colors.textSecondary }]}>
                                    {item.stock <= 0 ? 'Out' : `${item.stock} ${item.unit ?? ''}`}
                                </Text>
                                {item.barcode ? <Text style={[s.itemBarcode, { color: colors.textSecondary }]}>{item.barcode}</Text> : null}
                            </Pressable>
                        )}
                        numColumns={2}
                        columnWrapperStyle={{ gap: Spacing.sm }}
                        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
                        ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>No items. Add items in Inventory.</Text>}
                    />
                </View>

                <View style={[s.cart, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    {store.cartItems.length === 0 ? (
                        <Text style={[s.emptyCart, { color: colors.textSecondary }]}>Tap items to add to cart</Text>
                    ) : (
                        <ScrollView style={s.cartList}>
                            {store.cartItems.map((ci) => (
                                <View key={ci._key} style={[s.cartRow, { borderBottomColor: colors.border }]}>
                                    <Text style={[s.cartItemName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{ci.description}</Text>
                                    <Pressable onPress={() => store.updateItemQty(ci._key, ci.quantity - 1)}>
                                        <Text style={[s.qtyBtn, { color: colors.primary }]}>-</Text>
                                    </Pressable>
                                    <Text style={[s.qty, { color: colors.text }]}>{ci.quantity}</Text>
                                    <Pressable onPress={() => store.updateItemQty(ci._key, ci.quantity + 1)}>
                                        <Text style={[s.qtyBtn, { color: colors.primary }]}>+</Text>
                                    </Pressable>
                                    <Text style={[s.cartTotal, { color: colors.text }]}>Rs {ci.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    <View style={[s.summary, { borderTopColor: colors.border }]}>
                        <View style={s.summaryRow}>
                            <Text style={{ color: colors.textSecondary }}>Taxable</Text>
                            <Text style={{ color: colors.text }}>Rs {(subtotal - store.discountAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        </View>
                        <View style={s.summaryRow}>
                            <Text style={{ color: colors.textSecondary }}>Tax</Text>
                            <Text style={{ color: colors.text }}>Rs {totalTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        </View>
                        <View style={s.summaryRow}>
                            <Text style={[s.totalLabel, { color: colors.text }]}>Total</Text>
                            <Text style={[s.totalValue, { color: colors.primary }]}>Rs {total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        </View>
                        <Pressable
                            style={[s.checkoutBtn, { backgroundColor: store.cartItems.length === 0 ? colors.border : colors.primary }]}
                            onPress={() => checkout()}
                            disabled={store.cartItems.length === 0 || isPending}
                        >
                            {isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.checkoutBtnText}>Checkout Rs {total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>}
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
    backBtn: {},
    backText: { fontWeight: '600', fontSize: 14 },
    headerTitle: { flex: 1, fontWeight: '700', fontSize: Typography.title.size, textAlign: 'center' },
    clearBtn: {},
    clearBtnText: { fontWeight: '600', fontSize: 13 },
    layout: { flex: 1, flexDirection: 'column' },
    catalog: { flex: 1, paddingHorizontal: Spacing.sm },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.sm },
    searchInput: {
        flex: 1,
        borderRadius: Radius.pill,
        backgroundColor: colors.surfaceVariant,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: 13,
    },
    scanBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    catalogItem: { flex: 1, borderRadius: Radius.card, padding: Spacing.sm, minHeight: 86, justifyContent: 'space-between' },
    itemName: { fontWeight: '600', fontSize: 13 },
    itemPrice: { fontWeight: '700', fontSize: 16, marginTop: 4 },
    itemStock: { fontSize: 11, marginTop: 2 },
    itemBarcode: { fontSize: 10, marginTop: 1 },
    cart: { borderTopWidth: 1, maxHeight: 320, minHeight: 180 },
    cartList: { maxHeight: 180 },
    emptyCart: { textAlign: 'center', marginVertical: Spacing.lg, fontSize: 13 },
    cartRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, gap: Spacing.sm },
    cartItemName: { fontSize: 13 },
    qtyBtn: { fontWeight: '700', fontSize: 22, paddingHorizontal: Spacing.xs },
    qty: { fontWeight: '700', fontSize: 15, minWidth: 24, textAlign: 'center' },
    cartTotal: { fontWeight: '600', fontSize: 13, minWidth: 56, textAlign: 'right' },
    summary: { borderTopWidth: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    totalLabel: { fontWeight: '700', fontSize: 16 },
    totalValue: { fontWeight: '800', fontSize: 18 },
    checkoutBtn: { borderRadius: Radius.pill, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
    checkoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
