import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemApi } from '../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { useScannerMode } from '../../hooks/useScannerMode';
import type { Item } from '../../types/domain';

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

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        const scannedSearch = Array.isArray(params.search) ? params.search[0] : params.search;
        if (scannedSearch) {
            setSearch(scannedSearch);
        }
    }, [params.search, params.scanAt]);

    const { data, isLoading } = useQuery({
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
            Alert.alert('Bulk delete failed', error instanceof Error ? error.message : 'Unable to delete selected items.');
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
            Alert.alert('Bulk update failed', error instanceof Error ? error.message : 'Unable to update selected items.');
        },
    });

    const selectedCount = selectedIds.length;

    const handleScanPress = () => {
        if (scanner.canUseCameraScanner) {
            router.push('/scan?target=stock' as Parameters<typeof router.push>[0]);
            return;
        }
        if (!scanner.barcodeEnabled) {
            Alert.alert('Scanner disabled', 'Enable barcode scanning in Settings > Item Settings.');
            return;
        }
        Alert.alert('USB scanner mode', 'Use a connected USB scanner and scan into the search input.');
    };

    const requestBulkDelete = () => {
        if (selectedCount === 0) return;
        Alert.alert(
            'Delete selected items',
            `Move ${selectedCount} item(s) to recycle bin?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => bulkDelete(selectedIds) },
            ]
        );
    };

    const requestBulkGst = (rate: number) => {
        if (selectedCount === 0) return;
        Alert.alert(
            'Bulk GST update',
            `Set GST rate to ${rate}% for ${selectedCount} item(s)?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Apply', onPress: () => bulkGstUpdate({ ids: selectedIds, gstRate: rate }) },
            ]
        );
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Text style={s.title}>Inventory</Text>
                <View style={s.headerActions}>
                    <Pressable style={[s.headerChip, { borderColor: colors.border }]} onPress={() => {
                        setSelectionMode((current) => !current);
                        setSelectedIds([]);
                    }}>
                        <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                            {selectionMode ? 'Cancel' : 'Select'}
                        </Text>
                    </Pressable>
                    <Pressable style={[s.headerChip, { borderColor: colors.border }]} onPress={() => router.push('/(main)/inventory/recycle-bin' as Parameters<typeof router.push>[0])}>
                        <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>Bin</Text>
                    </Pressable>
                    <Pressable style={s.addBtn} onPress={() => router.push('/(main)/inventory/add-item' as Parameters<typeof router.push>[0])}>
                        <Text style={s.addBtnText}>+ Add</Text>
                    </Pressable>
                </View>
            </View>

            <View style={s.searchRow}>
                <TextInput
                    style={[s.searchInput, { color: colors.text }]}
                    placeholder={scanner.isUsbScannerMode ? 'Scan via USB or type search...' : 'Search by name or barcode...'}
                    placeholderTextColor={colors.textSecondary}
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                />
                <Pressable
                    style={[s.scanBtn, { backgroundColor: colors.surfaceVariant }]}
                    onPress={handleScanPress}
                >
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>
                        {scanner.canUseCameraScanner ? 'Scan' : scanner.isUsbScannerMode ? 'USB' : 'Off'}
                    </Text>
                </Pressable>
            </View>

            {scanner.isUsbScannerMode ? (
                <Text style={[s.inlineHint, { color: colors.textSecondary }]}>
                    USB scanner mode is active. Focus search and scan from hardware scanner.
                </Text>
            ) : null}

            <View style={[s.statsCard, { backgroundColor: `${colors.primary}15` }]}>
                <View style={s.statsRow}>
                    <StatChip label="In Stock" value={stats.inStock} color={colors.success} />
                    <StatChip label="Low" value={stats.lowStock} color={colors.warning} />
                    <StatChip label="Out" value={stats.outOfStock} color={colors.error} />
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
                            <Text style={[s.filterText, selected && { color: '#fff', fontWeight: '700' }]}>{label}</Text>
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
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
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
                            onQuickIn={() => quickAdjustStock({ itemId: item.id, type: 'IN', quantity: 1 })}
                            onQuickOut={() => quickAdjustStock({ itemId: item.id, type: 'OUT', quantity: 1 })}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary }}>No items found.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <View style={[rowStyles.statChip, { borderColor: color }]}>
            <Text style={[rowStyles.statValue, { color }]}>{value}</Text>
            <Text style={rowStyles.statLabel}>{label}</Text>
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
                    backgroundColor: selected ? `${colors.primary}20` : colors.card,
                    opacity: pressed ? 0.8 : 1,
                    borderColor: selected ? colors.primary : 'transparent',
                    borderWidth: selected ? 1 : 0,
                },
            ]}
            onPress={selectionMode ? onToggleSelect : onOpen}
        >
            {selectionMode ? (
                <View style={[rowStyles.selector, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}22` : 'transparent' }]}>
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
                            <Text style={rowStyles.quickBtnText}>+1</Text>
                        </Pressable>
                        <Pressable style={[rowStyles.quickBtn, { backgroundColor: colors.error }]} onPress={onQuickOut}>
                            <Text style={rowStyles.quickBtnText}>-1</Text>
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
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
        },
        title: { fontSize: Typography.headline.size, fontWeight: '700', color: colors.text },
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
        headerChip: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        addBtn: { backgroundColor: colors.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
        addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
        searchRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
        searchInput: {
            flex: 1,
            backgroundColor: colors.surfaceVariant,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            fontSize: 14,
        },
        scanBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            minWidth: 60,
            alignItems: 'center',
        },
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
    quickBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    statChip: {
        flex: 1,
        borderWidth: 1,
        borderRadius: Radius.md,
        paddingVertical: 6,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    statValue: { fontSize: 16, fontWeight: '800' },
    statLabel: { fontSize: 10, marginTop: 2, color: '#6b7280', fontWeight: '600' },
});
