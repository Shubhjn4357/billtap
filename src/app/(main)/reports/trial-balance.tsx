import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';

type TrialRow = {
    accountId: string;
    accountName: string;
    accountType: string;
    debitTotal: number;
    creditTotal: number;
};

export default function TrialBalanceScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['reports-trial-balance'],
        queryFn: () => accountingApi.getTrialBalance(),
        staleTime: 60_000,
    });

    const rows: TrialRow[] = data?.data?.rows ?? [];
    const totals = data?.data?.totals ?? { debit: 0, credit: 0, isBalanced: true };

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Trial Balance</Text>
                <View style={{ width: 44 }} />
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item) => item.accountId}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>TOTAL DEBIT</Text>
                            <Text style={s.summaryValue}>Rs {totals.debit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            <Text style={[s.summaryLabel, { color: colors.textSecondary, marginTop: 8 }]}>TOTAL CREDIT</Text>
                            <Text style={s.summaryValue}>Rs {totals.credit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            <Text style={[s.balanceTag, { color: totals.isBalanced ? colors.success : colors.error }]}>
                                {totals.isBalanced ? 'Balanced' : 'Mismatch'}
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <View style={{ flex: 1 }}>
                                <Text style={s.rowTitle}>{item.accountName}</Text>
                                <Text style={s.rowMeta}>{item.accountType}</Text>
                            </View>
                            <View style={s.numbers}>
                                <Text style={s.dr}>Dr {item.debitTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.cr}>Cr {item.creditTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No accounting entries yet.</Text>}
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
        },
        back: { fontWeight: '600', fontSize: 14 },
        title: { fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        summaryCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.md,
        },
        summaryLabel: { fontSize: 11, fontWeight: '700' },
        summaryValue: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 2 },
        balanceTag: { marginTop: 8, fontSize: 12, fontWeight: '700' },
        row: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        rowTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
        rowMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        numbers: { alignItems: 'flex-end', gap: 2 },
        dr: { color: colors.success, fontWeight: '700', fontSize: 12 },
        cr: { color: colors.error, fontWeight: '700', fontSize: 12 },
    });
