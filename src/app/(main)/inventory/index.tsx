import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { itemApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useScannerMode } from '../../../hooks/useScannerMode';
import { useAuthStore } from '../../../store/authStore';
import type { Item } from '../../../types/domain';
import { canPerformAction } from '../../../utils/accessControl';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { useHaptics } from '../../../hooks/useHaptics';

type FilterType = 'all' | 'in' | 'low' | 'out';
const EMPTY_ITEMS: Item[] = [];

const getStockHealth = (item: Item): FilterType => {
    if (item.stock <= 0) return 'out';
    if (item.stock <= item.reorderLevel) return 'low';
    return 'in';
};

const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

export default function InventoryScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const queryClient = useQueryClient();
    const params = useLocalSearchParams<{ search?: string | string[]; scanAt?: string | string[] }>();
    const scanner = useScannerMode();
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const canCreateItem = canPerformAction(role, 'inventory.create', subscription);
    const canUpdateItem = canPerformAction(role, 'inventory.update', subscription);
    const canDeleteItem = canPerformAction(role, 'inventory.delete', subscription);
    const dialog = useAppDialog();
    const { selection, impact } = useHaptics();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const openInfoDialog = (title: string, message: string) => {
        dialog.alert(title, message);
    };

    const openConfirmDialog = (title: string, message: string, onConfirm: () => void, destructive = false) => {
        dialog.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: destructive ? 'Delete' : 'Apply',
                style: destructive ? 'destructive' : 'default',
                onPress: onConfirm,
            },
        ]);
    };

    useEffect(() => {
        const scannedSearch = Array.isArray(params.search) ? params.search[0] : params.search;
        if (scannedSearch) {
            setSearch(scannedSearch);
        }
    }, [params.search, params.scanAt]);

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['items', search],
        queryFn: () => itemApi.list({ q: search || undefined, limit: 300 }),
        staleTime: 30_000,
    });

    const items: Item[] = data?.items ?? EMPTY_ITEMS;

    useEffect(() => {
        if (!selectionMode) return;
        const validIds = new Set(items.map((entry) => entry.id));
        setSelectedIds((current) => current.filter((entry) => validIds.has(entry)));
    }, [items, selectionMode]);

    const stats = useMemo(() => {
        let inStock = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let stockValue = 0;

        for (const item of items) {
            const health = getStockHealth(item);
            if (health === 'in') inStock += 1;
            if (health === 'low') lowStock += 1;
            if (health === 'out') outOfStock += 1;
            stockValue += Number(item.salePrice ?? 0) * Number(item.stock ?? 0);
        }
        return { inStock, lowStock, outOfStock, stockValue };
    }, [items]);

    const filteredItems = useMemo(() => {
        if (filter === 'all') return items;
        return items.filter((item) => getStockHealth(item) === filter);
    }, [items, filter]);

    const { mutate: quickAdjustStock } = useMutation({
        mutationFn: (payload: { itemId: string; type: 'IN' | 'OUT'; quantity: number }) =>
            itemApi.adjustStock(payload.itemId, {
                type: payload.type,
                quantity: payload.quantity,
                reason: payload.type === 'IN' ? 'Quick +1 from list' : 'Quick -1 from list',
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
        },
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
        onError: (error) => {
            openInfoDialog('Bulk delete failed', error instanceof Error ? error.message : 'Unable to delete selected items.');
        },
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
        onError: (error) => {
            openInfoDialog('Bulk update failed', error instanceof Error ? error.message : 'Unable to update selected items.');
        },
    });

    const selectedCount = selectedIds.length;

    const handleScanPress = () => {
        if (scanner.canUseCameraScanner) {
            router.push('/scan?target=stock' as Parameters<typeof router.push>[0]);
            return;
        }
        if (!scanner.barcodeEnabled) {
            openInfoDialog('Scanner disabled', 'Enable barcode scanning in Settings > Item Settings.');
            return;
        }
        openInfoDialog('USB scanner mode', 'Use a connected USB scanner and scan into the search input.');
    };

    const requestBulkDelete = () => {
        if (selectedCount === 0) return;
        if (!canDeleteItem) {
            openInfoDialog('Access denied', 'Your role cannot delete inventory items.');
            return;
        }
        openConfirmDialog(
            'Delete selected items',
            `Move ${selectedCount} item(s) to recycle bin?`,
            () => bulkDelete(selectedIds),
            true
        );
    };

    const requestBulkGst = (rate: number) => {
        if (selectedCount === 0) return;
        if (!canUpdateItem) {
            openInfoDialog('Access denied', 'Your role cannot update inventory items.');
            return;
        }
        openConfirmDialog(
            'Bulk GST update',
            `Set GST rate to ${rate}% for ${selectedCount} item(s)?`,
            () => bulkGstUpdate({ ids: selectedIds, gstRate: rate })
        );
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Inventory"
                subtitle="Items, stock, categories and units"
                rightAction={(
                    <View style={s.topActions}>
                        <Pressable
                            style={[s.topIconBtn, { borderColor: colors.border }]}
                            onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}
                        >
                            <MaterialCommunityIcons name="compass-outline" size={18} color={colors.primary} />
                        </Pressable>
                        <Pressable
                            style={[s.topIconBtn, { borderColor: canCreateItem ? colors.primary : colors.border, backgroundColor: canCreateItem ? colors.primary : colors.border }]}
                            onPress={() => {
                                if (!canCreateItem) {
                                    openInfoDialog('Access denied', 'Your role cannot create inventory items.');
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

            <View style={s.actionBar}>
                <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Controls</Text>
                <View style={s.actionRow}>
                    <Pressable style={[s.actionChip, { borderColor: colors.border }]} onPress={() => {
                        void selection();
                        setSelectionMode((current) => !current);
                        setSelectedIds([]);
                    }}>
                        <MaterialCommunityIcons name={selectionMode ? 'close' : 'check-circle-outline'} size={14} color={colors.textSecondary} />
                        <Text style={[s.actionChipText, { color: colors.textSecondary }]}>
                            {selectionMode ? 'Cancel' : 'Select'}
                        </Text>
                    </Pressable>
                    <Pressable style={[s.actionChip, { borderColor: colors.border }]} onPress={() => {
                        void selection();
                        router.push('/(main)/inventory/recycle-bin' as Parameters<typeof router.push>[0]);
                    }}>
                        <MaterialCommunityIcons name="delete-outline" size={14} color={colors.textSecondary} />
                        <Text style={[s.actionChipText, { color: colors.textSecondary }]}>Bin</Text>
                    </Pressable>
                </View>
            </View>

            <View style={s.searchRow}>
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder={scanner.isUsbScannerMode ? 'Scan via USB or type search...' : 'Search by name or barcode...'}
                    showScanAction
                    scanLabel={scanner.canUseCameraScanner ? 'Scan' : scanner.isUsbScannerMode ? 'USB' : 'Off'}
                    onScanPress={handleScanPress}
                />
            </View>

            {scanner.isUsbScannerMode ? (
                <Text style={[s.inlineHint, { color: colors.textSecondary }]}>
                    USB scanner mode is active. Focus search and scan from hardware scanner.
                </Text>
            ) : null}

            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Stock Health</Text>
            <View style={[s.statsCard, { backgroundColor: withAlpha(colors.primary, '15') }]}>
                <View style={s.statsRow}>
                    <StatChip label="In Stock" value={stats.inStock} color={colors.success} mutedColor={colors.textSecondary} />
                    <StatChip label="Low" value={stats.lowStock} color={colors.warning} mutedColor={colors.textSecondary} />
                    <StatChip label="Out" value={stats.outOfStock} color={colors.error} mutedColor={colors.textSecondary} />
                </View>
                <Text style={[s.stockValue, { color: colors.text }]}>
                    Stock Value: Rs {stats.stockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
            </View>

            <View style={s.filters}>
                {([
                    ['all', 'All'],
                    ['in', 'In Stock'],
                    ['low', 'Low Stock'],
                    ['out', 'Out of Stock'],
                ] as const).map(([value, label]) => {
                    const selected = filter === value;
                    return (
                        <Pressable
                            key={value}
                            style={[s.filterChip, selected && { backgroundColor: colors.primary }]}
                            onPress={() => setFilter(value)}
                        >
                            <Text style={[s.filterText, selected && { color: colors.onPrimary, fontWeight: '700' }]}>{label}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {selectionMode ? (
                <View style={s.bulkRow}>
                    <Text style={[s.bulkLabel, { color: colors.textSecondary }]}>
                        Selected: {selectedCount}
                    </Text>
                    <Pressable style={[s.bulkAction, { borderColor: colors.primary }]} onPress={() => requestBulkGst(18)} disabled={selectedCount === 0 || bulkUpdatingGst}>
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>
                            {bulkUpdatingGst ? 'Applying...' : 'GST 18%'}
                        </Text>
                    </Pressable>
                    <Pressable style={[s.bulkAction, { borderColor: colors.error }]} onPress={requestBulkDelete} disabled={selectedCount === 0 || bulkDeleting}>
                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 11 }}>
                            {bulkDeleting ? 'Deleting...' : 'Delete'}
                        </Text>
                    </Pressable>
                </View>
            ) : null}

            {isLoading ? (
                <ListSkeleton rows={7} />
            ) : (
                <FlatList
                    data={filteredItems}
                    keyExtractor={(item) => item.id}
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
                                    openInfoDialog('Access denied', 'Your role cannot update stock.');
                                    return;
                                }
                                quickAdjustStock({ itemId: item.id, type: 'IN', quantity: 1 });
                            }}
                            onQuickOut={() => {
                                if (!canUpdateItem) {
                                    openInfoDialog('Access denied', 'Your role cannot update stock.');
                                    return;
                                }
                                quickAdjustStock({ itemId: item.id, type: 'OUT', quantity: 1 });
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary, marginBottom: Spacing.sm }}>No items found.</Text>
                            {canCreateItem ? (
                                <Pressable
                                    style={[s.emptyAddBtn, { backgroundColor: colors.primary }]}
                                    onPress={() => {
                                        void impact();
                                        router.push('/(main)/inventory/add-item' as Parameters<typeof router.push>[0]);
                                    }}
                                >
                                    <Text style={s.emptyAddBtnText}>Add Item</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    }
                    refreshControl={(
                        <RefreshControl
                            refreshing={isRefetching && !isLoading}
                            onRefresh={() => {
                                void refetch();
                            }}
                            tintColor={colors.primary}
                        />
                    )}
                />
            )}
        </SafeAreaView>
    );
}

function StatChip({
    label,
    value,
    color,
    mutedColor,
}: {
    label: string;
    value: number;
    color: string;
    mutedColor: string;
}) {
    return (
        <View style={[rowStyles.statChip, { borderColor: color }]}>
            <Text style={[rowStyles.statValue, { color }]}>{value}</Text>
            <Text style={[rowStyles.statLabel, { color: mutedColor }]}>{label}</Text>
        </View>
    );
}

function ItemRow({
    item,
    colors,
    selectionMode,
    selected,
    onToggleSelect,
    onOpen,
    onQuickIn,
    onQuickOut,
}: {
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
        <Pressable
            style={({ pressed }) => [
                rowStyles.row,
                {
                    backgroundColor: selected ? withAlpha(colors.primary, '20') : colors.card,
                    opacity: pressed ? 0.8 : 1,
                    borderColor: selected ? colors.primary : colors.border,
                    borderWidth: 1,
                },
            ]}
            onPress={selectionMode ? onToggleSelect : onOpen}
        >
            {selectionMode ? (
                <View style={[rowStyles.selector, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? withAlpha(colors.primary, '22') : 'transparent' }]}>
                    <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                        {selected ? 'ON' : 'OFF'}
                    </Text>
                </View>
            ) : null}
            <View style={rowStyles.info}>
                <Text style={[rowStyles.name, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={[rowStyles.meta, { color: colors.textSecondary }]}>
                    {item.sku ? `SKU: ${item.sku} - ` : ''}{item.unit || 'unit'}
                </Text>
                {item.barcode ? (
                    <Text style={[rowStyles.meta, { color: colors.textSecondary }]}>Barcode: {item.barcode}</Text>
                ) : null}
                <Text style={[rowStyles.status, { color: statusColor }]}>{statusText}</Text>
            </View>

            <View style={rowStyles.right}>
                <Text style={[rowStyles.price, { color: colors.text }]}>
                    Rs {Number(item.salePrice ?? 0).toLocaleString('en-IN')}
                </Text>
                <Text style={[rowStyles.stock, { color: statusColor }]}>
                    {item.stock} {item.unit || ''}
                </Text>
                {selectionMode ? null : (
                    <View style={rowStyles.quickRow}>
                        <Pressable style={[rowStyles.quickBtn, { backgroundColor: colors.success }]} onPress={onQuickIn}>
                            <Text style={[rowStyles.quickBtnText, { color: colors.onPrimary }]}>+1</Text>
                        </Pressable>
                        <Pressable style={[rowStyles.quickBtn, { backgroundColor: colors.error }]} onPress={onQuickOut}>
                            <Text style={[rowStyles.quickBtnText, { color: colors.onPrimary }]}>-1</Text>
                        </Pressable>
                    </View>
                )}
            </View>
        </Pressable>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        topActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
        },
        topIconBtn: {
            width: 34,
            height: 34,
            borderWidth: 1,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
        },
        actionBar: {
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.xs,
        },
        sectionLabel: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
            letterSpacing: 0.8,
            marginBottom: Spacing.xs,
            textTransform: 'uppercase',
        },
        actionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            flexWrap: 'wrap',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.card,
            backgroundColor: colors.card,
            padding: Spacing.sm,
        },
        actionChip: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        actionChipText: { fontWeight: '700', fontSize: 12 },
        searchRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
        inlineHint: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, fontSize: 11 },
        statsCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.sm },
        statsRow: { flexDirection: 'row', gap: Spacing.sm },
        stockValue: { marginTop: Spacing.sm, fontWeight: '700', fontSize: 13 },
        filters: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, flexWrap: 'wrap' },
        filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: colors.surfaceVariant },
        filterText: { fontSize: 12, color: colors.textSecondary },
        bulkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        bulkLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
        bulkAction: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        centered: { paddingTop: 80, alignItems: 'center' },
        emptyAddBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
        },
        emptyAddBtnText: {
            color: colors.onPrimary,
            fontWeight: '700',
            fontSize: Typography.body.size,
        },
    });

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
        borderRadius: Radius.card,
        gap: Spacing.md,
    },
    selector: {
        width: 42,
        borderWidth: 1,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    info: { flex: 1 },
    right: { alignItems: 'flex-end', minWidth: 120 },
    name: { fontWeight: '700', fontSize: 14 },
    meta: { fontSize: 11, marginTop: 2 },
    status: { fontSize: 11, fontWeight: '700', marginTop: 4 },
    price: { fontWeight: '700', fontSize: 14 },
    stock: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    quickRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    quickBtn: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    quickBtnText: { fontSize: 11, fontWeight: '700' },
    statChip: {
        flex: 1,
        borderWidth: 1,
        borderRadius: Radius.md,
        paddingVertical: 6,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    statValue: { fontSize: 16, fontWeight: '800' },
    statLabel: { fontSize: 10, marginTop: 2, fontWeight: '600' },
});

