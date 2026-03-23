import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { INVENTORY_SORT_OPTIONS, INVENTORY_STOCK_FILTER_OPTIONS } from '../../../constants/inventoryOptions';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { ITEM_GST_RATE_OPTIONS } from '../../../constants/formOptions';
import { Radius, Spacing, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useScannerMode } from '../../../hooks/useScannerMode';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAppColors } from '../../../hooks/useAppColors';
import { useInventory, getStockHealth, type StockHealthFilter, type InventorySortKey } from '../../../hooks/useInventory';
import type { Item } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { EmptyStateCard } from '../../../components/ui/ListBlocks';
import { SwipeableRow } from '../../../components/ui/SwipeableRow';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { useHaptics } from '../../../hooks/useHaptics';
import { useInventoryMutations } from '../../../hooks/useInventoryMutations';

const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((e) => e !== id) : [...list, id];

export default function InventoryScreen() {
    const colors = useAppColors();
    const s = styles(colors);
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
        const validIds = new Set(items.map((entry) => entry.id));
        setSelectedIds((current) => current.filter((id) => validIds.has(id)));
    }, [items, selectionMode]);

    const {
        adjustStock,
        archiveItems,
        updateItemsGstRate,
        isArchivingItems: bulkDeleting,
        isUpdatingItemsGstRate: bulkUpdatingGst,
    } = useInventoryMutations();

    const handleScanPress = () => {
        if (scanner.canUseCameraScanner) {
            router.push('/scan?target=stock' as Parameters<typeof router.push>[0]);
            return;
        }
        if (!scanner.barcodeEnabled) {
            dialog.alert('Scanner disabled', 'Enable barcode scanning in Settings > Item Settings.');
            return;
        }
        dialog.alert('USB scanner mode', 'Use a connected USB scanner and scan into the search input.');
    };

    const requestBulkDelete = () => {
        if (!selectedIds.length) return;
        if (!canDeleteItem) {
            dialog.alert('Access denied', 'Your role cannot delete inventory items.');
            return;
        }
        dialog.alert('Delete selected items', `Move ${selectedIds.length} item(s) to recycle bin?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    void archiveItems(selectedIds)
                        .then(() => {
                            setSelectedIds([]);
                            setSelectionMode(false);
                        })
                        .catch((error) => {
                            dialog.alert('Bulk delete failed', error instanceof Error ? error.message : 'Unable to delete.');
                        });
                },
            },
        ]);
    };

    const requestBulkGst = (rate: number) => {
        if (!selectedIds.length) return;
        if (!canUpdateItem) {
            dialog.alert('Access denied', 'Your role cannot update inventory items.');
            return;
        }
        dialog.alert('Bulk GST update', `Set GST rate to ${rate}% for ${selectedIds.length} item(s)?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Apply',
                onPress: () => {
                    void updateItemsGstRate({ ids: selectedIds, gstRate: rate })
                        .then(() => {
                            setSelectedIds([]);
                            setSelectionMode(false);
                        })
                        .catch((error) => {
                            dialog.alert('Bulk update failed', error instanceof Error ? error.message : 'Unable to update.');
                        });
                },
            },
        ]);
    };

    const openBulkGstSelector = () => {
        if (!selectedIds.length) return;
        dialog.alert(
            'Bulk GST update',
            'Choose the GST slab to apply to the selected items.',
            [
                { text: 'Cancel', style: 'cancel' },
                ...ITEM_GST_RATE_OPTIONS.map((option) => ({
                    text: option.label,
                    onPress: () => requestBulkGst(Number(option.value)),
                })),
            ],
        );
    };

    const activeFilters = [category, unit, stockFilter !== 'all' ? stockFilter : null].filter(Boolean).length
        + (sortBy !== 'name_asc' ? 1 : 0);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Inventory"
                subtitle={`${stats.total} items - Rs ${stats.stockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                rightAction={(
                    <View style={s.topActions}>
                        <Pressable style={s.topIconBtn} onPress={() => setShowSortSheet(true)}>
                            <MaterialCommunityIcons name="sort-variant" size={16} color={activeFilters > 0 ? colors.primary : colors.textSecondary} />
                            {activeFilters > 0 ? (
                                <View style={[s.filterBadge, { backgroundColor: colors.primary }]}>
                                    <Text style={s.filterBadgeText}>{activeFilters}</Text>
                                </View>
                            ) : null}
                        </Pressable>
                        <Pressable
                            style={[s.topIconBtn, { borderColor: canCreateItem ? colors.primary : colors.border, backgroundColor: canCreateItem ? colors.primary : colors.border }]}
                            onPress={() => {
                                if (!canCreateItem) {
                                    dialog.alert('Access denied', 'Your role cannot create inventory items.');
                                    return;
                                }
                                void impact();
                                router.push('/(main)/inventory/add-item' as Parameters<typeof router.push>[0]);
                            }}
                        >
                            <MaterialCommunityIcons name="plus" size={18} color={colors.onPrimary} />
                        </Pressable>
                    </View>
                )}
            />

            {isLoading ? (
                <ListSkeleton rows={7} />
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={(
                        <>
                            <View style={s.heroWrap}>
                                <UtilityHero
                                    title="Inventory Hub"
                                    subtitle="Stock, categories, barcode search, bulk actions, and quick stock adjustments."
                                    icon="archive-outline"
                                    tone="info"
                                />
                            </View>

                            <View style={s.statsRow}>
                                <HubMetricCard label="In Stock" value={String(stats.inStock)} meta="Healthy items" tone="success" />
                                <HubMetricCard label="Low Stock" value={String(stats.lowStock)} meta="Needs refill" tone="warning" />
                                <HubMetricCard label="Out of Stock" value={String(stats.outOfStock)} meta="Unavailable" tone="danger" />
                                <HubMetricCard label="Stock Value" value={`Rs ${(stats.stockValue / 1000).toFixed(1)}K`} meta={`${stats.total} items`} tone="info" />
                            </View>

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

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersRow}>
                                {INVENTORY_STOCK_FILTER_OPTIONS.map((option) => {
                                    const selected = stockFilter === option.key;
                                    return (
                                        <ChipButton
                                            key={option.key}
                                            label={option.label}
                                            selected={selected}
                                            tone={option.key === 'out' ? 'danger' : option.key === 'low' ? 'warning' : option.key === 'in' ? 'success' : 'info'}
                                            onPress={() => { void selection(); setStockFilter(option.key); }}
                                        />
                                    );
                                })}
                            </ScrollView>

                            {categories.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersRow}>
                                    <ChipButton label="All Categories" selected={!category} tone="info" onPress={() => setCategory(null)} />
                                    {categories.map((cat) => {
                                        const selected = category === cat;
                                        return (
                                            <ChipButton
                                                key={cat}
                                                label={cat}
                                                selected={selected}
                                                tone="info"
                                                onPress={() => setCategory(selected ? null : cat)}
                                            />
                                        );
                                    })}
                                </ScrollView>
                            ) : null}

                            {selectionMode ? (
                                <View style={s.bulkRow}>
                                    <Text style={[s.bulkLabel, { color: colors.textSecondary }]}>Selected: {selectedIds.length}</Text>
                                    <Pressable style={[s.bulkAction, { borderColor: colors.primary }]} onPress={openBulkGstSelector} disabled={!selectedIds.length || bulkUpdatingGst}>
                                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>{bulkUpdatingGst ? 'Applying...' : 'GST Slab'}</Text>
                                    </Pressable>
                                    <Pressable style={[s.bulkAction, { borderColor: colors.error }]} onPress={requestBulkDelete} disabled={!selectedIds.length || bulkDeleting}>
                                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 11 }}>{bulkDeleting ? 'Deleting...' : 'Delete'}</Text>
                                    </Pressable>
                                </View>
                            ) : (
                                <View style={s.actionRow}>
                                    <ChipButton
                                        label={selectionMode ? 'Cancel' : 'Select'}
                                        icon={selectionMode ? 'close' : 'check-circle-outline'}
                                        variant="action"
                                        tone="info"
                                        onPress={() => {
                                            void selection();
                                            setSelectionMode((current) => !current);
                                            setSelectedIds([]);
                                        }}
                                    />
                                    <ChipButton label="Bin" icon="delete-outline" variant="action" tone="warning" onPress={() => { void selection(); router.push('/(main)/inventory/recycle-bin' as Parameters<typeof router.push>[0]); }} />
                                </View>
                            )}
                        </>
                    )}
                    renderItem={({ item }) => (
                        <ItemRow
                            item={item}
                            colors={colors}
                            selectionMode={selectionMode}
                            selected={selectedIds.includes(item.id)}
                            onToggleSelect={() => setSelectedIds((current) => toggleId(current, item.id))}
                            onOpen={() => router.push(`/(main)/inventory/${item.id}` as Parameters<typeof router.push>[0])}
                            onQuickIn={() => {
                                if (!canUpdateItem) {
                                    dialog.alert('Access denied', 'Your role cannot update stock.');
                                    return;
                                }
                                void adjustStock({ itemId: item.id, type: 'IN', quantity: 1, reason: 'Quick +1 from list' }).catch((error) => {
                                    dialog.alert('Stock update failed', error instanceof Error ? error.message : 'Unable to update stock.');
                                });
                            }}
                            onQuickOut={() => {
                                if (!canUpdateItem) {
                                    dialog.alert('Access denied', 'Your role cannot update stock.');
                                    return;
                                }
                                void adjustStock({ itemId: item.id, type: 'OUT', quantity: 1, reason: 'Quick -1 from list' }).catch((error) => {
                                    dialog.alert('Stock update failed', error instanceof Error ? error.message : 'Unable to update stock.');
                                });
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    ListEmptyComponent={(
                        <EmptyStateCard
                            icon="cube-off-outline"
                            title="No items found"
                            subtitle={search.trim() ? 'Try a different name, barcode, category, or stock filter.' : 'Create your first item to start billing and stock tracking.'}
                            tone="info"
                            actionLabel={canCreateItem && !search.trim() ? 'Add Item' : undefined}
                            onActionPress={canCreateItem && !search.trim() ? () => {
                                void impact();
                                router.push('/(main)/inventory/add-item' as Parameters<typeof router.push>[0]);
                            } : undefined}
                        />
                    )}
                    refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => { void refetch(); }} tintColor={colors.primary} />}
                />
            )}

            {showSortSheet ? (
                <Pressable style={s.sortBackdrop} onPress={() => setShowSortSheet(false)}>
                    <View style={[s.sortSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[s.sortTitle, { color: colors.text }]}>Sort & Filter</Text>

                        <Text style={[s.sortSectionLabel, { color: colors.textSecondary }]}>SORT BY</Text>
                        <View style={s.sortRow}>
                            {INVENTORY_SORT_OPTIONS.map((opt) => {
                                return (
                                    <ChipButton
                                        key={opt.key}
                                        label={opt.label}
                                        selected={sortBy === opt.key}
                                        tone="info"
                                        onPress={() => { setSortBy(opt.key); }}
                                    />
                                );
                            })}
                        </View>

                        {units.length > 0 ? (
                            <>
                                <Text style={[s.sortSectionLabel, { color: colors.textSecondary }]}>UNIT</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={s.sortRow}>
                                        <ChipButton label="All" selected={!unit} tone="info" onPress={() => setUnit(null)} />
                                        {units.map((entry) => (
                                            <ChipButton
                                                key={entry}
                                                label={entry}
                                                selected={unit === entry}
                                                tone="info"
                                                onPress={() => setUnit(unit === entry ? null : entry)}
                                            />
                                        ))}
                                    </View>
                                </ScrollView>
                            </>
                        ) : null}

                        <Pressable style={[s.sortDoneBtn, { backgroundColor: colors.primary }]} onPress={() => setShowSortSheet(false)}>
                            <Text style={[s.sortDoneBtnText, { color: colors.onPrimary }]}>Done</Text>
                        </Pressable>
                    </View>
                </Pressable>
            ) : null}
        </SafeAreaView>
    );
}

function ItemRow({ item, colors, selectionMode, selected, onToggleSelect, onOpen, onQuickIn, onQuickOut }: {
    item: Item;
    colors: ColorPalette;
    selectionMode: boolean;
    selected: boolean;
    onToggleSelect: () => void;
    onOpen: () => void;
    onQuickIn: () => void;
    onQuickOut: () => void;
}) {
    const health = getStockHealth(item);
    const statusText = health === 'out' ? 'Out of Stock' : health === 'low' ? 'Low Stock' : 'In Stock';
    const statusColor = health === 'out' ? colors.error : health === 'low' ? colors.warning : colors.success;

    return (
        <SwipeableRow
            enabled={!selectionMode}
            leftActions={[
                { label: '+1', icon: 'plus', onPress: onQuickIn, tone: 'success' },
            ]}
            rightActions={[
                { label: '-1', icon: 'minus', onPress: onQuickOut, tone: 'danger' },
            ]}
        >
            <Pressable
                style={({ pressed }) => [
                    rowStyles.row,
                    {
                        backgroundColor: selected ? withAlpha(colors.primary, '20') : colors.card,
                        opacity: pressed ? 0.82 : 1,
                        borderColor: selected ? colors.primary : colors.border,
                    },
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
                    <Text style={[rowStyles.meta, { color: colors.textSecondary }]}>{item.sku ? `SKU: ${item.sku} - ` : ''}{item.unit || 'unit'}</Text>
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
        </SwipeableRow>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    topIconBtn: { ...getPillStyle(colors), width: 34, height: 34, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    filterBadge: { position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    filterBadgeText: { color: colors.onPrimary, fontSize: 9, fontWeight: '800' },
    heroWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: DESIGN_SPACING.screenX, paddingVertical: Spacing.xs, gap: Spacing.sm },
    searchRow: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.xs },
    filtersScroll: { flexGrow: 0, marginBottom: Spacing.xs },
    filtersRow: { paddingHorizontal: DESIGN_SPACING.screenX, gap: Spacing.xs, paddingVertical: 2, alignItems: 'center' },
    actionRow: { flexDirection: 'row', paddingHorizontal: DESIGN_SPACING.screenX, gap: Spacing.sm, marginBottom: Spacing.xs },
    bulkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.sm },
    bulkLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
    bulkAction: { ...getPillStyle(colors), borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
    sortBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(colors.text, '66'), justifyContent: 'flex-end' },
    sortSheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, ...getSurfaceStyle(colors, { floating: true, elevated: true }) },
    sortTitle: { fontSize: 15, fontWeight: '800', marginBottom: Spacing.xs },
    sortSectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: Spacing.xs },
    sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    sortDoneBtn: { marginTop: Spacing.sm, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
    sortDoneBtnText: { fontWeight: '700', fontSize: 14 },
});

const rowStyles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, marginHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.sm, borderRadius: Radius.card, gap: Spacing.md },
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
