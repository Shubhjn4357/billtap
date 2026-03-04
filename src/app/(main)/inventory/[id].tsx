import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../constants/theme';

export default function ItemDetailScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const { id } = useLocalSearchParams<{ id: string }>();
    const queryClient = useQueryClient();
    const s = styles(colors);

    const [customQty, setCustomQty] = useState('1');
    const [customReason, setCustomReason] = useState('');
    const [customType, setCustomType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');

    const { data, isLoading } = useQuery({
        queryKey: ['item', id],
        queryFn: () => itemApi.get(id!),
        enabled: !!id,
    });

    const { mutate: adjustStock, isPending } = useMutation({
        mutationFn: (payload: { type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string }) => itemApi.adjustStock(id!, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['item', id] });
            queryClient.invalidateQueries({ queryKey: ['items'] });
            Alert.alert('Success', 'Stock updated.');
        },
        onError: (error) => {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update stock.');
        },
    });

    const item = data?.item;
    if (isLoading) {
        return <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>;
    }
    if (!item) {
        return <View style={s.centered}><Text style={{ color: colors.textSecondary }}>Item not found.</Text></View>;
    }

    const health = item.stock <= 0 ? 'OUT OF STOCK' : item.stock <= item.reorderLevel ? 'LOW STOCK' : 'IN STOCK';
    const healthColor = item.stock <= 0 ? colors.error : item.stock <= item.reorderLevel ? colors.warning : colors.success;

    const runQuickAdjustment = (type: 'IN' | 'OUT') => {
        adjustStock({
            type,
            quantity: 1,
            reason: type === 'IN' ? 'Quick +1 from detail' : 'Quick -1 from detail',
        });
    };

    const runCustomAdjustment = () => {
        const qty = Number(customQty);
        if (!Number.isFinite(qty) || qty <= 0) {
            Alert.alert('Validation', 'Enter a valid quantity greater than zero.');
            return;
        }
        adjustStock({
            type: customType,
            quantity: qty,
            reason: customReason.trim() || `Manual ${customType}`,
        });
    };

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.headerTitle} numberOfLines={1}>{item.name}</Text>
                <Pressable onPress={() => router.push(`/(main)/inventory/add-item?id=${id}` as Parameters<typeof router.push>[0])}>
                    <Text style={[s.editBtn, { color: colors.primary }]}>Edit</Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
                <View style={[s.stockBanner, { backgroundColor: healthColor + '1f' }]}>
                    <Text style={[s.stockQty, { color: healthColor }]}>{item.stock} {item.unit || 'unit'}</Text>
                    <Text style={[s.stockState, { color: healthColor }]}>{health}</Text>
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <InfoRow label="Sale Price" value={`₹${Number(item.salePrice ?? 0).toLocaleString('en-IN')}`} colors={colors} />
                    <InfoRow label="Purchase Price" value={`₹${Number(item.purchasePrice ?? 0).toLocaleString('en-IN')}`} colors={colors} />
                    <InfoRow label="MRP" value={`₹${Number(item.mrp ?? 0).toLocaleString('en-IN')}`} colors={colors} />
                    <InfoRow label="GST" value={`${Number(item.gstRate ?? 0)}%`} colors={colors} />
                    <InfoRow label="Reorder Level" value={`${item.reorderLevel} ${item.unit || ''}`} colors={colors} />
                    {item.sku ? <InfoRow label="SKU" value={item.sku} colors={colors} /> : null}
                    {item.hsnCode ? <InfoRow label="HSN" value={item.hsnCode} colors={colors} /> : null}
                    {item.barcode ? <InfoRow label="Barcode" value={item.barcode} colors={colors} /> : null}
                    {item.category ? <InfoRow label="Category" value={item.category} colors={colors} /> : null}
                    {item.location ? <InfoRow label="Location" value={item.location} colors={colors} /> : null}
                    {item.description ? <InfoRow label="Description" value={item.description} colors={colors} /> : null}
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>QUICK ADJUST</Text>
                    <View style={s.quickRow}>
                        <Pressable style={[s.quickBtn, { backgroundColor: colors.success }]} disabled={isPending} onPress={() => runQuickAdjustment('IN')}>
                            <Text style={s.quickBtnText}>+1 IN</Text>
                        </Pressable>
                        <Pressable style={[s.quickBtn, { backgroundColor: colors.error }]} disabled={isPending} onPress={() => runQuickAdjustment('OUT')}>
                            <Text style={s.quickBtnText}>-1 OUT</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>CUSTOM ADJUST</Text>
                    <View style={s.typeRow}>
                        {(['IN', 'OUT', 'ADJUST'] as const).map((type) => {
                            const selected = customType === type;
                            return (
                                <Pressable
                                    key={type}
                                    style={[s.typeChip, { backgroundColor: selected ? colors.primary : colors.surfaceVariant }]}
                                    onPress={() => setCustomType(type)}
                                >
                                    <Text style={{ color: selected ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{type}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <TextInput
                        value={customQty}
                        onChangeText={setCustomQty}
                        keyboardType="numeric"
                        style={[s.input, { borderColor: colors.border, color: colors.text }]}
                        placeholder="Quantity"
                        placeholderTextColor={colors.textSecondary}
                    />
                    <TextInput
                        value={customReason}
                        onChangeText={setCustomReason}
                        style={[s.input, { borderColor: colors.border, color: colors.text }]}
                        placeholder="Reason (optional)"
                        placeholderTextColor={colors.textSecondary}
                    />
                    <Pressable style={[s.submitBtn, { backgroundColor: colors.primary }]} disabled={isPending} onPress={runCustomAdjustment}>
                        {isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.submitBtnText}>Apply Adjustment</Text>}
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: ColorPalette }) {
    return (
        <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
            <Text style={[rowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[rowStyles.value, { color: colors.text }]}>{value}</Text>
        </View>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        back: { fontWeight: '600', fontSize: 14 },
        headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontWeight: '700', fontSize: 17, marginHorizontal: Spacing.sm },
        editBtn: { fontWeight: '700', fontSize: 14 },
        stockBanner: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.card, padding: Spacing.lg, alignItems: 'center' },
        stockQty: { fontSize: 30, fontWeight: '800' },
        stockState: { fontSize: 12, fontWeight: '700', marginTop: 4 },
        card: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.card, padding: Spacing.md },
        sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
        quickRow: { flexDirection: 'row', gap: Spacing.sm },
        quickBtn: { flex: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
        quickBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
        typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
        typeChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 7 },
        input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.sm, fontSize: 14 },
        submitBtn: { borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
        submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    });

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 0.5,
        gap: Spacing.sm,
    },
    label: { fontSize: 12, width: 130, fontWeight: '600' },
    value: { flex: 1, fontSize: 13, textAlign: 'right' },
});

