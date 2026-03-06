import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { accountingApi } from '../../../api/endpoints';
import { toUserMessage } from '../../../api/client';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { usePermissions } from '../../../hooks/usePermissions';
import { useLedgers, type LedgerRow, type LedgerTypeFilter, type LedgerSortKey } from '../../../hooks/useLedgers';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppDialog } from '@/components/providers/DialogProvider';

const TYPE_FILTERS: { key: LedgerTypeFilter; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { key: 'ALL', icon: 'view-list-outline' },
    { key: 'ASSET', icon: 'cash-plus' },
    { key: 'LIABILITY', icon: 'cash-minus' },
    { key: 'INCOME', icon: 'trending-up' },
    { key: 'EXPENSE', icon: 'trending-down' },
    { key: 'EQUITY', icon: 'scale-balance' },
];

const SORT_OPTIONS: { key: LedgerSortKey; label: string }[] = [
    { key: 'name_asc', label: 'Name A–Z' },
    { key: 'balance_desc', label: 'Balance ↓' },
    { key: 'balance_asc', label: 'Balance ↑' },
];

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

    const { mutate: deactivateLedger } = useMutation({
        mutationFn: (accountId: string) => accountingApi.deactivateAccount(accountId),
        onSuccess: () => { void refetch(); dialog.alert('Ledger deactivated', 'Ledger has been deactivated successfully.'); },
        onError: (error) => dialog.alert('Deactivate failed', toUserMessage(error, 'Unable to deactivate this ledger.')),
    });

    const renderLedgerRow = ({ item }: { item: LedgerRow }) => {
        const typeStyle = getTypeStyle(item.type);
        const reason = canDeactivate(item);
        return (
            <Pressable
                style={({ pressed }) => [s.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.84 : 1 }]}
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
                    style={[s.deactivateBtn, { borderColor: reason ? colors.border : colors.error }]}
                    onPress={(ev) => {
                        ev.stopPropagation();
                        if (reason) { dialog.alert('Cannot deactivate', reason); return; }
                        dialog.alert('Deactivate ledger', `Deactivate "${item.name}"?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Deactivate', style: 'destructive', onPress: () => deactivateLedger(item.id) },
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
                {TYPE_FILTERS.map((tf) => {
                    const sel = typeFilter === tf.key;
                    const tStyle = tf.key !== 'ALL' ? getTypeStyle(tf.key) : { color: colors.primary, bg: withAlpha(colors.primary, '16') };
                    return (
                        <Pressable key={tf.key} style={[s.typeChip, { borderColor: sel ? tStyle.color : colors.border, backgroundColor: sel ? tStyle.bg : 'transparent' }]}
                            onPress={() => { void selection(); setTypeFilter(tf.key); }}>
                            <MaterialCommunityIcons name={tf.icon} size={13} color={sel ? tStyle.color : colors.textSecondary} />
                            <Text style={[s.typeChipText, { color: sel ? tStyle.color : colors.textSecondary, fontWeight: sel ? '700' : '500' }]}>
                                {tf.key === 'ALL' ? 'All' : typeLabels[tf.key]}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Sort */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll} contentContainerStyle={s.typeRow}>
                {SORT_OPTIONS.map((so) => {
                    const sel = sortBy === so.key;
                    return (
                        <Pressable key={so.key} style={[s.sortChip, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? withAlpha(colors.primary, '16') : 'transparent' }]}
                            onPress={() => setSortBy(so.key)}>
                            <Text style={[s.typeChipText, { color: sel ? colors.primary : colors.textSecondary }]}>{so.label}</Text>
                        </Pressable>
                    );
                })}
                <View style={[s.totalsBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isRefetching} onRefresh={() => refetch()} />}
                    ListEmptyComponent={<LedgerEmpty colors={colors} />}
                />
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item) => item.id}
                    renderItem={renderLedgerRow}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isRefetching} onRefresh={() => refetch()} />}
                    ListHeaderComponent={(
                        <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
            <MaterialCommunityIcons name="book-search-outline" size={36} color={colors.textSecondary} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>No ledgers found</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Create accounting entries to generate ledgers.</Text>
        </View>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    searchWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs },
    typeScroll: { flexGrow: 0 },
    typeRow: { paddingHorizontal: Spacing.lg, gap: Spacing.xs, paddingVertical: 4 },
    typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
    typeChipText: { fontSize: 12 },
    sortChip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
    totalsBadge: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
    totalsText: { fontSize: 11, fontWeight: '600' },
    groupToggle: { width: 32, height: 32, borderWidth: 1, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    summaryCard: { borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
    summaryLabel: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
    summaryValue: { marginTop: 2, fontSize: Typography.headline.size, fontWeight: '800' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.md, marginBottom: Spacing.xs, marginTop: Spacing.sm },
    sectionHeaderText: { flex: 1, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
    sectionHeaderBalance: { fontWeight: '700', fontSize: 12 },
    row: { borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    rowTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
    rowTitle: { fontWeight: '700', fontSize: 13 },
    typeBadge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.xs, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
    typeBadgeText: { fontSize: Typography.caption.size, fontWeight: '700' },
    rowMeta: { fontSize: 11 },
    numbers: { alignItems: 'flex-end', gap: 2 },
    dr: { fontWeight: '700', fontSize: 11 },
    cr: { fontWeight: '700', fontSize: 11 },
    balance: { fontWeight: '700', fontSize: 11 },
    deactivateBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.xs, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
});
