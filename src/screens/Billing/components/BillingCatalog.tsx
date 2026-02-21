import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Text, useTheme, Searchbar, Chip, IconButton } from 'react-native-paper';
import { DesignSystem } from '../../../constants/DesignSystem';
import { PREDEFINED_CATEGORIES, getCategoryByKey } from '../../../constants/categories';
import { BILLING_TEXT } from '../../../constants/staticText';
import { EmptyState } from '../../../components/common/EmptyState';
import type { Item } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';
import { getStockHealth } from '../../../utils/stockStatus';

interface BillingCatalogProps {
    items: Item[];
    onAddItem: (item: Item) => void;
    stockMap: Map<string, Item>;
    currencySymbol: string;
    transactionType: 'SALE' | 'PURCHASE';
}

// All of the pre-defined category keys for filter chips
const CATEGORY_FILTER_OPTIONS = [
    { key: 'all', label: 'All', emoji: '🔍' },
    ...PREDEFINED_CATEGORIES.map((c) => ({ key: c.key, label: c.label, emoji: c.emoji })),
];

export const BillingCatalog = ({
    items,
    onAddItem,
    currencySymbol,
    transactionType,
}: BillingCatalogProps) => {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

    const filteredItems = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        return items.filter((item) => {
            // Search
            if (query) {
                const matches =
                    item.name.toLowerCase().includes(query) ||
                    item.barcode?.toLowerCase().includes(query);
                if (!matches) return false;
            }

            // Category
            if (selectedCategory !== 'all') {
                const itemCategory = (item as Item & { category?: string }).category;
                if (itemCategory !== selectedCategory) return false;
            }

            // Stock health
            const health = getStockHealth(item);
            if (stockFilter === 'low' && health !== 'low') return false;
            if (stockFilter === 'out' && health !== 'out') return false;

            return true;
        });
    }, [items, searchQuery, selectedCategory, stockFilter]);

    const renderItem = ({ item }: { item: Item }) => {
        const stockHealth = getStockHealth(item);
        const stockColor =
            stockHealth === 'out'
                ? theme.colors.error
                : stockHealth === 'low'
                    ? theme.colors.tertiary
                    : theme.colors.secondary;

        const initials = item.name.substring(0, 2).toUpperCase();
        const category = getCategoryByKey((item as Item & { category?: string }).category ?? 'other');

        return (
            <Pressable
                onPress={() => onAddItem(item)}
                style={[
                    styles.itemCard,
                    {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.outlineVariant,
                    },
                ]}
                android_ripple={{ color: theme.colors.primaryContainer }}
            >
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: theme.colors.onPrimaryContainer }}>
                        {initials}
                    </Text>
                </View>

                {/* Info */}
                <View style={styles.itemInfo}>
                    <Text
                        variant="bodyMedium"
                        style={[styles.itemName, { color: theme.colors.onSurface }]}
                        numberOfLines={1}
                    >
                        {item.name}
                    </Text>
                    <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                        numberOfLines={1}
                    >
                        {category.emoji} {category.label}
                        {item.barcode ? ` · ${item.barcode}` : ''}
                    </Text>
                </View>

                {/* Price + Stock */}
                <View style={styles.itemMeta}>
                    <Text
                        variant="titleSmall"
                        style={{ color: theme.colors.primary, fontWeight: '700' }}
                    >
                        {formatCurrency(item.price, currencySymbol)}
                    </Text>
                    <Text
                        variant="labelSmall"
                        style={{ color: stockColor, textAlign: 'right', fontWeight: '600' }}
                    >
                        {stockHealth === 'out'
                            ? 'Out'
                            : stockHealth === 'low'
                                ? `Low (${item.stock})`
                                : `${item.stock} ${BILLING_TEXT.inStockSuffix}`}
                    </Text>
                </View>

                <IconButton
                    icon={stockHealth === 'out' ? 'block-helper' : 'plus-circle'}
                    size={22}
                    iconColor={stockHealth === 'out' ? theme.colors.error : theme.colors.primary}
                    onPress={() => onAddItem(item)}
                    style={styles.addBtn}
                />
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            {/* Search bar */}
            <Searchbar
                placeholder={BILLING_TEXT.searchPlaceholder}
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={[styles.searchBar, { backgroundColor: theme.colors.surfaceVariant }]}
                inputStyle={{ color: theme.colors.onSurface, minHeight: 0 }}
                iconColor={theme.colors.onSurfaceVariant}
                placeholderTextColor={theme.colors.onSurfaceVariant}
                elevation={0}
            />

            {/* Category chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
            >
                {CATEGORY_FILTER_OPTIONS.slice(0, 10).map((cat) => (
                    <Chip
                        key={cat.key}
                        selected={selectedCategory === cat.key}
                        onPress={() => setSelectedCategory(cat.key)}
                        compact
                        style={[
                            styles.chip,
                            selectedCategory === cat.key && {
                                backgroundColor: theme.colors.primaryContainer,
                            },
                        ]}
                        textStyle={{
                            color: selectedCategory === cat.key
                                ? theme.colors.onPrimaryContainer
                                : theme.colors.onSurfaceVariant,
                            fontSize: 12,
                        }}
                    >
                        {cat.emoji} {cat.label}
                    </Chip>
                ))}
            </ScrollView>

            {/* Stock filter chips */}
            <View style={styles.stockFilterRow}>
                {(['all', 'low', 'out'] as const).map((f) => (
                    <Chip
                        key={f}
                        selected={stockFilter === f}
                        onPress={() => setStockFilter(f)}
                        compact
                        style={[
                            styles.chip,
                            stockFilter === f && f === 'out' && { backgroundColor: theme.colors.errorContainer },
                            stockFilter === f && f === 'low' && { backgroundColor: theme.colors.tertiaryContainer },
                            stockFilter === f && f === 'all' && { backgroundColor: theme.colors.primaryContainer },
                        ]}
                        textStyle={{ fontSize: 11 }}
                    >
                        {f === 'all' ? 'All Stock' : f === 'low' ? '⚡ Low Stock' : '🚫 Out of Stock'}
                    </Chip>
                ))}
            </View>

            {/* Item list */}
            <FlatList
                data={filteredItems}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                    <EmptyState
                        emoji={transactionType === 'SALE' ? '🛒' : '📦'}
                        title="No items found"
                        subtitle="Try a different search or category filter."
                    />
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    searchBar: {
        margin: DesignSystem.spacing.md,
        marginBottom: DesignSystem.spacing.xs,
        borderRadius: DesignSystem.radius.md,
        height: 48,
    },
    chipRow: {
        paddingHorizontal: DesignSystem.spacing.md,
        paddingVertical: DesignSystem.spacing.xs,
        gap: DesignSystem.spacing.xs,
    },
    stockFilterRow: {
        flexDirection: 'row',
        paddingHorizontal: DesignSystem.spacing.md,
        paddingBottom: DesignSystem.spacing.xs,
        gap: DesignSystem.spacing.xs,
    },
    chip: {
        borderRadius: DesignSystem.radius.pill,
    },
    list: {
        paddingHorizontal: DesignSystem.spacing.md,
        paddingBottom: DesignSystem.spacing.xl,
        gap: DesignSystem.spacing.xs,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
        padding: DesignSystem.spacing.sm,
        gap: DesignSystem.spacing.sm,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: DesignSystem.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    itemInfo: {
        flex: 1,
        gap: 2,
    },
    itemName: {
        fontWeight: '600',
    },
    itemMeta: {
        alignItems: 'flex-end',
        gap: 2,
    },
    addBtn: {
        margin: 0,
    },
});
