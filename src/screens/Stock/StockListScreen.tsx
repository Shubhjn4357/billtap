
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Chip, Text, FAB, Searchbar, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStock } from '../../hooks/useStock';
import { useAuth } from '../../hooks/useAuth';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Skeleton } from '../../components/feedback/Skeleton';
import { getCurvedTabOverlayOffset, getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { getStockHealth, resolveLowStockThreshold } from '../../utils/stockStatus';
import { useSettingsStore } from '../../store';
import { Config } from '../../constants/Config';
import type { Item } from '../../types';
import { StockAdjustmentDialog } from '../../components/stock/StockAdjustmentDialog';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';

export const StockListScreen = () => {
    const { items, loading, searchQuery, setSearchQuery, searchPending, fetchItems, adjustStock } = useStock();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ search?: string | string[] }>();
    const { canManageInventory } = useOrganizationAccess();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);
    const [refreshing, setRefreshing] = useState(false);
    const [adjustmentItem, setAdjustmentItem] = useState<Item | null>(null);
    const tabOverlayOffset = getCurvedTabOverlayOffset(insets.bottom);
    const listBottomPadding = getTabAwareBottomSpacing(insets.bottom, 168);

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

    useFocusEffect(
        useCallback(() => {
            if (!canManageInventory) return;
            if (items.length === 0) {
                void fetchItems();
            }
        }, [canManageInventory, fetchItems, items.length])
    );

    const onRefresh = useCallback(async () => {
        if (!canManageInventory) return;
        setRefreshing(true);
        try {
            await fetchItems();
        } finally {
            setRefreshing(false);
        }
    }, [canManageInventory, fetchItems]);

    const inventoryStats = useMemo(() => {
        let lowStock = 0;
        let outOfStock = 0;
        let stockValue = 0;

        for (const item of items) {
            const health = getStockHealth(item);
            if (health === 'out') {
                outOfStock += 1;
            } else if (health === 'low') {
                lowStock += 1;
            }
            stockValue += item.stock * item.price;
        }

        return { lowStock, outOfStock, stockValue };
    }, [items]);

    const getStockStatus = useCallback((item: Item) => {
        const health = getStockHealth(item);
        const lowStockThreshold = resolveLowStockThreshold(item);

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
        theme.colors.errorContainer,
        theme.colors.onErrorContainer,
        theme.colors.secondaryContainer,
        theme.colors.onSecondaryContainer,
        theme.colors.primaryContainer,
        theme.colors.onPrimaryContainer,
    ]);

    const renderItem = useCallback(({ item, index }: { item: Item; index: number }) => {
        const status = getStockStatus(item);
        const stockHealth = getStockHealth(item);
        const needsAttention = stockHealth !== 'in';

        return (
            <AppCard
                animationDelay={Math.min(index * 24, 220)}
                onPress={() => router.push(`/item/${item.id}`)}
                style={{ backgroundColor: needsAttention ? theme.colors.elevation.level2 : undefined }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text variant="titleMedium" style={{ fontWeight: 'bold', color: needsAttention ? theme.colors.error : theme.colors.onSurface }}>
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
    }, [activeCurrency, getStockStatus, router, theme.colors.elevation.level2, theme.colors.error, theme.colors.onSurface, theme.colors.outline, theme.colors.primary]);

    return (
        <ScreenWrapper>
            {!canManageInventory ? (
                <AppCard animationDelay={40}>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        Inventory access is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Ask owner/admin to enable inventory permissions for your account.
                    </Text>
                </AppCard>
            ) : (
            <>
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
            </AppCard>

            <Searchbar
                placeholder="Search item by name or barcode"
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchbar}
            />
            {searchPending && (
                <Text variant="labelSmall" style={{ marginBottom: 8, color: theme.colors.outline }}>
                    Updating search...
                </Text>
            )}

            {loading ? (
                <View>
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={80} style={{ marginBottom: 12 }} />)}
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} />
                    }
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    windowSize={7}
                    removeClippedSubviews
                    contentContainerStyle={{ paddingBottom: listBottomPadding }}
                    ListEmptyComponent={(
                        <AppCard animationDelay={80} style={styles.emptyCard}>
                            <Text style={{ textAlign: 'center', color: theme.colors.outline }}>
                                No items found.
                            </Text>
                            <AppButton mode="contained-tonal" onPress={() => router.push('/item/new')} style={styles.emptyAction}>
                                Add Your First Item
                            </AppButton>
                        </AppCard>
                    )}
                />
            )}

            <FAB
                icon="barcode-scan"
                style={[
                    styles.fab,
                    { backgroundColor: theme.colors.secondaryContainer, bottom: tabOverlayOffset + 78 }
                ]}
                color={theme.colors.onSecondaryContainer}
                onPress={() => router.push({ pathname: '/scan', params: { target: 'stock' } })}
            />

            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: tabOverlayOffset + 8 }]}
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
            </>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    searchbar: {
        marginBottom: 16,
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
