
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, FAB, useTheme, Chip, IconButton } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
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
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
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
            <View style={styles.itemRow}>
                <View>
                    <Text variant="titleMedium" style={styles.itemName}>{item.name}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{item.phone}</Text>
                </View>
                <View style={styles.itemActions}>
                    <Chip mode="outlined" compact style={styles.typeChip}>{item.type}</Chip>
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
                <View style={styles.blockedContainer}>
                    <AppCard style={[styles.blockedCard, isWide && styles.blockedCardWide]}>
                        <Text variant="titleMedium" style={styles.blockedTitle}>
                            Party access is disabled
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            Ask owner/admin to enable party management permissions.
                        </Text>
                    </AppCard>
                </View>
            ) : (
                <View style={styles.content}>
                    <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title="Parties"
                            subtitle={`${filteredParties.length} contacts available`}
                        />
                        {queryError ? (
                            <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                                {queryError}
                            </Text>
                        ) : null}
                        <AppInput
                            label="Search Parties"
                            placeholder="Search by name or phone"
                            onChangeText={setSearchQuery}
                            value={searchQuery}
                            inputType="search"
                        />
                        <FlatList
                            data={filteredParties}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            refreshing={partiesQuery.isRefetching}
                            onRefresh={() => {
                                void partiesQuery.refetch();
                            }}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContainer}
                            ListEmptyComponent={(
                                <AppCard style={styles.emptyCard}>
                                    <Text style={[styles.emptyText, { color: theme.colors.outline }]}>
                                        No parties found.
                                    </Text>
                                    <AppButton
                                        mode="contained-tonal"
                                        style={styles.addPartyButton}
                                        onPress={() => router.push('/party/new' as never)}
                                    >
                                        Add Party
                                    </AppButton>
                                </AppCard>
                            )}
                        />
                    </View>
                    <FAB
                        icon="plus"
                        label="Add Party"
                        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                        color={theme.colors.onPrimary}
                        onPress={() => router.push('/party/new' as never)}
                    />
                </View>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingTop: DesignSystem.layout.pageTop,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        flex: 1,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    blockedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    blockedCard: {
        width: '100%',
    },
    blockedCardWide: {
        maxWidth: DesignSystem.layout.compactMaxWidth,
    },
    blockedTitle: {
        fontWeight: '700',
    },
    errorText: {
        marginBottom: DesignSystem.spacing.xs,
    },
    listContainer: {
        paddingBottom: DesignSystem.layout.pageBottom,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemName: {
        fontWeight: '700',
    },
    itemActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeChip: {
        marginRight: DesignSystem.spacing.xs + 2,
    },
    emptyCard: {
        marginTop: DesignSystem.spacing.md,
    },
    emptyText: {
        textAlign: 'center',
    },
    addPartyButton: {
        marginTop: DesignSystem.spacing.sm,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
});
