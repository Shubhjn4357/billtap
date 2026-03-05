import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { DateField } from '../../../../components/ui/DateField';
import { SelectField, type SelectOption } from '../../../../components/ui/SelectField';
import { useSmartBack } from '../../../../hooks/useSmartBack';

const formatDate = (value: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN');
};

type LedgerEntry = {
    id: string;
    voucherType: string;
    voucherNumber: string;
    date: string;
    narration: string | null;
    debit: number;
    credit: number;
    runningBalance: number;
};

export default function LedgerDetailScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/reports/ledgers');

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['reports-ledger-detail', id],
        queryFn: () => accountingApi.getLedger(id!, { limit: 300 }),
        enabled: Boolean(id),
        staleTime: 60_000,
    });

    const account = data?.data?.account;
    const entries = useMemo<LedgerEntry[]>(() => data?.data?.entries ?? [], [data?.data?.entries]);
    const currentBalance = data?.data?.currentBalance ?? 0;
    const voucherOptions = useMemo<SelectOption[]>(() => {
        const unique = Array.from(new Set(entries.map((entry) => entry.voucherType))).filter(Boolean);
        return unique.map((voucher) => ({
            label: voucher.replaceAll('_', ' '),
            value: voucher,
            description: `Filter ${voucher.replaceAll('_', ' ')} transactions`,
        }));
    }, [entries]);

    const [fromDate, setFromDate] = useState<string | null>(null);
    const [toDate, setToDate] = useState<string | null>(null);
    const [voucherType, setVoucherType] = useState('');

    const filteredEntries = useMemo(() => {
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;
        const voucher = voucherType.trim().toUpperCase();

        return entries.filter((entry) => {
            const entryDate = new Date(entry.date);
            if (from && !Number.isNaN(from.getTime()) && entryDate < from) return false;
            if (to && !Number.isNaN(to.getTime())) {
                const toInclusive = new Date(to);
                toInclusive.setHours(23, 59, 59, 999);
                if (entryDate > toInclusive) return false;
            }
            if (voucher && !entry.voucherType.toUpperCase().includes(voucher)) return false;
            return true;
        });
    }, [entries, fromDate, toDate, voucherType]);

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
                                refetch();
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <>
                            <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[s.summaryTitle, { color: colors.text }]}>{account?.name ?? 'Account'}</Text>
                                <Text style={[s.summaryMeta, { color: colors.textSecondary }]}>{account?.code} | {account?.type}</Text>
                                <Text style={[s.summaryBalance, { color: colors.primary }]}>Balance: Rs {currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <View style={s.statRow}>
                                    <View style={[s.statChip, { backgroundColor: colors.surfaceVariant }]}>
                                        <Text style={[s.statLabel, { color: colors.textSecondary }]}>Entries</Text>
                                        <Text style={s.statValue}>{entries.length}</Text>
                                    </View>
                                    <View style={[s.statChip, { backgroundColor: colors.surfaceVariant }]}>
                                        <Text style={[s.statLabel, { color: colors.textSecondary }]}>Visible</Text>
                                        <Text style={s.statValue}>{filteredEntries.length}</Text>
                                    </View>
                                </View>
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
                                <Text style={s.rowMeta}>{formatDate(item.date)}</Text>
                                {item.narration ? <Text style={s.rowNarration}>{item.narration}</Text> : null}
                            </View>
                            <View style={s.numbers}>
                                <Text style={s.dr}>Dr {item.debit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.cr}>Cr {item.credit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.balance}>Bal {item.runningBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={(
                        <View style={[s.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="book-search-outline" size={22} color={colors.textSecondary} />
                            <Text style={[s.emptyTitle, { color: colors.text }]}>No ledger entries found</Text>
                            <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>Adjust filters or create transactions.</Text>
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
        summaryCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.md,
        },
        summaryTitle: { fontSize: 15, fontWeight: '700' },
        summaryMeta: { fontSize: 12, marginTop: 2 },
        summaryBalance: { marginTop: 6, fontSize: 13, fontWeight: '700' },
        statRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        statChip: {
            flex: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.sm,
        },
        statLabel: { fontSize: Typography.caption.size, fontWeight: '600' },
        statValue: { marginTop: 2, color: colors.text, fontSize: Typography.title.size, fontWeight: '800' },
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
        emptyState: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingVertical: Spacing.lg,
            alignItems: 'center',
            gap: 2,
        },
        emptyTitle: { fontSize: Typography.body.size, fontWeight: '700' },
        emptySubtitle: { fontSize: Typography.caption.size },
    });
