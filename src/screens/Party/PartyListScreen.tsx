
import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, FAB, Searchbar, useTheme, Chip, IconButton } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { usePartyStore } from '../../store';
import { useCartStore } from '../../store/cartStore';
import { partyService } from '../../api/partyService';
import type { Party } from '../../types';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { isNetworkLikeError } from '../../utils/errorGuards';

export const PartyListScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams<{ mode?: 'select' }>();
    const theme = useTheme();
    const { parties, setParties } = usePartyStore();
    const { setCustomer } = useCartStore();
    const { canManageParties } = useOrganizationAccess();
    const [searchQuery, setSearchQuery] = useState('');
    const isSelectionMode = params.mode === 'select';

    const partiesQuery = useQuery({
        queryKey: ['parties', canManageParties] as const,
        queryFn: async (): Promise<Party[]> => {
            if (!canManageParties) return [];
            const data = await partyService.getParties();
            return data.filter((entry) => entry.isActive !== false);
        },
        enabled: canManageParties,
        staleTime: 30_000,
    });

    useEffect(() => {
        if (!canManageParties) {
            setParties([]);
            return;
        }

        if (partiesQuery.data) {
            setParties(partiesQuery.data);
        }
    }, [canManageParties, partiesQuery.data, setParties]);

    const queryError = useMemo(() => {
        if (!partiesQuery.error || isNetworkLikeError(partiesQuery.error)) {
            return null;
        }
        return partiesQuery.error instanceof Error ? partiesQuery.error.message : 'Failed to load parties.';
    }, [partiesQuery.error]);

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
            {!canManageParties ? (
                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        Party access is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Ask owner/admin to enable party management permissions.
                    </Text>
                </AppCard>
            ) : (
            <>
            <PageHeaderCard
                title="Parties"
                subtitle={`${filteredParties.length} contacts available`}
            />
            {queryError ? (
                <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
                    {queryError}
                </Text>
            ) : null}
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
                refreshing={partiesQuery.isRefetching}
                onRefresh={() => {
                    void partiesQuery.refetch();
                }}
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
            </>
            )}
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
