import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { toUserMessage } from '../../../api/client';
import { LEDGER_SORT_OPTIONS, LEDGER_TYPE_FILTER_OPTIONS, type LedgerSortKey, type LedgerTypeFilter } from '../../../constants/reportOptions';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { usePermissions } from '../../../hooks/usePermissions';
import { useLedgers, type LedgerRow } from '../../../hooks/useLedgers';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { EmptyStateCard } from '../../../components/ui/ListBlocks';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useAccountingAccountMutations } from '../../../hooks/useAccountingMutations';

export default function LedgersListScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/reports');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<LedgerTypeFilter>('ALL');
    const [sortBy, setSortBy] = useState<LedgerSortKey>('name_asc');
    const [groupByType, setGroupByType] = useState(false);
    const { selection } = useHaptics();
    const dialog = useAppDialog();
    const { isManager } = usePermissions();
    const { deactivateAccount, isDeactivatingAccount } = useAccountingAccountMutations();

    const { rows, groups, totals, isLoading, isRefetching, refetch, typeLabels } = useLedgers({
        search,
        typeFilter,
        sortBy,
    });

    const getTypeStyle = (type: string) => {
        const upper = type.toUpperCase();
        if (upper === 'ASSET') return { color: colors.success, bg: withAlpha(colors.success, '16'), icon: 'cash-plus' as const };
        if (upper === 'LIABILITY') return { color: colors.error, bg: withAlpha(colors.error, '16'), icon: 'cash-minus' as const };
        if (upper === 'INCOME') return { color: colors.primary, bg: withAlpha(colors.primary, '16'), icon: 'trending-up' as const };
        if (upper === 'EXPENSE') return { color: colors.warning, bg: withAlpha(colors.warning, '16'), icon: 'trending-down' as const };
        return { color: colors.info, bg: withAlpha(colors.info, '16'), icon: 'book-outline' as const };
    };

    const canDeactivate = (row: LedgerRow): string | null => {
        if (!isManager) return 'Your role cannot deactivate ledgers.';
        if (!row.isActive) return 'Ledger is already inactive.';
        if (row.isSystem || row.isDefault) return 'System/default ledgers cannot be deactivated.';
        if (Math.abs(row.debitTotal ?? 0) > 0.0001 || Math.abs(row.creditTotal ?? 0) > 0.0001) return 'Ledger has posted entries.';
        return null;
    };

    const renderLedgerRow = ({ item }: { item: LedgerRow }) => {
        const typeStyle = getTypeStyle(item.type);
        const reason = canDeactivate(item);
        return (
            <Pressable
                style={({ pressed }) => [s.row, getSurfaceStyle(colors, { elevated: true }), { opacity: pressed ? 0.84 : 1 }]}
                onPress={() => { void selection(); router.push(`/(main)/reports/ledgers/${item.id}` as Parameters<typeof router.push>[0]); }}
            >
                <View style={{ flex: 1, gap: 3 }}>
                    <View style={s.rowTitleWrap}>
                        <Text style={[s.rowTitle, { color: colors.text }]}>{item.name}</Text>
                        <View style={[s.typeBadge, { backgroundColor: typeStyle.bg }]}>
                            <MaterialCommunityIcons name={typeStyle.icon} size={11} color={typeStyle.color} />
                            <Text style={[s.typeBadgeText, { color: typeStyle.color }]}>{item.type}</Text>
                        </View>
                    </View>
                    <Text style={[s.rowMeta, { color: colors.textSecondary }]}>Code: {item.code}</Text>
                </View>
                <View style={s.numbers}>
                    <Text style={[s.dr, { color: colors.success }]}>Dr {Number(item.debitTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                    <Text style={[s.cr, { color: colors.error }]}>Cr {Number(item.creditTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                    <Text style={[s.balance, { color: colors.textSecondary }]}>Bal {Number(item.balance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                </View>
                <Pressable
                    style={[s.deactivateBtn, reason ? getPillStyle(colors) : getPillStyle(colors, colors.error)]}
                    onPress={(ev) => {
                        ev.stopPropagation();
                        if (reason) { dialog.alert('Cannot deactivate', reason); return; }
                        dialog.alert('Deactivate ledger', `Deactivate "${item.name}"?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Deactivate',
                                style: 'destructive',
                                onPress: async () => {
                                    try {
                                        await deactivateAccount(item.id);
                                        void refetch();
                                        dialog.alert('Ledger deactivated', 'Ledger has been deactivated successfully.');
                                    } catch (error) {
                                        dialog.alert('Deactivate failed', toUserMessage(error, 'Unable to deactivate this ledger.'));
                                    }
                                },
                            },
                        ]);
                    }}
                >
                    <MaterialCommunityIcons name={reason ? 'lock-outline' : 'archive-arrow-down-outline'} size={14} color={reason ? colors.textSecondary : colors.error} />
                </Pressable>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
            </Pressable>
        );
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar title="Ledgers" subtitle="Account-wise balances" onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.groupToggle, { borderColor: groupByType ? colors.primary : colors.border, backgroundColor: groupByType ? withAlpha(colors.primary, '16') : 'transparent' }]}
                        onPress={() => setGroupByType((v) => !v)}>
                        <MaterialCommunityIcons name="format-list-group" size={15} color={groupByType ? colors.primary : colors.textSecondary} />
                    </Pressable>
                )}
            />

            <View style={s.searchWrap}>
                <AppSearchBar value={search} onChangeText={setSearch} placeholder="Search name, code or type..." />
            </View>

            {/* Type Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll} contentContainerStyle={s.typeRow}>
                {LEDGER_TYPE_FILTER_OPTIONS.map((tf) => {
                    const sel = typeFilter === tf.key;
                    const tone = tf.key === 'ASSET' ? 'success' : tf.key === 'LIABILITY' ? 'danger' : tf.key === 'EXPENSE' ? 'warning' : 'info';
                    return (
                        <ChipButton
                            key={tf.key}
                            label={tf.key === 'ALL' ? 'All' : typeLabels[tf.key]}
                            icon={tf.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                            selected={sel}
                            tone={tone}
                            onPress={() => { void selection(); setTypeFilter(tf.key); }}
                        />
                    );
                })}
            </ScrollView>

            {/* Sort */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll} contentContainerStyle={s.typeRow}>
                {LEDGER_SORT_OPTIONS.map((so) => {
                    const sel = sortBy === so.key;
                    return (
                        <ChipButton key={so.key} label={so.label} selected={sel} tone="info" onPress={() => setSortBy(so.key)} />
                    );
                })}
                <View style={[s.totalsBadge, getPillStyle(colors)]}>
                    <Text style={[s.totalsText, { color: colors.textSecondary }]}>{totals.count}/{totals.allCount} ledgers</Text>
                </View>
            </ScrollView>

            {isLoading ? (
                <ListSkeleton rows={7} />
            ) : groupByType ? (
                <SectionList
                    sections={groups.map((g) => ({ title: g.label, data: g.rows, totalBalance: g.totalBalance, type: g.type }))}
                    keyExtractor={(item) => item.id}
                    renderItem={renderLedgerRow}
                    renderSectionHeader={({ section }) => {
                        const tStyle = getTypeStyle(section.type);
                        return (
                            <View style={[s.sectionHeader, { backgroundColor: tStyle.bg }]}>
                                <MaterialCommunityIcons name={tStyle.icon} size={13} color={tStyle.color} />
                                <Text style={[s.sectionHeaderText, { color: tStyle.color }]}>{section.title}</Text>
                                <Text style={[s.sectionHeaderBalance, { color: tStyle.color }]}>
                                    {Number(section.totalBalance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                        );
                    }}
                    contentContainerStyle={{ paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: 120 }}
                    refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isRefetching} onRefresh={() => { void refetch(); }} />}
                    ListEmptyComponent={<LedgerEmpty colors={colors} />}
                />
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item) => item.id}
                    renderItem={renderLedgerRow}
                    contentContainerStyle={{ paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: 120 }}
                    refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isRefetching || isDeactivatingAccount} onRefresh={() => { void refetch(); }} />}
                    ListHeaderComponent={(
                        <View style={[s.summaryCard, getSurfaceStyle(colors, { elevated: true })]}>
                            <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>LEDGERS</Text>
                            <Text style={[s.summaryValue, { color: colors.text }]}>{totals.count}</Text>
                        </View>
                    )}
                            ListEmptyComponent={<LedgerEmpty colors={colors} />}
                />
            )}
        </SafeAreaView>
    );
}

function LedgerEmpty({ colors }: { colors: ColorPalette }) {
    return (
        <EmptyStateCard
            icon="book-search-outline"
            title="No ledgers found"
            subtitle="Create accounting entries to generate ledgers."
            tone="info"
        />
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    searchWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.xs },
    typeScroll: { flexGrow: 0 },
    typeRow: { paddingHorizontal: DESIGN_SPACING.screenX, gap: Spacing.xs, paddingVertical: 4 },
    totalsBadge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
    totalsText: { fontSize: 11, fontWeight: '600' },
    groupToggle: { ...getPillStyle(colors), width: 32, height: 32, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    summaryCard: { borderRadius: Radius.card, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
    summaryLabel: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
    summaryValue: { marginTop: 2, fontSize: Typography.headline.size, fontWeight: '800' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.md, marginBottom: Spacing.xs, marginTop: Spacing.sm },
    sectionHeaderText: { flex: 1, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
    sectionHeaderBalance: { fontWeight: '700', fontSize: 12 },
    row: { borderRadius: Radius.card, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    rowTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
    rowTitle: { fontWeight: '700', fontSize: 13 },
    typeBadge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.xs, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
    typeBadgeText: { fontSize: Typography.caption.size, fontWeight: '700' },
    rowMeta: { fontSize: 11 },
    numbers: { alignItems: 'flex-end', gap: 2 },
    dr: { fontWeight: '700', fontSize: 11 },
    cr: { fontWeight: '700', fontSize: 11 },
    balance: { fontWeight: '700', fontSize: 11 },
    deactivateBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.xs, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
});
