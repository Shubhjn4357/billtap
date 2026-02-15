
import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, FAB, Searchbar, useTheme, Chip, IconButton } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { usePartyStore } from '../../store';
import { useCartStore } from '../../store/cartStore';
import { partyService } from '../../api/partyService';
import type { Party } from '../../types';

export const PartyListScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams<{ mode?: 'select' }>();
    const theme = useTheme();
    const { parties, setParties } = usePartyStore();
    const { setCustomer } = useCartStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const isSelectionMode = params.mode === 'select';

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
        (p.phone?.includes(searchQuery))
    );

    const handlePartyPress = (party: Party) => {
        if (isSelectionMode) {
            setCustomer(party);
            router.back();
        } else {
            router.push(`/party/${party.id}`);
        }
    };

    const renderItem = ({ item }: { item: Party }) => (
        <AppCard onPress={() => handlePartyPress(item)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.name}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{item.phone}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Chip mode="outlined" compact style={{ marginRight: 8 }}>{item.type}</Chip>
                    <IconButton
                        icon="pencil"
                        size={20}
                        onPress={() => router.push(`/party/${item.id}`)}
                    />
                    <IconButton icon="chevron-right" size={20} />
                </View>
            </View>
        </AppCard>
    );

    return (
        <ScreenWrapper>
            <PageHeaderCard
                title="Parties"
                subtitle={`${filteredParties.length} contacts available`}
            />
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
                ListEmptyComponent={(
                    <AppCard style={{ marginTop: 20 }}>
                        <Text style={{ textAlign: 'center', color: theme.colors.outline }}>
                            No parties found.
                        </Text>
                        <AppButton mode="contained-tonal" style={{ marginTop: 10 }} onPress={() => router.push('/party/new' as never)}>
                            Add Party
                        </AppButton>
                    </AppCard>
                )}
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
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
});
