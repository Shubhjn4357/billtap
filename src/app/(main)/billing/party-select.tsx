import { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useInvoiceBuilderStore } from '../../../store/invoiceBuilderStore';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { resolveSingleParam, useSmartBack } from '../../../hooks/useSmartBack';
import { useParties } from '../../../hooks/useParties';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { EmptyStateCard } from '../../../components/ui/ListBlocks';

export default function PartySelectScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const [search, setSearch] = useState('');
    const params = useLocalSearchParams<{ partyType?: string; returnPath?: string | string[] }>();
    const smartBack = useSmartBack(resolveSingleParam(params.returnPath) ?? '/(main)/billing');
    const normalizedPartyType = params.partyType?.toLowerCase() === 'supplier' ? 'supplier' : 'customer';

    const setParty = useInvoiceBuilderStore((state) => state.setParty);

    const { parties, isLoading, isRefetching, refetch } = useParties({
        search,
        limit: 200,
        type: normalizedPartyType === 'supplier' ? 'SUPPLIER' : 'CUSTOMER',
    });

    const onSelect = (party: (typeof parties)[number]) => {
        setParty(party.id, {
            id: party.id,
            type: party.type,
            name: party.name,
            phone: party.phone ?? null,
            email: party.email ?? null,
            gstin: party.gstin ?? null,
            billingAddress: party.billingAddress ?? null,
            shippingAddress: party.shippingAddress ?? null,
        });
        smartBack();
    };

    const clearParty = () => {
        setParty(null, null);
        smartBack();
    };

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
            <AppTopBar
                title={normalizedPartyType === 'supplier' ? 'Select Supplier' : 'Select Customer'}
                subtitle="Choose party for this document"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={s.clearBtn} onPress={clearParty}>
                        <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.error} />
                    </Pressable>
                )}
            />

            <View style={s.createPartyWrap}>
                <Pressable
                    style={[s.createPartyBtn, { borderColor: colors.border }]}
                    onPress={() =>
                        router.replace({
                            pathname: '/(main)/parties/add',
                            params: {
                                type: normalizedPartyType === 'supplier' ? 'SUPPLIER' : 'CUSTOMER',
                                returnContext: 'invoice',
                                returnPath: resolveSingleParam(params.returnPath) ?? '/(main)/billing',
                            },
                        })
                    }
                >
                    <View style={s.createPartyRow}>
                        <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.primary} />
                        <Text style={[s.createPartyText, { color: colors.primary }]}>
                            Create {normalizedPartyType === 'supplier' ? 'Supplier' : 'Customer'}
                        </Text>
                    </View>
                </Pressable>
            </View>

            <View style={s.searchWrap}>
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search by name, phone or GSTIN"
                />
            </View>

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={parties}
                    keyExtractor={(item) => item.id}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                refetch();
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: 120 }}
                    ListEmptyComponent={
                        <EmptyStateCard
                            icon="account-search-outline"
                            title="No party found"
                            subtitle="Create a new party or change the search to continue building this document."
                            tone="info"
                        />
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            style={({ pressed }) => [
                                s.row,
                                getSurfaceStyle(colors, { elevated: true }),
                                { opacity: pressed ? 0.8 : 1 },
                            ]}
                            onPress={() => onSelect(item)}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[s.rowName, { color: colors.text }]}>{item.name}</Text>
                                <Text style={[s.rowMeta, { color: colors.textSecondary }]}>
                                    {item.type} {item.phone ? `- ${item.phone}` : ''}
                                </Text>
                                {item.gstin ? (
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]}>GSTIN: {item.gstin}</Text>
                                ) : null}
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        clearBtn: {
            ...getPillStyle(colors, colors.error),
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
        },
        searchWrap: { paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: Spacing.md },
        createPartyWrap: {
            paddingHorizontal: DESIGN_SPACING.screenX,
            paddingBottom: Spacing.sm,
        },
        createPartyBtn: {
            ...getPillStyle(colors, colors.primary),
            borderRadius: Radius.pill,
            minHeight: 40,
            alignItems: 'center',
            justifyContent: 'center',
        },
        createPartyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
        createPartyText: {
            fontSize: 14,
            fontWeight: '700',
        },
        centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl },
        empty: { fontSize: 13 },
        row: {
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        rowName: { fontSize: 14, fontWeight: '700' },
        rowMeta: { fontSize: 12, marginTop: 2 },
    });


