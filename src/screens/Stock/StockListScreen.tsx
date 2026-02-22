
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Chip, Text, FAB, SegmentedButtons, useTheme, Searchbar, Avatar, IconButton } from 'react-native-paper';
import { AppRefreshControl } from '../../components/common/AppRefreshControl';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStock } from '../../hooks/useStock';
import { useAuth } from '../../hooks/useAuth';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
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
                style={{ backgroundColor: needsAttention ? theme.colors.elevation.level2 : theme.colors.surface }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                        {/* Avatar for Item */}
                        <Avatar.Text
                            size={48}
                            label={item.name.substring(0, 2).toUpperCase()}
                            style={{ backgroundColor: theme.colors.primaryContainer, marginRight: 16 }}
                            color={theme.colors.primary}
                        />
                        <View style={{ flex: 1 }}>
                            <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                                {item.name}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    Qty: {item.stock}
                                </Text>
                                <Chip
                                    compact
                                    style={{ backgroundColor: status.backgroundColor, height: 24 }}
                                    textStyle={{ color: status.textColor, marginVertical: -2, fontSize: 11 }}
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
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text variant="titleMedium" style={{ color: theme.colors.primary, marginBottom: 8, fontWeight: 'bold' }}>
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
    }, [activeCurrency, getStockStatus, router, stockMetaById, theme.colors.elevation.level2, theme.colors.onSurface, theme.colors.outline, theme.colors.primary, theme.colors.primaryContainer, theme.colors.surface]);

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
                        <FlatList
                            data={loading ? [] : scopedItems}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            refreshControl={
                                <AppRefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} />
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
                            ListHeaderComponent={(
                                <View>
                                    <PageHeaderCard
                                        title="Inventory"
                                        subtitle={`${items.length} items tracked`}
                                        right={(
                                            <AppButton mode="contained" icon="plus" onPress={() => router.push('/item/new')}>
                                                Add New
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
                                        <Searchbar
                                            placeholder="Search by name or barcode"
                                            onChangeText={setSearchQuery}
                                            value={searchQuery}
                                            style={[styles.searchInput, { backgroundColor: theme.colors.surfaceVariant }]}
                                            inputStyle={{ minHeight: 0 }}
                                            elevation={0}
                                        />
                                        <IconButton
                                            icon="barcode-scan"
                                            mode="contained"
                                            containerColor={theme.colors.secondaryContainer}
                                            iconColor={theme.colors.onSecondaryContainer}
                                            size={28}
                                            onPress={() => router.push({ pathname: '/scan', params: { target: 'stock' } })}
                                            style={styles.scanAction}
                                        />
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
                                            { value: 'all', label: 'All' },
                                            { value: 'in', label: 'In Stock' },
                                            { value: 'low', label: 'Low Stock' },
                                            { value: 'out', label: 'Out of Stock' },
                                        ]}
                                        style={styles.scopeSelector}
                                        density="medium"
                                    />

                                    {loading && (
                                        <View>
                                            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={80} style={{ marginBottom: 12 }} />)}
                                        </View>
                                    )}
                                </View>
                            )}
                            ListEmptyComponent={!loading ? (
                                <AppCard animationDelay={80} style={styles.emptyCard}>
                                    <Text style={{ textAlign: 'center', color: theme.colors.outline }}>
                                        No items found in this scope.
                                    </Text>
                                    <AppButton mode="contained-tonal" onPress={() => router.push('/item/new')} style={styles.emptyAction}>
                                        Add Your First Item
                                    </AppButton>
                                </AppCard>
                            ) : null}
                        />
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
    },
    contentInner: {
        flex: 1,
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
        flex: 1,
        gap: 12,
    },
    workspaceGridWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    listPane: {
        flex: 1,
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
        borderRadius: DesignSystem.radius.lg,
    },
    scanAction: {
        margin: 0,
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
