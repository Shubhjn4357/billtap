
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Text, FAB, useTheme, Chip, IconButton, Avatar, Searchbar } from 'react-native-paper'; // added Searchbar, Avatar
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton'; 
// Removed AppInput import as we use Searchbar now for better UI
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import { usePartyStore } from '../../store';
import { useCartStore } from '../../store/cartStore';
import { partyRepository } from '../../repositories/partyRepository';
import type { Party } from '../../types';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { useAuth } from '../../hooks/useAuth';
import { mapDbPartyToAppParty } from '../../utils/mappers';

export const PartyListScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams<{ mode?: 'select' }>();
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const { parties, setParties } = usePartyStore();
    const { setCustomer } = useCartStore();
    const { canManageParties } = useOrganizationAccess();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const isSelectionMode = params.mode === 'select';

    const partiesQuery = useQuery({
        queryKey: ['parties', canManageParties] as const,
        queryFn: async (): Promise<Party[]> => {
            if (!canManageParties || !user?.uid) return [];
            const data = await partyRepository.getAll(user.uid);
            return data.filter((entry) => entry.isActive !== false).map(mapDbPartyToAppParty);
        },
        enabled: canManageParties && !!user,
        staleTime: 5000,
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
        <TouchableOpacity onPress={() => handlePartyPress(item)} activeOpacity={0.7}>
            <AppCard style={styles.itemCard} contentStyle={styles.itemCardContent}>
                <View style={styles.itemRow}>
                    <Avatar.Text
                        size={42}
                        label={item.name.substring(0, 2).toUpperCase()}
                        style={{ backgroundColor: item.type === 'customer' ? theme.colors.primaryContainer : theme.colors.secondaryContainer }}
                        color={item.type === 'customer' ? theme.colors.primary : theme.colors.secondary}
                    />
                    <View style={styles.itemInfo}>
                        <Text variant="titleMedium" style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            {item.phone || 'No phone'}
                        </Text>
                    </View>
                    <View style={styles.itemActions}>
                        <Chip
                            mode="flat"
                            compact
                            textStyle={{ fontSize: 10, marginHorizontal: 4, marginVertical: 0 }}
                            style={[
                                styles.typeChip,
                                { backgroundColor: item.type === 'customer' ? theme.colors.surfaceVariant : theme.colors.secondaryContainer }
                            ]}
                        >
                            {item.type.toUpperCase()}
                        </Chip>
                        <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outline} />
                    </View>
                </View>
            </AppCard>
        </TouchableOpacity>
    );

    if (!canManageParties) {
        return (
            <ScreenWrapper>
                <View style={styles.blockedContainer}>
                    <AppCard style={[styles.blockedCard, isWide && styles.blockedCardWide]}>
                        <View style={{ alignItems: 'center', padding: 20 }}>
                            <IconButton icon="lock-outline" size={48} iconColor={theme.colors.outline} />
                            <Text variant="titleMedium" style={[styles.blockedTitle, { marginTop: 16 }]}>
                                Access Restricted
                            </Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 8 }}>
                                You do not have permission to manage parties. Please contact your administrator.
                            </Text>
                        </View>
                    </AppCard>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <View style={styles.content}>
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Parties"
                        subtitle={isSelectionMode ? "Select a customer or supplier" : "Manage your customers and suppliers"}
                        right={
                            !isSelectionMode ? (
                                <AppButton
                                    mode="contained"
                                    icon="plus"
                                    onPress={() => router.push('/party/new' as never)}
                                >
                                    Add New
                                </AppButton>
                            ) : undefined
                        }
                    />

                    {queryError && (
                        <AppCard style={{ marginBottom: 16, backgroundColor: theme.colors.errorContainer }}>
                            <Text style={{ color: theme.colors.onErrorContainer }}>{queryError}</Text>
                        </AppCard>
                    )}

                    <Searchbar
                        placeholder="Search by name or phone"
                        onChangeText={setSearchQuery}
                        value={searchQuery}
                        style={styles.searchBar}
                        inputStyle={{ minHeight: 0 }}
                        elevation={0}
                    />

                    <FlatList
                        data={filteredParties}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        refreshing={partiesQuery.isRefetching}
                        onRefresh={() => { void partiesQuery.refetch(); }}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.listContainer}
                        ListEmptyComponent={(
                            <View style={styles.emptyState}>
                                <Text variant="bodyLarge" style={{ color: theme.colors.outline, marginBottom: 12 }}>
                                    No parties found.
                                </Text>
                                {searchQuery ? (
                                    <Text variant="bodyMedium" style={{ color: theme.colors.outlineVariant }}>
                                        Try adjusting your search query.
                                    </Text>
                                ) : (
                                    <AppButton
                                            mode="contained-tonal"
                                        onPress={() => router.push('/party/new' as never)}
                                    >
                                            Create First Party
                                    </AppButton>
                                )}
                            </View>
                        )}
                    />
                </View>

                {/* Mobile FAB for adding party if not in selection mode */}
                {!isSelectionMode && !isWide && (
                    <FAB
                        icon="plus"
                        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                        color={theme.colors.onPrimary}
                        onPress={() => router.push('/party/new' as never)}
                    />
                )}
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingTop: DesignSystem.layout.pageTop,
    },
    contentInner: {
        width: '100%',
        flex: 1,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
        alignSelf: 'center',
    },
    blockedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    blockedCard: {
        width: '100%',
    },
    blockedCardWide: {
        maxWidth: 400,
    },
    blockedTitle: {
        fontWeight: 'bold',
    },
    searchBar: {
        marginBottom: 16,
        backgroundColor: DesignSystem.glass.light.panel,
        borderWidth: 1,
        borderColor: DesignSystem.glass.light.border,
        height: 50,
        borderRadius: DesignSystem.radius.lg,
    },
    listContainer: {
        paddingBottom: 80, // Space for FAB
    },
    itemCard: {
        marginBottom: 10,
    },
    itemCardContent: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemInfo: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    itemName: {
        fontWeight: '600',
        marginBottom: 2,
    },
    itemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    typeChip: {
        height: 24,
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        borderRadius: 50,
    },
});
