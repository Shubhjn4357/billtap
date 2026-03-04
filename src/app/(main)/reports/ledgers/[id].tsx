import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../../constants/theme';

const formatDate = (value: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN');
};

type LedgerEntry = {
    id: string;
    voucherId: string;
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

    const { data, isLoading } = useQuery({
        queryKey: ['reports-ledger-detail', id],
        queryFn: () => accountingApi.getLedger(id!, { limit: 300 }),
        enabled: Boolean(id),
        staleTime: 60_000,
    });

    const account = data?.data?.account;
    const entries = useMemo<LedgerEntry[]>(() => data?.data?.entries ?? [], [data?.data?.entries]);
    const currentBalance = data?.data?.currentBalance ?? 0;
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [voucherType, setVoucherType] = useState('');
    const [balanceSide, setBalanceSide] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');

    const filteredEntries = useMemo(() => {
        const from = fromDate.trim() ? new Date(fromDate.trim()) : null;
        const to = toDate.trim() ? new Date(toDate.trim()) : null;
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
            if (balanceSide === 'DEBIT' && entry.runningBalance < 0) return false;
            if (balanceSide === 'CREDIT' && entry.runningBalance > 0) return false;
            return true;
        });
    }, [balanceSide, entries, fromDate, toDate, voucherType]);

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title} numberOfLines={1}>{account?.name ?? 'Ledger'}</Text>
                <View style={{ width: 44 }} />
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={filteredEntries}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <>
                            <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[s.summaryTitle, { color: colors.text }]}>{account?.name ?? 'Account'}</Text>
                                <Text style={[s.summaryMeta, { color: colors.textSecondary }]}>{account?.code} | {account?.type}</Text>
                                <Text style={[s.summaryBalance, { color: colors.primary }]}>Balance: Rs {currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            </View>

                            <View style={[s.filterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={s.filterTitle}>Filters</Text>
                                <TextInput
                                    style={[s.input, { borderColor: colors.border, color: colors.text }]}
                                    value={fromDate}
                                    onChangeText={setFromDate}
                                    placeholder="From date (YYYY-MM-DD)"
                                    placeholderTextColor={colors.textSecondary}
                                />
                                <TextInput
                                    style={[s.input, { borderColor: colors.border, color: colors.text }]}
                                    value={toDate}
                                    onChangeText={setToDate}
                                    placeholder="To date (YYYY-MM-DD)"
                                    placeholderTextColor={colors.textSecondary}
                                />
                                <TextInput
                                    style={[s.input, { borderColor: colors.border, color: colors.text }]}
                                    value={voucherType}
                                    onChangeText={setVoucherType}
                                    placeholder="Voucher type (e.g. SALES_INVOICE)"
                                    placeholderTextColor={colors.textSecondary}
                                />
                                <View style={s.balanceChipRow}>
                                    {(['ALL', 'DEBIT', 'CREDIT'] as const).map((option) => {
                                        const selected = balanceSide === option;
                                        return (
                                            <Pressable
                                                key={option}
                                                onPress={() => setBalanceSide(option)}
                                                style={[
                                                    s.balanceChip,
                                                    {
                                                        borderColor: selected ? colors.primary : colors.border,
                                                        backgroundColor: selected ? `${colors.primary}22` : colors.surfaceVariant,
                                                    },
                                                ]}
                                            >
                                                <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                                                    {option}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                                <Text style={[s.filterCount, { color: colors.textSecondary }]}>
                                    Showing {filteredEntries.length} of {entries.length} entries
                                </Text>
                            </View>
                        </>
                    }
                    renderItem={({ item }) => (
                        <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <View style={{ flex: 1 }}>
                                <Text style={s.rowTitle}>{item.voucherType} | {item.voucherNumber}</Text>
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
                    ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No ledger entries found.</Text>}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Spacing.sm,
        },
        back: { fontWeight: '600', fontSize: 14 },
        title: { flex: 1, textAlign: 'center', fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
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
        filterCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.md,
            gap: Spacing.xs,
        },
        filterTitle: { color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 2 },
        input: {
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 8,
            fontSize: 12,
        },
        balanceChipRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: 2, marginBottom: 2 },
        balanceChip: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
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
        rowTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
        rowMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        rowNarration: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        numbers: { alignItems: 'flex-end', gap: 1 },
        dr: { color: colors.success, fontWeight: '700', fontSize: 11 },
        cr: { color: colors.error, fontWeight: '700', fontSize: 11 },
        balance: { color: colors.textSecondary, fontWeight: '700', fontSize: 11 },
    });
