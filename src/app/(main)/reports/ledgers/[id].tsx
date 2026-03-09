import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { DateField } from '../../../../components/ui/DateField';
import { HubMetricCard } from '../../../../components/ui/HubBlocks';
import { SelectField } from '../../../../components/ui/SelectField';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { UtilityEmptyState, UtilityHero } from '../../../../components/ui/UtilityBlocks';
import { useAccountingLedgerDetail } from '../../../../hooks/useAccountingMutations';
import { buildLedgerVoucherOptions, filterLedgerEntries, formatInr, formatReportDate, type LedgerEntryLike } from '../../../../selectors/reportSelectors';

type LedgerEntry = LedgerEntryLike;

export default function LedgerDetailScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/reports/ledgers');
    const { account, entries: rawEntries, currentBalance, isLoading, isRefetching, refetch } = useAccountingLedgerDetail(id, {
        limit: 300,
        staleTime: 60_000,
    });
    const entries = useMemo<LedgerEntry[]>(() => rawEntries as LedgerEntry[], [rawEntries]);
    const voucherOptions = useMemo(() => buildLedgerVoucherOptions(entries), [entries]);

    const [fromDate, setFromDate] = useState<string | null>(null);
    const [toDate, setToDate] = useState<string | null>(null);
    const [voucherType, setVoucherType] = useState('');

    const filteredEntries = useMemo(
        () =>
            filterLedgerEntries(entries, {
                fromDate,
                toDate,
                voucherType,
            }),
        [entries, fromDate, toDate, voucherType]
    );

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={account?.name ?? 'Ledger'}
                subtitle="Voucher-wise entries"
                onBackPress={smartBack}
            />

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={filteredEntries}
                    keyExtractor={(item) => item.id}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                void refetch();
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <>
                            <View style={s.heroWrap}>
                                <UtilityHero
                                    title={account?.name ?? 'Ledger'}
                                    subtitle={account?.code ? `${account.code} - ${account?.type}` : 'Voucher-wise entries'}
                                    icon="book-open-page-variant-outline"
                                    tone="info"
                                />
                            </View>
                            <View style={s.statsRow}>
                                <HubMetricCard label="Balance" value={formatInr(currentBalance)} meta="Running balance" tone="info" />
                                <HubMetricCard label="Entries" value={String(entries.length)} meta="All rows" tone="success" />
                                <HubMetricCard label="Visible" value={String(filteredEntries.length)} meta="After filters" tone="warning" />
                            </View>

                            <View style={[s.filterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={s.filterTitle}>Filters</Text>
                                <DateField value={fromDate} onChange={setFromDate} placeholder="From date" />
                                <DateField value={toDate} onChange={setToDate} placeholder="To date" />
                                <SelectField
                                    value={voucherType || null}
                                    title="Voucher Type"
                                    placeholder="All voucher types"
                                    options={voucherOptions}
                                    onChange={setVoucherType}
                                    allowClear
                                    onClear={() => setVoucherType('')}
                                />
                                <Text style={[s.filterCount, { color: colors.textSecondary }]}>Showing {filteredEntries.length} of {entries.length} entries</Text>
                            </View>
                        </>
                    }
                    renderItem={({ item }) => (
                        <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={{ flex: 1 }}>
                                <View style={s.rowTitleWrap}>
                                    <Text style={s.rowTitle}>{item.voucherNumber}</Text>
                                    <Text style={[s.voucherBadge, { backgroundColor: withAlpha(colors.info, '14'), color: colors.info }]}>
                                        {item.voucherType.replaceAll('_', ' ')}
                                    </Text>
                                </View>
                                <Text style={s.rowMeta}>{formatReportDate(item.date)}</Text>
                                {item.narration ? <Text style={s.rowNarration}>{item.narration}</Text> : null}
                            </View>
                            <View style={s.numbers}>
                                <Text style={s.dr}>Dr {formatInr(item.debit)}</Text>
                                <Text style={s.cr}>Cr {formatInr(item.credit)}</Text>
                                <Text style={s.balance}>Bal {formatInr(item.runningBalance)}</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={(
                        <View style={s.emptyWrap}>
                            <UtilityEmptyState icon="book-search-outline" title="No ledger entries found" description="Adjust filters or create transactions." />
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
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        heroWrap: { marginBottom: Spacing.sm },
        statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
        filterCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.md,
            gap: Spacing.sm,
        },
        filterTitle: { color: colors.text, fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
        filterCount: { fontSize: 11, marginTop: 2 },
        row: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            gap: Spacing.sm,
        },
        rowTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
        rowTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
        voucherBadge: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 2,
            fontSize: Typography.caption.size,
            fontWeight: '700',
            overflow: 'hidden',
        },
        rowMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        rowNarration: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        numbers: { alignItems: 'flex-end', gap: 2 },
        dr: { color: colors.success, fontWeight: '700', fontSize: 11 },
        cr: { color: colors.error, fontWeight: '700', fontSize: 11 },
        balance: { color: colors.textSecondary, fontWeight: '700', fontSize: 11 },
        emptyWrap: { paddingVertical: Spacing.lg },
    });
