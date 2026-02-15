
import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, FAB, Searchbar, useTheme, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { usePartyStore } from '../../store';
import { partyService } from '../../api/partyService'; // Need to create this service
import type { Party } from '../../types';

export const PartyListScreen = () => {
    const router = useRouter();
    const theme = useTheme();
    const { parties, setParties } = usePartyStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const loadParties = useCallback(async () => {
        setRefreshing(true);
        try {
            const data = await partyService.getParties();
            setParties(data.filter((entry) => entry.isActive !== false));
        } catch (error: unknown) {
            console.error(error);
        } finally {
            setRefreshing(false);
        }
    }, [setParties]);

    useEffect(() => {
        void loadParties();
    }, [loadParties]);

    const filteredParties = parties.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.phone?.includes(searchQuery)
    );

    const renderItem = ({ item }: { item: Party }) => (
        <AppCard onPress={() => router.push(`/party/${item.id}` as never)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.name}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{item.phone}</Text>
                </View>
                <Chip mode="outlined" compact>{item.type}</Chip>
            </View>
        </AppCard>
    );

    return (
        <ScreenWrapper>
             <View style={styles.headerRow}>
                <Text variant="titleMedium" style={{ fontWeight: '700' }}>Parties</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {filteredParties.length} contacts
                </Text>
            </View>
            <Searchbar
                placeholder="Search Parties..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={{ marginBottom: 16 }}
            />
            <FlatList
                data={filteredParties}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                refreshing={refreshing}
                onRefresh={loadParties}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No parties found</Text>}
            />
             <FAB
                icon="plus"
                label="Add Party"
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color={theme.colors.onPrimary}
                onPress={() => router.push('/party/new' as never)}
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
});
