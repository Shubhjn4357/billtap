import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { EmptyStateCard } from '../../../../components/ui/ListBlocks';
import { UtilityHero } from '../../../../components/ui/UtilityBlocks';
import { useGodownStock } from '../../../../hooks/useGodowns';

export default function GodownDetailScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/settings/godowns');
    const { id } = useLocalSearchParams<{ id?: string }>();

    const godownId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

    const { stock, isLoading, isRefetching, refetch } = useGodownStock(godownId);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Godown Stock"
                subtitle="Item-wise quantities at this location"
                onBackPress={smartBack}
                rightAction={godownId ? (
                    <Pressable
                        style={[s.transferBtn, { backgroundColor: colors.primary }]}
                        onPress={() => router.push({ pathname: '/(main)/settings/godowns/transfer' as never, params: { fromGodownId: godownId, returnPath: `/(main)/settings/godowns/${godownId}` } })}
                    >
                        <MaterialCommunityIcons name="swap-horizontal" size={16} color={colors.onPrimary} />
                        <Text style={s.transferBtnText}>Transfer</Text>
                    </Pressable>
                ) : undefined}
            />

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={stock}
                    keyExtractor={(item) => item.itemId}
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
                    ListHeaderComponent={(
                        <View style={s.heroWrap}>
                            <UtilityHero
                                title="Location Inventory"
                                subtitle={`${stock.length} item ${stock.length === 1 ? 'entry' : 'entries'} tracked at this godown.`}
                                icon="warehouse"
                                tone="info"
                            />
                        </View>
                    )}
                    ListEmptyComponent={(
                        <View style={s.centered}>
                            <EmptyStateCard
                                icon="inbox-outline"
                                title="No stock entries found"
                                subtitle="This location has no visible stock movements yet."
                                tone="info"
                            />
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <View style={[s.row, getSurfaceStyle(colors, { elevated: true })]}>
                            <View style={[s.iconWrap, { backgroundColor: withAlpha(colors.primary, '16') }]}>
                                <MaterialCommunityIcons name="package-variant-closed" size={16} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.itemName, { color: colors.text }]} numberOfLines={1}>
                                    {item.itemName ?? item.itemId}
                                </Text>
                                <Text style={[s.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {item.itemSku ?? 'No SKU'}
                                </Text>
                            </View>
                            <Text style={[s.qty, { color: colors.primary }]}>
                                {`${item.quantity} ${item.itemUnit ?? ''}`.trim()}
                            </Text>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 64,
            gap: Spacing.sm,
        },
        emptyText: { fontSize: Typography.body.size },
        row: {
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
            padding: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        iconWrap: {
            width: 34,
            height: 34,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
        },
        transferBtn: {
            ...getPillStyle(colors, colors.primary),
            backgroundColor: colors.primary,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        transferBtnText: {
            color: colors.onPrimary,
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        heroWrap: { marginBottom: DESIGN_SPACING.sectionGap },
        itemName: { fontSize: Typography.body.size, fontWeight: '700' },
        meta: { fontSize: Typography.caption.size, marginTop: 2 },
        qty: { fontSize: Typography.body.size, fontWeight: '700' },
    });
