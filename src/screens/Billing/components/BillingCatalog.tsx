import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text, useTheme, Searchbar, Chip, Avatar, IconButton } from 'react-native-paper';
import { AppCard } from '../../../components/common/AppCard';
import { DesignSystem } from '../../../constants/DesignSystem';
import { Item } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';
import { getStockHealth } from '../../../utils/stockStatus';

interface BillingCatalogProps {
    items: Item[];
    onAddItem: (item: Item) => void;
    stockMap: Map<string, Item>;
    currencySymbol: string;
    transactionType: 'SALE' | 'PURCHASE';
}

export const BillingCatalog = ({
    items,
    onAddItem,
    currencySymbol,
}: BillingCatalogProps) => {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

    const filteredItems = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return items.filter((item) => {
            const matchesSearch = item.name.toLowerCase().includes(query) || (item.barcode?.includes(query));
            if (!matchesSearch) return false;

            if (filter === 'all') return true;
            const health = getStockHealth(item);
            if (filter === 'low') return health === 'low';
            if (filter === 'out') return health === 'out';
            return true;
        });
    }, [items, searchQuery, filter]);

    const renderItem = ({ item }: { item: Item }) => {
        const stockHealth = getStockHealth(item);
        // Use theme.colors.error for out, theme.colors.tertiary (or similar) for low
        const stockColor = stockHealth === 'out' ? theme.colors.error : stockHealth === 'low' ? theme.colors.tertiary : theme.colors.primary;

        return (
            <TouchableOpacity onPress={() => onAddItem(item)} activeOpacity={0.7}>
                <AppCard style={styles.itemCard} contentStyle={{ padding: 8 }}>
                    <View style={styles.itemRow}>
                        <Avatar.Text
                            size={40}
                            label={item.name.substring(0, 2).toUpperCase()}
                            style={{ backgroundColor: theme.colors.primaryContainer }}
                            color={theme.colors.onPrimaryContainer}
                        />
                        <View style={styles.itemContent}>
                            <Text variant="bodyMedium" style={{ fontWeight: '600' }} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                                {item.barcode ? `Scan: ${item.barcode}` : 'No Barcode'}
                            </Text>
                        </View>
                        <View style={styles.itemMeta}>
                            <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                                {formatCurrency(item.price, currencySymbol)}
                            </Text>
                            <Text variant="labelSmall" style={{ color: stockColor, textAlign: 'right' }}>
                                Stock: {item.stock}
                            </Text>
                        </View>
                        <IconButton icon="plus" size={20} iconColor={theme.colors.primary} />
                    </View>
                </AppCard>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.searchRow}>
                <Searchbar
                    placeholder="Search name or scan barcode..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    inputStyle={{ minHeight: 0 }}
                />
            </View>
            <View style={styles.filterRow}>
                <Chip
                    selected={filter === 'all'}
                    onPress={() => setFilter('all')}
                    showSelectedOverlay
                    compact
                    style={styles.chip}
                >
                    All
                </Chip>
                <Chip
                    selected={filter === 'low'}
                    onPress={() => setFilter('low')}
                    showSelectedOverlay
                    compact
                    style={styles.chip}
                >
                    Low Stock
                </Chip>
                <Chip
                    selected={filter === 'out'}
                    onPress={() => setFilter('out')}
                    showSelectedOverlay
                    compact
                    style={styles.chip}
                >
                    Out of Stock
                </Chip>
            </View>

            <FlatList
                data={filteredItems}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
                            No items found.
                        </Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16, // Added padding since Card contentStyle padding was removed in parent
    },
    searchRow: {
        marginBottom: 12,
    },
    searchBar: {
        elevation: 0,
        backgroundColor: DesignSystem.glass.light.panel,
        borderWidth: 1,
        borderColor: DesignSystem.glass.light.border,
        height: 48,
    },
    filterRow: {
        flexDirection: 'row',
        marginBottom: 12,
        gap: 8,
    },
    chip: {
        marginRight: 4,
    },
    listContent: {
        paddingBottom: 24,
    },
    itemCard: {
        marginBottom: 8,
        backgroundColor: '#fff',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemContent: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    itemMeta: {
        alignItems: 'flex-end',
        marginRight: 4,
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
    },
});
