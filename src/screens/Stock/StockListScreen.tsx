
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Chip, Text, FAB, SegmentedButtons, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStock } from '../../hooks/useStock';
import { useAuth } from '../../hooks/useAuth';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Skeleton } from '../../components/feedback/Skeleton';
import { getCurvedTabOverlayOffset, getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { DesignSystem } from '../../constants/DesignSystem';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { getStockHealth, resolveLowStockThreshold } from '../../utils/stockStatus';
import { useSettingsStore } from '../../store';
import { Config } from '../../constants/Config';
import type { Item } from '../../types';
import { StockAdjustmentDialog } from '../../components/stock/StockAdjustmentDialog';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';

type StockScope = 'all' | 'in' | 'low' | 'out';
type StockHealthMeta = { health: ReturnType<typeof getStockHealth>; threshold: number };
const STOCK_ROW_HEIGHT = 118;

export const StockListScreen = () => {
    const { items, loading, searchQuery, setSearchQuery, searchPending, fetchItems, adjustStock } = useStock();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ search?: string | string[] }>();
    const { canManageInventory } = useOrganizationAccess();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);
    const [refreshing, setRefreshing] = useState(false);
    const [adjustmentItem, setAdjustmentItem] = useState<Item | null>(null);
    const [stockScope, setStockScope] = useState<StockScope>('all');
    const tabOverlayOffset = getCurvedTabOverlayOffset(insets.bottom);
    const listBottomPadding = getTabAwareBottomSpacing(insets.bottom, 104);
    const useWideWorkspace = width >= 1020;

    const handleAdjustSubmit = async (qty: number, type: 'IN' | 'OUT', reason: string) => {
        if (!adjustmentItem) return;
        try {
            await adjustStock(adjustmentItem.id, qty, type, reason);
            setAdjustmentItem(null);
        } catch (error) {
            throw error;
        }
    };

    useEffect(() => {
        const scannedSearch = Array.isArray(params.search) ? params.search[0] : params.search;
        if (scannedSearch) {
            setSearchQuery(scannedSearch);
        }
    }, [params.search, setSearchQuery]);

    useFocusRefresh(fetchItems, {
        enabled: canManageInventory,
        minIntervalMs: 10_000,
    });

    const onRefresh = useCallback(async () => {
        if (!canManageInventory) return;
        setRefreshing(true);
        try {
            await fetchItems();
        } finally {
            setRefreshing(false);
        }
    }, [canManageInventory, fetchItems]);

    const stockMetaById = useMemo(() => {
        const output = new Map<string, StockHealthMeta>();
        for (const item of items) {
            output.set(item.id, {
                health: getStockHealth(item),
                threshold: resolveLowStockThreshold(item),
            });
        }
        return output;
    }, [items]);

    const inventoryStats = useMemo(() => {
        let inStock = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let stockValue = 0;

        for (const item of items) {
            const health = stockMetaById.get(item.id)?.health ?? getStockHealth(item);
            if (health === 'out') {
                outOfStock += 1;
            } else if (health === 'low') {
                lowStock += 1;
            } else {
                inStock += 1;
            }
            stockValue += item.stock * item.price;
        }

        return { inStock, lowStock, outOfStock, stockValue };
    }, [items, stockMetaById]);

    const scopedItems = useMemo(() => {
        if (stockScope === 'all') return items;
        if (stockScope === 'in') return items.filter((item) => (stockMetaById.get(item.id)?.health ?? 'in') === 'in');
        if (stockScope === 'low') return items.filter((item) => (stockMetaById.get(item.id)?.health ?? 'in') === 'low');
        return items.filter((item) => (stockMetaById.get(item.id)?.health ?? 'in') === 'out');
    }, [items, stockMetaById, stockScope]);

    const attentionItems = useMemo(() => {
        return items
            .filter((item) => (stockMetaById.get(item.id)?.health ?? 'in') !== 'in')
            .sort((a, b) => {
                const rank = (entry: Item) => {
                    const health = stockMetaById.get(entry.id)?.health ?? 'in';
                    if (health === 'out') return 0;
                    if (health === 'low') return 1;
                    return 2;
                };
                return rank(a) - rank(b);
            })
            .slice(0, 6);
    }, [items, stockMetaById]);

    const getStockStatus = useCallback((item: Item) => {
        const meta = stockMetaById.get(item.id);
        const health = meta?.health ?? getStockHealth(item);
        const lowStockThreshold = meta?.threshold ?? resolveLowStockThreshold(item);

        if (health === 'out') {
            return {
                label: 'Out of stock',
                backgroundColor: theme.colors.errorContainer,
                textColor: theme.colors.onErrorContainer,
            };
        }
        if (health === 'low') {
            return {
                label: `Low stock (<= ${lowStockThreshold})`,
                backgroundColor: theme.colors.secondaryContainer,
                textColor: theme.colors.onSecondaryContainer,
            };
        }
        return {
            label: 'In stock',
            backgroundColor: theme.colors.primaryContainer,
            textColor: theme.colors.onPrimaryContainer,
        };
    }, [
        stockMetaById,
        theme.colors.errorContainer,
        theme.colors.onErrorContainer,
        theme.colors.secondaryContainer,
        theme.colors.onSecondaryContainer,
        theme.colors.primaryContainer,
        theme.colors.onPrimaryContainer,
    ]);

    const renderItem = useCallback(({ item, index }: { item: Item; index: number }) => {
        const status = getStockStatus(item);
        const stockHealth = stockMetaById.get(item.id)?.health ?? getStockHealth(item);
        const needsAttention = stockHealth !== 'in';

        return (
            <AppCard
                animationDelay={Math.min(index * 24, 220)}
                onPress={() => router.push(`/item/${item.id}`)}
                style={{ backgroundColor: needsAttention ? theme.colors.elevation.level2 : undefined }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                            {item.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginRight: 8 }}>
                                Qty: {item.stock}
                            </Text>
                            <Chip
                                compact
                                style={{ backgroundColor: status.backgroundColor, height: 24, marginRight: 8 }}
                                textStyle={{ color: status.textColor, marginVertical: -2 }}
                            >
                                {status.label}
                            </Chip>
                        </View>
                        {!!item.barcode && (
                            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
                                Barcode: {item.barcode}
                            </Text>
                        )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text variant="titleMedium" style={{ color: theme.colors.primary, marginBottom: 8 }}>
                            {formatCurrency(item.price, activeCurrency)}
                        </Text>
                        <AppButton
                            mode="text"
                            compact
                            onPress={() => setAdjustmentItem(item)}
                        >
                            Adjust
                        </AppButton>
                    </View>
                </View>
            </AppCard>
        );
    }, [activeCurrency, getStockStatus, router, stockMetaById, theme.colors.elevation.level2, theme.colors.onSurface, theme.colors.outline, theme.colors.primary]);

    return (
        <ScreenWrapper>
            {!canManageInventory ? (
                <View style={styles.blockedContainer}>
                    <AppCard animationDelay={40} style={styles.blockedCard}>
                        <Text variant="titleMedium" style={styles.blockedTitle}>
                            Inventory access is disabled
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            Ask owner/admin to enable inventory permissions for your account.
                        </Text>
                    </AppCard>
                </View>
            ) : (
                <View style={styles.content}>
                    <View style={[styles.contentInner, useWideWorkspace && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title="Inventory"
                            subtitle={`${items.length} items tracked`}
                            right={(
                                <AppButton mode="contained-tonal" compact onPress={() => router.push('/item/new')}>
                                    Add
                                </AppButton>
                            )}
                        />
                        <AppCard animationDelay={40} style={{ backgroundColor: theme.colors.primaryContainer }}>
                            <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.onPrimaryContainer }}>
                                Inventory
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                                {items.length} item(s) | {inventoryStats.lowStock} low | {inventoryStats.outOfStock} out
                            </Text>
                            <Text variant="titleSmall" style={{ color: theme.colors.onPrimaryContainer, marginTop: 6, fontWeight: '700' }}>
                                Stock Value: {formatCurrency(inventoryStats.stockValue, activeCurrency)}
                            </Text>
                            <View style={styles.heroChipRow}>
                                <Chip compact style={{ backgroundColor: theme.colors.surface }}>In stock: {inventoryStats.inStock}</Chip>
                                <Chip compact style={{ backgroundColor: theme.colors.surface }}>Low: {inventoryStats.lowStock}</Chip>
                                <Chip compact style={{ backgroundColor: theme.colors.surface }}>Out: {inventoryStats.outOfStock}</Chip>
                            </View>
                        </AppCard>

                        <View style={styles.searchRow}>
                            <AppInput
                                label="Search item"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Name or barcode"
                                inputType="search"
                                style={styles.searchInput}
                            />
                            <AppButton
                                mode="contained-tonal"
                                compact
                                icon="barcode-scan"
                                onPress={() => router.push({ pathname: '/scan', params: { target: 'stock' } })}
                                style={styles.scanAction}
                            >
                                Scan
                            </AppButton>
                        </View>
                        {searchPending && (
                            <Text variant="labelSmall" style={{ marginBottom: 8, color: theme.colors.outline }}>
                                Updating search...
                            </Text>
                        )}

                        <SegmentedButtons
                            value={stockScope}
                            onValueChange={(value) => setStockScope(value as StockScope)}
                            buttons={[
                                { value: 'all', label: `All (${items.length})` },
                                { value: 'in', label: `In (${inventoryStats.inStock})` },
                                { value: 'low', label: `Low (${inventoryStats.lowStock})` },
                                { value: 'out', label: `Out (${inventoryStats.outOfStock})` },
                            ]}
                            style={styles.scopeSelector}
                        />

                        {loading ? (
                            <View>
                                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={80} style={{ marginBottom: 12 }} />)}
                            </View>
                        ) : (
                            <View style={[styles.workspaceGrid, useWideWorkspace && styles.workspaceGridWide]}>
                                <View style={[styles.listPane, useWideWorkspace && styles.listPaneWide]}>
                                    <FlatList
                                        data={scopedItems}
                                        keyExtractor={item => item.id}
                                        renderItem={renderItem}
                                        refreshControl={
                                            <RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} />
                                        }
                                        keyboardShouldPersistTaps="handled"
                                        initialNumToRender={12}
                                        maxToRenderPerBatch={8}
                                        windowSize={5}
                                        updateCellsBatchingPeriod={50}
                                        removeClippedSubviews={Platform.OS !== 'web'}
                                        getItemLayout={(_, index) => ({
                                            length: STOCK_ROW_HEIGHT,
                                            offset: STOCK_ROW_HEIGHT * index,
                                            index,
                                        })}
                                        showsVerticalScrollIndicator={false}
                                        contentContainerStyle={{ paddingBottom: listBottomPadding }}
                                        ListEmptyComponent={(
                                            <AppCard animationDelay={80} style={styles.emptyCard}>
                                                <Text style={{ textAlign: 'center', color: theme.colors.outline }}>
                                                    No items found in this scope.
                                                </Text>
                                                <AppButton mode="contained-tonal" onPress={() => router.push('/item/new')} style={styles.emptyAction}>
                                                    Add Your First Item
                                                </AppButton>
                                            </AppCard>
                                        )}
                                    />
                                </View>

                                {useWideWorkspace && (
                                    <View style={styles.sidePane}>
                                        <AppCard animationDelay={90}>
                                            <Text variant="titleSmall" style={styles.sidePaneTitle}>Inventory Health</Text>
                                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                                Keep low and out-of-stock items under control for smoother billing.
                                            </Text>
                                            <View style={styles.healthMetricRow}>
                                                <Text variant="bodySmall">In stock</Text>
                                                <Text variant="bodyMedium" style={{ fontWeight: '700' }}>{inventoryStats.inStock}</Text>
                                            </View>
                                            <View style={styles.healthMetricRow}>
                                                <Text variant="bodySmall">Low stock</Text>
                                                <Text variant="bodyMedium" style={{ fontWeight: '700', color: theme.colors.error }}>{inventoryStats.lowStock}</Text>
                                            </View>
                                            <View style={styles.healthMetricRow}>
                                                <Text variant="bodySmall">Out of stock</Text>
                                                <Text variant="bodyMedium" style={{ fontWeight: '700', color: theme.colors.error }}>{inventoryStats.outOfStock}</Text>
                                            </View>
                                        </AppCard>

                                        <AppCard animationDelay={110}>
                                            <Text variant="titleSmall" style={styles.sidePaneTitle}>Needs Attention</Text>
                                            {attentionItems.length === 0 ? (
                                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                                    All tracked items are healthy.
                                                </Text>
                                            ) : (
                                                attentionItems.map((item) => (
                                                    <View key={`attention-${item.id}`} style={[styles.attentionRow, { borderTopColor: theme.colors.outline }]}>
                                                        <Text variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>{item.name}</Text>
                                                        <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                                                            Qty {item.stock}
                                                        </Text>
                                                    </View>
                                                ))
                                            )}
                                        </AppCard>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    <FAB
                        icon="plus"
                        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: tabOverlayOffset + 12 }]}
                        color={theme.colors.onPrimary}
                        onPress={() => router.push('/item/new')}
                    />

                    <StockAdjustmentDialog
                        visible={!!adjustmentItem}
                        onDismiss={() => setAdjustmentItem(null)}
                        onSubmit={handleAdjustSubmit}
                        itemName={adjustmentItem?.name || ''}
                        currentStock={adjustmentItem?.stock || 0}
                    />
                </View>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    blockedContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    blockedCard: {
        width: '100%',
        maxWidth: DesignSystem.layout.compactMaxWidth,
        alignSelf: 'center',
    },
    blockedTitle: {
        fontWeight: '700',
    },
    content: {
        flex: 1,
        paddingTop: DesignSystem.layout.pageTop,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.contentMaxWidth,
    },
    heroChipRow: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    scopeSelector: {
        marginBottom: 12,
    },
    workspaceGrid: {
        gap: 12,
    },
    workspaceGridWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    listPane: {
        minWidth: 0,
    },
    listPaneWide: {
        flex: 1.2,
    },
    sidePane: {
        flex: 0.8,
        gap: 10,
    },
    sidePaneTitle: {
        fontWeight: '700',
        marginBottom: 8,
    },
    healthMetricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    attentionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    searchInput: {
        flex: 1,
        marginBottom: 0,
    },
    scanAction: {
        minWidth: 88,
    },
    emptyCard: {
        marginTop: 20,
    },
    emptyAction: {
        marginTop: 10,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 8,
    },
});
