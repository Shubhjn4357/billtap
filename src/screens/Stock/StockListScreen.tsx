
import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, FAB, Searchbar, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useStock } from '../../hooks/useStock';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Skeleton } from '../../components/feedback/Skeleton';
import { formatCurrency } from '../../utils/formatters';

export const StockListScreen = () => {
    const { items, loading, searchQuery, setSearchQuery } = useStock();
    const theme = useTheme();
    const router = useRouter();

    const renderItem = ({ item }: { item: any }) => (
        <AppCard onPress={() => router.push(`/item/${item.id}`)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.name}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Stock: {item.stock} {item.unit || 'pcs'}</Text>
                </View>
                <Text variant="titleMedium" style={{ color: theme.colors.primary }}>{formatCurrency(item.price)}</Text>
            </View>
        </AppCard>
    );

    return (
        <ScreenWrapper>
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
                    contentContainerStyle={{ paddingBottom: 80 }}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No items found</Text>}
                />
            )}

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
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
});
