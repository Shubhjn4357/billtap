import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, useColorScheme, View } from 'react-native';
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
    const entries: LedgerEntry[] = data?.data?.entries ?? [];
    const currentBalance = data?.data?.currentBalance ?? 0;

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
                    data={entries}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <Text style={[s.summaryTitle, { color: colors.text }]}>{account?.name ?? 'Account'}</Text>
                            <Text style={[s.summaryMeta, { color: colors.textSecondary }]}>{account?.code} | {account?.type}</Text>
                            <Text style={[s.summaryBalance, { color: colors.primary }]}>Balance: Rs {currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                        </View>
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
