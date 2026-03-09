import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { useGodownStock } from '../../../../hooks/useGodowns';

export default function GodownDetailScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
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
                        onPress={() =>
                            router.push(
                                (`/(main)/more/godowns/transfer?fromGodownId=${encodeURIComponent(godownId)}`) as Parameters<typeof router.push>[0]
                            )
                        }
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
                    contentContainerStyle={{ paddingBottom: 120 }}
                    ListEmptyComponent={(
                        <View style={s.centered}>
                            <MaterialCommunityIcons name="inbox-outline" size={42} color={colors.textSecondary} />
                            <Text style={[s.emptyText, { color: colors.textSecondary }]}>No stock entries found.</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
        },
        emptyText: { fontSize: Typography.body.size },
        row: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
            borderWidth: 1,
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
        itemName: { fontSize: Typography.body.size, fontWeight: '700' },
        meta: { fontSize: Typography.caption.size, marginTop: 2 },
        qty: { fontSize: Typography.body.size, fontWeight: '700' },
    });
