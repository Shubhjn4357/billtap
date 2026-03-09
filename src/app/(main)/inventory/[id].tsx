import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { toUserMessage } from '../../../api/client';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { FormSectionCard } from '../../../components/ui/FormBlocks';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { SelectField } from '../../../components/ui/SelectField';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useAuthStore } from '../../../store/authStore';
import { canPerformAction } from '../../../utils/accessControl';
import { useItemDetails } from '../../../hooks/useInventory';
import { useInventoryMutations } from '../../../hooks/useInventoryMutations';
import { useGodowns } from '../../../hooks/useGodowns';

export default function ItemDetailScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const { id } = useLocalSearchParams<{ id: string }>();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/inventory');
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const canUpdateItem = canPerformAction(role, 'inventory.update', subscription);
    const canDeleteItem = canPerformAction(role, 'inventory.delete', subscription);

    const [customQty, setCustomQty] = useState('1');
    const [customReason, setCustomReason] = useState('');
    const [customType, setCustomType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
    const [selectedGodownId, setSelectedGodownId] = useState<string | null>(null);

    const { item, isLoading, isRefetching, refetch } = useItemDetails(id, {
        enabled: Boolean(id),
    });
    const { godowns, isRefetching: godownsRefetching, refetch: refetchGodowns } = useGodowns();

    const {
        adjustStock,
        archiveItem,
        isAdjustingStock: isPending,
        isArchivingItem: deleting,
    } = useInventoryMutations();

    useEffect(() => {
        if (selectedGodownId || godowns.length === 0) return;
        const defaultGodown = godowns.find((entry) => entry.isDefault) ?? godowns[0];
        if (defaultGodown) {
            setSelectedGodownId(defaultGodown.id);
        }
    }, [godowns, selectedGodownId]);

    if (isLoading) {
        return <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>;
    }
    if (!item) {
        return <View style={s.centered}><Text style={{ color: colors.textSecondary }}>Item not found.</Text></View>;
    }

    const health = item.stock <= 0 ? 'OUT OF STOCK' : item.stock <= item.reorderLevel ? 'LOW STOCK' : 'IN STOCK';
    const runQuickAdjustment = (type: 'IN' | 'OUT') => {
        void adjustStock({
            itemId: id!,
            type,
            quantity: 1,
            reason: type === 'IN' ? 'Quick +1 from detail' : 'Quick -1 from detail',
            godownId: selectedGodownId ?? undefined,
        })
            .then(() => {
                dialog.alert('Success', 'Stock updated.');
            })
            .catch((error) => {
                dialog.alert('Error', error instanceof Error ? error.message : 'Failed to update stock.');
            });
    };

    const runCustomAdjustment = () => {
        const qty = Number(customQty);
        if (!Number.isFinite(qty) || qty <= 0) {
            dialog.alert('Validation', 'Enter a valid quantity greater than zero.');
            return;
        }
        void adjustStock({
            itemId: id!,
            type: customType,
            quantity: qty,
            reason: customReason.trim() || `Manual ${customType}`,
            godownId: selectedGodownId ?? undefined,
        })
            .then(() => {
                dialog.alert('Success', 'Stock updated.');
            })
            .catch((error) => {
                dialog.alert('Error', error instanceof Error ? error.message : 'Failed to update stock.');
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
                                        onPress: () => {
                                            void archiveItem(id!)
                                                .then(() => {
                                                    dialog.alert('Moved to recycle bin', 'Item deleted successfully.', [
                                                        {
                                                            text: 'OK',
                                                            onPress: () => {
                                                                router.replace('/(main)/inventory' as Parameters<typeof router.push>[0]);
                                                            },
                                                        },
                                                    ]);
                                                })
                                                .catch((error) => {
                                                    dialog.alert('Delete failed', toUserMessage(error, 'Unable to delete this item.'));
                                                });
                                        },
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
                            refreshing={isRefetching || godownsRefetching}
                            onRefresh={() => {
                                void Promise.all([refetch(), refetchGodowns()]);
                            }}
                        />
                    )}
            >
                <View style={s.heroWrap}>
                    <UtilityHero
                        title={item.name}
                        subtitle={`${health} - ${item.stock} ${item.unit || 'unit'} available`}
                        icon="archive-outline"
                        tone={item.stock <= 0 ? 'danger' : item.stock <= item.reorderLevel ? 'warning' : 'success'}
                    />
                </View>

                <View style={s.statsRow}>
                    <HubMetricCard label="Stock" value={`${item.stock}`} meta={item.unit || 'units'} tone={item.stock <= item.reorderLevel ? 'warning' : 'success'} />
                    <HubMetricCard label="Sale Price" value={`Rs ${Number(item.salePrice ?? 0).toLocaleString('en-IN')}`} meta="Selling rate" tone="info" />
                    <HubMetricCard label="GST" value={`${Number(item.gstRate ?? 0)}%`} meta="Tax slab" tone="default" />
                </View>

                <View style={s.card}>
                    <FormSectionCard title="Item Details" description="Commercial, tax, and stock reference fields for this item.">
                        <InfoRow label="Purchase Price" value={`Rs ${Number(item.purchasePrice ?? 0).toLocaleString('en-IN')}`} colors={colors} />
                        <InfoRow label="MRP" value={`Rs ${Number(item.mrp ?? 0).toLocaleString('en-IN')}`} colors={colors} />
                        <InfoRow label="Reorder Level" value={`${item.reorderLevel} ${item.unit || ''}`} colors={colors} />
                        {item.sku ? <InfoRow label="SKU" value={item.sku} colors={colors} /> : null}
                        {item.hsnCode ? <InfoRow label="HSN" value={item.hsnCode} colors={colors} /> : null}
                        {item.barcode ? <InfoRow label="Barcode" value={item.barcode} colors={colors} /> : null}
                        {item.category ? <InfoRow label="Category" value={item.category} colors={colors} /> : null}
                        {item.location ? <InfoRow label="Location" value={item.location} colors={colors} /> : null}
                        {item.description ? <InfoRow label="Description" value={item.description} colors={colors} /> : null}
                    </FormSectionCard>
                </View>

                <View style={s.card}>
                    <FormSectionCard title="Quick Adjust" description="Apply a single-step stock increase or decrease." tone="warning">
                    {godowns.length > 0 ? (
                        <>
                            <SelectField
                                value={selectedGodownId}
                                onChange={(value) => setSelectedGodownId(value)}
                                options={godowns.map((godown) => ({
                                    label: godown.name,
                                    value: godown.id,
                                    description: godown.isDefault ? 'Default godown' : godown.address ?? 'Stock location',
                                }))}
                                title="Stock Godown"
                                placeholder="Select godown for stock movement"
                                allowClear
                                onClear={() => setSelectedGodownId(null)}
                            />
                            <Text style={[s.helperText, { color: colors.textSecondary }]}>
                                {selectedGodownId
                                    ? 'Quick and custom adjustments will update this godown and the total item stock together.'
                                    : 'No godown selected. Adjustments will update only the total item stock.'}
                            </Text>
                        </>
                    ) : null}
                    <View style={s.quickRow}>
                        <Pressable style={[s.quickBtn, { backgroundColor: colors.success }]} disabled={isPending} onPress={() => runQuickAdjustment('IN')}>
                            <Text style={s.quickBtnText}>+1 IN</Text>
                        </Pressable>
                        <Pressable style={[s.quickBtn, { backgroundColor: colors.error }]} disabled={isPending} onPress={() => runQuickAdjustment('OUT')}>
                            <Text style={s.quickBtnText}>-1 OUT</Text>
                        </Pressable>
                    </View>
                    </FormSectionCard>
                </View>

                <View style={s.card}>
                    <FormSectionCard title="Custom Adjust" description="Post a manual stock movement with type, quantity, and reason." tone="info">

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
                    </FormSectionCard>
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
        heroWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
        card: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
        quickRow: { flexDirection: 'row', gap: Spacing.sm },
        helperText: { fontSize: 11, marginBottom: Spacing.sm },
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
