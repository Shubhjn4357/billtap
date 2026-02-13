
import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Chip, Text, FAB, Searchbar, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useStock } from '../../hooks/useStock';
import { useAuth } from '../../hooks/useAuth';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Skeleton } from '../../components/feedback/Skeleton';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { useSettingsStore } from '../../store';
import { Config } from '../../constants/Config';
import type { Item } from '../../types';

export const StockListScreen = () => {
    const { items, loading, searchQuery, setSearchQuery, fetchItems } = useStock();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const theme = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams<{ search?: string | string[] }>();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const scannedSearch = Array.isArray(params.search) ? params.search[0] : params.search;
        if (scannedSearch) {
            setSearchQuery(scannedSearch);
        }
    }, [params.search, setSearchQuery]);

    useFocusEffect(
        useCallback(() => {
            if (items.length === 0) {
                void fetchItems();
            }
        }, [fetchItems, items.length])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await fetchItems();
        } finally {
            setRefreshing(false);
        }
    }, [fetchItems]);

    const getStockStatus = useCallback((stock: number) => {
        if (stock <= 0) {
            return {
                label: 'Out of stock',
                backgroundColor: theme.colors.errorContainer,
                textColor: theme.colors.onErrorContainer,
            };
        }
        if (stock <= 5) {
            return {
                label: 'Low stock',
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

    const renderItem = useCallback(({ item }: { item: Item }) => {
        const status = getStockStatus(item.stock);

        return (
            <AppCard onPress={() => router.push(`/item/${item.id}`)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginRight: 8 }}>
                                Qty: {item.stock}
                            </Text>
                            <Chip
                                compact
                                style={{ backgroundColor: status.backgroundColor, height: 24 }}
                                textStyle={{ color: status.textColor, marginVertical: -2 }}
                            >
                                {status.label}
                            </Chip>
                        </View>
                    </View>
                    <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
                        {formatCurrency(item.price, activeCurrency)}
                    </Text>
                </View>
            </AppCard>
        );
    }, [activeCurrency, getStockStatus, router, theme.colors.outline, theme.colors.primary]);

    return (
        <ScreenWrapper>
            <View style={styles.headerRow}>
                <Text variant="titleMedium" style={{ fontWeight: '700' }}>Inventory</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {items.length} item(s)
                </Text>
            </View>
            <Searchbar
                placeholder="Search Items..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={{ marginBottom: 16 }}
            />

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
                    contentContainerStyle={{ paddingBottom: 80 }}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No items found</Text>}
                />
            )}

            <FAB
                icon="barcode-scan"
                style={[
                    styles.fab,
                    styles.scanFab,
                    { backgroundColor: theme.colors.secondaryContainer }
                ]}
                color={theme.colors.onSecondaryContainer}
                onPress={() => router.push({ pathname: '/scan', params: { target: 'stock' } })}
            />

            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color={theme.colors.onPrimary}
                onPress={() => router.push('/item/new')}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
    scanFab: {
        bottom: 72,
    },
});
