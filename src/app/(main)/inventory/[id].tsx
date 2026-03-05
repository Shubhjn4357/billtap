import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { itemApi } from '../../../api/endpoints';
import { toUserMessage } from '../../../api/client';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { SelectField } from '../../../components/ui/SelectField';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useAuthStore } from '../../../store/authStore';
import { canPerformAction } from '../../../utils/accessControl';

export default function ItemDetailScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const { id } = useLocalSearchParams<{ id: string }>();
    const queryClient = useQueryClient();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/inventory');
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const canUpdateItem = canPerformAction(role, 'inventory.update', subscription);
    const canDeleteItem = canPerformAction(role, 'inventory.delete', subscription);

    const [customQty, setCustomQty] = useState('1');
    const [customReason, setCustomReason] = useState('');
    const [customType, setCustomType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['item', id],
        queryFn: () => itemApi.get(id!),
        enabled: !!id,
    });

    const { mutate: adjustStock, isPending } = useMutation({
        mutationFn: (payload: { type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string }) => itemApi.adjustStock(id!, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['item', id] });
            queryClient.invalidateQueries({ queryKey: ['items'] });
            dialog.alert('Success', 'Stock updated.');
        },
        onError: (error) => {
            dialog.alert('Error', error instanceof Error ? error.message : 'Failed to update stock.');
        },
    });
    const { mutate: deleteItem, isPending: deleting } = useMutation({
        mutationFn: () => itemApi.delete(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['item', id] });
            dialog.alert('Moved to recycle bin', 'Item deleted successfully.', [
                {
                    text: 'OK',
                    onPress: () => {
                        router.replace('/(main)/inventory' as Parameters<typeof router.push>[0]);
                    },
                },
            ]);
        },
        onError: (error) => {
            dialog.alert('Delete failed', toUserMessage(error, 'Unable to delete this item.'));
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
            dialog.alert('Validation', 'Enter a valid quantity greater than zero.');
            return;
        }
        adjustStock({
            type: customType,
            quantity: qty,
            reason: customReason.trim() || `Manual ${customType}`,
        });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={item.name}
                subtitle="Inventory detail"
                onBackPress={smartBack}
                rightAction={(
                    <View style={s.topActions}>
                        <Pressable
                            style={s.iconBtn}
                            onPress={() => {
                                if (!canUpdateItem) {
                                    dialog.alert('Access denied', 'Your role cannot edit inventory items.');
                                    return;
                                }
                                router.push(`/(main)/inventory/add-item?id=${id}` as Parameters<typeof router.push>[0]);
                            }}
                        >
                            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
                        </Pressable>
                        <Pressable
                            style={[s.iconBtn, { backgroundColor: `${colors.error}15` }]}
                            onPress={() => {
                                if (!canDeleteItem) {
                                    dialog.alert('Access denied', 'Your role cannot delete inventory items.');
                                    return;
                                }
                                dialog.alert('Delete item', 'Move this item to recycle bin?', [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: deleting ? 'Deleting...' : 'Delete',
                                        style: 'destructive',
                                        onPress: () => deleteItem(),
                                    },
                                ]);
                            }}
                            disabled={deleting}
                        >
                            <MaterialCommunityIcons name="delete-outline" size={18} color={colors.error} />
                        </Pressable>
                    </View>
                )}
            />

            <ScrollView
                contentContainerStyle={{ paddingBottom: 80 }}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefetching}
                        onRefresh={() => {
                            refetch();
                        }}
                    />
                )}
            >
                <View style={[s.stockBanner, { backgroundColor: `${healthColor}1f` }]}>
                    <Text style={[s.stockQty, { color: healthColor }]}>{item.stock} {item.unit || 'unit'}</Text>
                    <Text style={[s.stockState, { color: healthColor }]}>{health}</Text>
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <InfoRow label="Sale Price" value={`Rs ${Number(item.salePrice ?? 0).toLocaleString('en-IN')}`} colors={colors} />
                    <InfoRow label="Purchase Price" value={`Rs ${Number(item.purchasePrice ?? 0).toLocaleString('en-IN')}`} colors={colors} />
                    <InfoRow label="MRP" value={`Rs ${Number(item.mrp ?? 0).toLocaleString('en-IN')}`} colors={colors} />
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

                    <SelectField
                        value={customType}
                        onChange={(value) => setCustomType(value as 'IN' | 'OUT' | 'ADJUST')}
                        options={[
                            { label: 'IN', value: 'IN' },
                            { label: 'OUT', value: 'OUT' },
                            { label: 'ADJUST', value: 'ADJUST' },
                        ]}
                        title="Select Adjustment Type"
                        placeholder="Adjustment type"
                    />

                    <AppInput
                        inputType="decimal"
                        value={customQty}
                        onChangeText={setCustomQty}
                        placeholder="Quantity"
                    />
                    <AppInput
                        inputType="text"
                        value={customReason}
                        onChangeText={setCustomReason}
                        placeholder="Reason (optional)"
                    />
                    <Pressable style={[s.submitBtn, { backgroundColor: colors.primary }]} disabled={isPending} onPress={runCustomAdjustment}>
                        {isPending ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Text style={s.submitBtnText}>Apply Adjustment</Text>}
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
        iconBtn: {
            width: 34,
            height: 34,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceVariant,
        },
        topActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
        },
        stockBanner: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.card, padding: Spacing.lg, alignItems: 'center' },
        stockQty: { fontSize: 30, fontWeight: '800' },
        stockState: { fontSize: 12, fontWeight: '700', marginTop: 4 },
        card: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.card, padding: Spacing.md, gap: Spacing.sm },
        sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.xs },
        quickRow: { flexDirection: 'row', gap: Spacing.sm },
        quickBtn: { flex: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
        quickBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
        submitBtn: { borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
        submitBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
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
