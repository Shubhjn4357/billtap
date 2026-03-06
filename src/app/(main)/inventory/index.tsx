import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { itemApi } from '../../../api/endpoints';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useScannerMode } from '../../../hooks/useScannerMode';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAppColors } from '../../../hooks/useAppColors';
import { useInventory, getStockHealth, type StockHealthFilter, type InventorySortKey } from '../../../hooks/useInventory';
import type { Item } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { useHaptics } from '../../../hooks/useHaptics';

const SORT_OPTIONS: { key: InventorySortKey; label: string }[] = [
    { key: 'name_asc', label: 'Name A–Z' },
    { key: 'name_desc', label: 'Name Z–A' },
    { key: 'stock_desc', label: 'Stock ↓' },
    { key: 'stock_asc', label: 'Stock ↑' },
    { key: 'price_desc', label: 'Price ↓' },
    { key: 'price_asc', label: 'Price ↑' },
];

const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((e) => e !== id) : [...list, id];

export default function InventoryScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const queryClient = useQueryClient();
    const params = useLocalSearchParams<{ search?: string | string[]; scanAt?: string | string[] }>();
    const scanner = useScannerMode();
    const { can } = usePermissions();
    const canCreateItem = can('inventory.create');
    const canUpdateItem = can('inventory.update');
    const canDeleteItem = can('inventory.delete');
    const dialog = useAppDialog();
    const { selection, impact } = useHaptics();

    const [search, setSearch] = useState('');
    const [stockFilter, setStockFilter] = useState<StockHealthFilter>('all');
    const [category, setCategory] = useState<string | null>(null);
    const [unit, setUnit] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<InventorySortKey>('name_asc');
    const [showSortSheet, setShowSortSheet] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        const scannedSearch = Array.isArray(params.search) ? params.search[0] : params.search;
        if (scannedSearch) setSearch(scannedSearch);
    }, [params.search, params.scanAt]);

    const { items, categories, units, stats, isLoading, isRefetching, refetch } = useInventory({
        search,
        category,
        unit,
        stockHealth: stockFilter,
        sortBy,
    });

    useEffect(() => {
        if (!selectionMode) return;
        const validIds = new Set(items.map((e) => e.id));
        setSelectedIds((cur) => cur.filter((id) => validIds.has(id)));
    }, [items, selectionMode]);

    const { mutate: quickAdjustStock } = useMutation({
        mutationFn: (payload: { itemId: string; type: 'IN' | 'OUT'; quantity: number }) =>
            itemApi.adjustStock(payload.itemId, {
                type: payload.type,
                quantity: payload.quantity,
                reason: payload.type === 'IN' ? 'Quick +1 from list' : 'Quick -1 from list',
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
    });

    const { mutate: bulkDelete, isPending: bulkDeleting } = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map((id) => itemApi.delete(id)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
            setSelectedIds([]);
            setSelectionMode(false);
        },
        onError: (error) => dialog.alert('Bulk delete failed', error instanceof Error ? error.message : 'Unable to delete.'),
    });

    const { mutate: bulkGstUpdate, isPending: bulkUpdatingGst } = useMutation({
        mutationFn: async ({ ids, gstRate }: { ids: string[]; gstRate: number }) => {
            await Promise.all(ids.map((id) => itemApi.update(id, { gstRate })));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
            setSelectedIds([]);
            setSelectionMode(false);
        },
        onError: (error) => dialog.alert('Bulk update failed', error instanceof Error ? error.message : 'Unable to update.'),
    });

    const handleScanPress = () => {
        if (scanner.canUseCameraScanner) { router.push('/scan?target=stock' as Parameters<typeof router.push>[0]); return; }
        if (!scanner.barcodeEnabled) { dialog.alert('Scanner disabled', 'Enable barcode scanning in Settings > Item Settings.'); return; }
        dialog.alert('USB scanner mode', 'Use a connected USB scanner and scan into the search input.');
    };

    const requestBulkDelete = () => {
        if (!selectedIds.length) return;
        if (!canDeleteItem) { dialog.alert('Access denied', 'Your role cannot delete inventory items.'); return; }
        dialog.alert('Delete selected items', `Move ${selectedIds.length} item(s) to recycle bin?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => bulkDelete(selectedIds) },
        ]);
    };

    const requestBulkGst = (rate: number) => {
        if (!selectedIds.length) return;
        if (!canUpdateItem) { dialog.alert('Access denied', 'Your role cannot update inventory items.'); return; }
        dialog.alert('Bulk GST update', `Set GST rate to ${rate}% for ${selectedIds.length} item(s)?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Apply', onPress: () => bulkGstUpdate({ ids: selectedIds, gstRate: rate }) },
        ]);
    };

    const activeFilters = [category, unit, stockFilter !== 'all' ? stockFilter : null].filter(Boolean).length
        + (sortBy !== 'name_asc' ? 1 : 0);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Inventory"
                subtitle={`${stats.total} items · Rs ${stats.stockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                rightAction={(
                    <View style={s.topActions}>
                        <Pressable style={[s.topIconBtn, { borderColor: colors.border }]} onPress={() => setShowSortSheet(true)}>
                            <MaterialCommunityIcons name="sort-variant" size={16} color={activeFilters > 0 ? colors.primary : colors.textSecondary} />
                            {activeFilters > 0 ? <View style={[s.filterBadge, { backgroundColor: colors.primary }]}><Text style={s.filterBadgeText}>{activeFilters}</Text></View> : null}
                        </Pressable>
                        <Pressable
                            style={[s.topIconBtn, { borderColor: canCreateItem ? colors.primary : colors.border, backgroundColor: canCreateItem ? colors.primary : colors.border }]}
                            onPress={() => {
                                if (!canCreateItem) { dialog.alert('Access denied', 'Your role cannot create inventory items.'); return; }
                                void impact();
                                router.push('/(main)/inventory/add-item' as Parameters<typeof router.push>[0]);
                            }}
                        >
                            <MaterialCommunityIcons name="plus" size={18} color={colors.onPrimary} />
                        </Pressable>
                    </View>
                )}
            />

            {/* Stats Row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsScroll} contentContainerStyle={s.statsRow}>
                {[
                    { label: 'In Stock', value: stats.inStock, color: colors.success },
                    { label: 'Low Stock', value: stats.lowStock, color: colors.warning },
                    { label: 'Out of Stock', value: stats.outOfStock, color: colors.error },
                    { label: 'Stock Value', value: `Rs ${(stats.stockValue / 1000).toFixed(1)}K`, color: colors.primary, isText: true },
                ].map((chip) => (
                    <View key={chip.label} style={[s.statChip, { borderColor: chip.color }]}>
                        <Text style={[s.statValue, { color: chip.color }]}>{chip.value}</Text>
                        <Text style={[s.statLabel, { color: colors.textSecondary }]}>{chip.label}</Text>
                    </View>
                ))}
            </ScrollView>

            {/* Search */}
            <View style={s.searchRow}>
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder={scanner.isUsbScannerMode ? 'Scan via USB or type...' : 'Search by name or barcode...'}
                    showScanAction
                    scanLabel={scanner.canUseCameraScanner ? 'Scan' : scanner.isUsbScannerMode ? 'USB' : 'Off'}
                    onScanPress={handleScanPress}
                />
            </View>

            {/* Stock Health Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersRow}>
                {([['all', 'All'], ['in', 'In Stock'], ['low', 'Low Stock'], ['out', 'Out of Stock']] as const).map(([val, lbl]) => {
                    const sel = stockFilter === val;
                    return (
                        <Pressable key={val} style={[s.filterChip, sel && { backgroundColor: colors.primary }]} onPress={() => { void selection(); setStockFilter(val); }}>
                            <Text style={[s.filterChipText, { color: sel ? colors.onPrimary : colors.textSecondary, fontWeight: sel ? '700' : '500' }]}>{lbl}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Category Filter */}
            {categories.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersRow}>
                    <Pressable style={[s.filterChip, !category && { backgroundColor: withAlpha(colors.primary, '22') }]} onPress={() => setCategory(null)}>
                        <Text style={[s.filterChipText, { color: !category ? colors.primary : colors.textSecondary }]}>All Categories</Text>
                    </Pressable>
                    {categories.map((cat) => {
                        const sel = category === cat;
                        return (
                            <Pressable key={cat} style={[s.filterChip, sel && { backgroundColor: colors.primary }]} onPress={() => setCategory(sel ? null : cat)}>
                                <Text style={[s.filterChipText, { color: sel ? colors.onPrimary : colors.textSecondary, fontWeight: sel ? '700' : '500' }]}>{cat}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            ) : null}

            {/* Bulk Actions */}
            {selectionMode ? (
                <View style={s.bulkRow}>
                    <Text style={[s.bulkLabel, { color: colors.textSecondary }]}>Selected: {selectedIds.length}</Text>
                    <Pressable style={[s.bulkAction, { borderColor: colors.primary }]} onPress={() => requestBulkGst(18)} disabled={!selectedIds.length || bulkUpdatingGst}>
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>{bulkUpdatingGst ? 'Applying...' : 'GST 18%'}</Text>
                    </Pressable>
                    <Pressable style={[s.bulkAction, { borderColor: colors.error }]} onPress={requestBulkDelete} disabled={!selectedIds.length || bulkDeleting}>
                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 11 }}>{bulkDeleting ? 'Deleting...' : 'Delete'}</Text>
                    </Pressable>
                </View>
            ) : (
                <View style={s.actionRow}>
                    <Pressable style={[s.actionChip, { borderColor: colors.border }]} onPress={() => { void selection(); setSelectionMode(true); }}>
                        <MaterialCommunityIcons name="check-circle-outline" size={13} color={colors.textSecondary} />
                        <Text style={[s.actionChipText, { color: colors.textSecondary }]}>Select</Text>
                    </Pressable>
                    <Pressable style={[s.actionChip, { borderColor: colors.border }]} onPress={() => { void selection(); router.push('/(main)/inventory/recycle-bin' as Parameters<typeof router.push>[0]); }}>
                        <MaterialCommunityIcons name="delete-outline" size={13} color={colors.textSecondary} />
                        <Text style={[s.actionChipText, { color: colors.textSecondary }]}>Bin</Text>
                    </Pressable>
                </View>
            )}

            {isLoading ? (
                <ListSkeleton rows={7} />
            ) : (
                <FlatList
                        data={items}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <ItemRow
                            item={item}
                            colors={colors}
                            selectionMode={selectionMode}
                            selected={selectedIds.includes(item.id)}
                            onToggleSelect={() => setSelectedIds((cur) => toggleId(cur, item.id))}
                            onOpen={() => router.push(`/(main)/inventory/${item.id}` as Parameters<typeof router.push>[0])}
                            onQuickIn={() => {
                                if (!canUpdateItem) { dialog.alert('Access denied', 'Your role cannot update stock.'); return; }
                                quickAdjustStock({ itemId: item.id, type: 'IN', quantity: 1 });
                            }}
                            onQuickOut={() => {
                                if (!canUpdateItem) { dialog.alert('Access denied', 'Your role cannot update stock.'); return; }
                                quickAdjustStock({ itemId: item.id, type: 'OUT', quantity: 1 });
                            }}
                        />
                    )}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        ListEmptyComponent={(
                        <View style={s.centered}>
                                <MaterialCommunityIcons name="cube-off-outline" size={36} color={colors.textSecondary} />
                                <Text style={{ color: colors.textSecondary, marginTop: Spacing.sm }}>No items found</Text>
                            {canCreateItem ? (
                                    <Pressable style={[s.emptyAddBtn, { backgroundColor: colors.primary }]} onPress={() => { void impact(); router.push('/(main)/inventory/add-item' as Parameters<typeof router.push>[0]); }}>
                                    <Text style={s.emptyAddBtnText}>Add Item</Text>
                                </Pressable>
                            ) : null}
                        </View>
                        )}
                    refreshControl={(
                        <RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => { void refetch(); }} tintColor={colors.primary} />
                    )}
                />
            )}

            {/* Sort Sheet */}
            {showSortSheet ? (
                <Pressable style={s.sortBackdrop} onPress={() => setShowSortSheet(false)}>
                    <View style={[s.sortSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[s.sortTitle, { color: colors.text }]}>Sort & Filter</Text>

                        <Text style={[s.sortSectionLabel, { color: colors.textSecondary }]}>SORT BY</Text>
                        <View style={s.sortRow}>
                            {SORT_OPTIONS.map((opt) => {
                                const sel = sortBy === opt.key;
                                return (
                                    <Pressable key={opt.key} style={[s.sortChip, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? withAlpha(colors.primary, '20') : 'transparent' }]} onPress={() => { setSortBy(opt.key); }}>
                                        <Text style={{ color: sel ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: sel ? '700' : '500' }}>{opt.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {units.length > 0 ? (
                            <>
                                <Text style={[s.sortSectionLabel, { color: colors.textSecondary }]}>UNIT</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={s.sortRow}>
                                        <Pressable style={[s.sortChip, { borderColor: !unit ? colors.primary : colors.border }]} onPress={() => setUnit(null)}>
                                            <Text style={{ color: !unit ? colors.primary : colors.textSecondary, fontSize: 12 }}>All</Text>
                                        </Pressable>
                                        {units.map((u) => (
                                            <Pressable key={u} style={[s.sortChip, { borderColor: unit === u ? colors.primary : colors.border, backgroundColor: unit === u ? withAlpha(colors.primary, '20') : 'transparent' }]} onPress={() => setUnit(unit === u ? null : u)}>
                                                <Text style={{ color: unit === u ? colors.primary : colors.textSecondary, fontSize: 12 }}>{u}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </ScrollView>
                            </>
                        ) : null}

                        <Pressable style={[s.sortDoneBtn, { backgroundColor: colors.primary }]} onPress={() => setShowSortSheet(false)}>
                            <Text style={[s.sortDoneBtnText, { color: colors.onPrimary }]}>Apply</Text>
                        </Pressable>
                    </View>
                </Pressable>
            ) : null}
        </SafeAreaView>
    );
}

function ItemRow({ item, colors, selectionMode, selected, onToggleSelect, onOpen, onQuickIn, onQuickOut }: {
    item: Item; colors: ColorPalette; selectionMode: boolean; selected: boolean;
    onToggleSelect: () => void; onOpen: () => void; onQuickIn: () => void; onQuickOut: () => void;
}) {
    const health = getStockHealth(item);
    const statusText = health === 'out' ? 'Out of Stock' : health === 'low' ? 'Low Stock' : 'In Stock';
    const statusColor = health === 'out' ? colors.error : health === 'low' ? colors.warning : colors.success;

    return (
        <Pressable
            style={({ pressed }) => [
                rowStyles.row,
                { backgroundColor: selected ? withAlpha(colors.primary, '20') : colors.card, opacity: pressed ? 0.82 : 1, borderColor: selected ? colors.primary : colors.border, borderWidth: 1 },
            ]}
            onPress={selectionMode ? onToggleSelect : onOpen}
        >
            {selectionMode ? (
                <View style={[rowStyles.selector, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? withAlpha(colors.primary, '22') : 'transparent' }]}>
                    <MaterialCommunityIcons name={selected ? 'check-circle' : 'circle-outline'} size={18} color={selected ? colors.primary : colors.textSecondary} />
                </View>
            ) : null}
            <View style={rowStyles.info}>
                <Text style={[rowStyles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                {item.category ? <Text style={[rowStyles.meta, { color: colors.textSecondary }]}>{item.category}</Text> : null}
                <Text style={[rowStyles.meta, { color: colors.textSecondary }]}>{item.sku ? `SKU: ${item.sku} · ` : ''}{item.unit || 'unit'}</Text>
                <View style={[rowStyles.statusBadge, { backgroundColor: withAlpha(statusColor, '18') }]}>
                    <Text style={[rowStyles.status, { color: statusColor }]}>{statusText}</Text>
                </View>
            </View>
            <View style={rowStyles.right}>
                <Text style={[rowStyles.price, { color: colors.text }]}>Rs {Number(item.salePrice ?? 0).toLocaleString('en-IN')}</Text>
                <Text style={[rowStyles.stock, { color: statusColor }]}>{item.stock} {item.unit || ''}</Text>
                {!selectionMode ? (
                    <View style={rowStyles.quickRow}>
                        <Pressable style={[rowStyles.quickBtn, { backgroundColor: colors.success }]} onPress={onQuickIn}>
                            <Text style={[rowStyles.quickBtnText, { color: colors.onPrimary }]}>+1</Text>
                        </Pressable>
                        <Pressable style={[rowStyles.quickBtn, { backgroundColor: colors.error }]} onPress={onQuickOut}>
                            <Text style={[rowStyles.quickBtnText, { color: colors.onPrimary }]}>-1</Text>
                        </Pressable>
                    </View>
                ) : null}
            </View>
        </Pressable>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    topIconBtn: { width: 34, height: 34, borderWidth: 1, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    filterBadge: { position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    filterBadgeText: { color: colors.onPrimary, fontSize: 9, fontWeight: '800' },
    statsScroll: { flexGrow: 0 },
    statsRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, gap: Spacing.sm },
    statChip: { borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, alignItems: 'center', minWidth: 76 },
    statValue: { fontSize: 15, fontWeight: '800' },
    statLabel: { fontSize: 10, marginTop: 1, fontWeight: '600' },
    searchRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs },
    filtersScroll: { flexGrow: 0, marginBottom: 2 },
    filtersRow: { paddingHorizontal: Spacing.lg, gap: Spacing.xs, paddingVertical: 2 },
    filterChip: { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: colors.surfaceVariant },
    filterChipText: { fontSize: 12 },
    actionRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.xs },
    actionChip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionChipText: { fontWeight: '700', fontSize: 11 },
    bulkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    bulkLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
    bulkAction: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
    centered: { paddingTop: 80, alignItems: 'center', gap: Spacing.sm },
    emptyAddBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginTop: Spacing.xs },
    emptyAddBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: Typography.body.size },
    sortBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(colors.text, '66'), justifyContent: 'flex-end' },
    sortSheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.sm },
    sortTitle: { fontSize: 15, fontWeight: '800', marginBottom: Spacing.xs },
    sortSectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: Spacing.xs },
    sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    sortChip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
    sortDoneBtn: { marginTop: Spacing.sm, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
    sortDoneBtnText: { fontWeight: '700', fontSize: 14 },
});

const rowStyles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.card, gap: Spacing.md },
    selector: { width: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, borderWidth: 1 },
    info: { flex: 1, gap: 2 },
    right: { alignItems: 'flex-end', minWidth: 110 },
    name: { fontWeight: '700', fontSize: 14 },
    meta: { fontSize: 11 },
    statusBadge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 2, marginTop: 2 },
    status: { fontSize: 10, fontWeight: '700' },
    price: { fontWeight: '700', fontSize: 14 },
    stock: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    quickRow: { flexDirection: 'row', gap: 5, marginTop: 5 },
    quickBtn: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
    quickBtnText: { fontSize: 11, fontWeight: '700' },
});
