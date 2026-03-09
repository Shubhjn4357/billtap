import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { EmptyStateCard } from '../../../components/ui/ListBlocks';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useGodowns } from '../../../hooks/useGodowns';
import { useGodownMutations } from '../../../hooks/useGodownMutations';

export default function GodownsScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');

    const { godowns, isLoading, isRefetching, refetch } = useGodowns();
    const { deleteGodown } = useGodownMutations();

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Godowns"
                subtitle="Warehouse and stock location control"
                onBackPress={smartBack}
                rightAction={(
                    <View style={s.topActions}>
                        <Pressable
                            style={s.secondaryBtn}
                            onPress={() => router.push('/(main)/more/godowns/transfer' as Parameters<typeof router.push>[0])}
                        >
                            <MaterialCommunityIcons name="swap-horizontal" size={16} color={colors.text} />
                            <Text style={[s.secondaryBtnText, { color: colors.text }]}>Transfer</Text>
                        </Pressable>
                        <Pressable
                            style={[s.addBtn, { backgroundColor: colors.primary }]}
                            onPress={() => router.push('/(main)/more/godowns/add')}
                        >
                            <MaterialCommunityIcons name="plus" size={16} color={colors.onPrimary} />
                            <Text style={s.addBtnText}>Add</Text>
                        </Pressable>
                    </View>
                )}
            />

            <View style={s.heroWrap}>
                <UtilityHero
                    title="Stock Locations"
                    subtitle="Manage warehouses, view stock by location, and transfer inventory between godowns."
                    icon="warehouse"
                    tone="info"
                />
            </View>

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : godowns.length === 0 ? (
                <View style={s.centered}>
                    <EmptyStateCard
                        icon="warehouse"
                        title="No godowns configured"
                        subtitle="Add warehouses to track stock location and transfers."
                        tone="info"
                        actionLabel="Add Godown"
                        onActionPress={() => router.push('/(main)/more/godowns/add')}
                    />
                </View>
            ) : (
                <FlatList
                    data={godowns}
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
                    renderItem={({ item }) => (
                        <Pressable
                            style={[s.row, getSurfaceStyle(colors, { elevated: true })]}
                            onPress={() => router.push(`/(main)/more/godowns/${item.id}`)}
                            onLongPress={() => dialog.alert('Delete Godown', `Delete "${item.name}"?`, [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: () => {
                                        void deleteGodown(item.id).catch((error) => {
                                            dialog.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete godown.');
                                        });
                                    },
                                },
                            ])}
                        >
                            <View style={[s.iconWrap, { backgroundColor: withAlpha(colors.primary, '20') }]}>
                                <MaterialCommunityIcons name="warehouse" size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.rowTitle, { color: colors.text }]}>{item.name}</Text>
                                {item.address ? (
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {item.address}
                                    </Text>
                                ) : null}
                                {item.managerName ? (
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                                        Manager: {item.managerName}
                                    </Text>
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
        centered: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: DESIGN_SPACING.screenX,
            gap: Spacing.sm,
        },
        addBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        topActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
        },
        secondaryBtn: {
            ...getPillStyle(colors),
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        heroWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.sectionGap },
        addBtnText: { color: colors.onPrimary, fontSize: Typography.caption.size, fontWeight: '700' },
        secondaryBtnText: { fontSize: Typography.caption.size, fontWeight: '700' },
        emptyTitle: { fontSize: Typography.title.size, fontWeight: '700' },
        emptyMeta: { fontSize: Typography.body.size, textAlign: 'center' },
        emptyBtn: {
            marginTop: Spacing.sm,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        emptyBtnText: { color: colors.onPrimary, fontSize: Typography.body.size, fontWeight: '700' },
        row: {
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
            padding: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        iconWrap: {
            width: 40,
            height: 40,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
        },
        rowTitle: { fontSize: Typography.body.size, fontWeight: '700' },
        rowMeta: { fontSize: Typography.caption.size, marginTop: 2 },
    });
