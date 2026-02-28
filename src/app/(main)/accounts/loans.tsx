// @ts-nocheck
import { View, Text, FlatList, Pressable, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { loanApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../constants/theme';
import type { Loan } from '../../../types/domain';

export default function LoansScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['loans'],
        queryFn: () => loanApi.list(),
        staleTime: 60_000,
    });

    const loans = (data?.data ?? []) as Loan[];
    const totalBorrowed = loans.filter((l) => l.loanType === 'BORROWED').reduce((s, l) => s + l.currentBalance, 0);
    const totalLent = loans.filter((l) => l.loanType === 'LENT').reduce((s, l) => s + l.currentBalance, 0);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Back</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>Loans</Text>
                <Pressable style={s.addBtn} onPress={() => router.push('/(main)/accounts/loans/add' as Parameters<typeof router.push>[0])}>
                    <Text style={s.addBtnText}>+ Add</Text>
                </Pressable>
            </View>

            {/* Summary */}
            <View style={s.summaryRow}>
                <View style={[s.summaryCard, { backgroundColor: colors.error + '18' }]}>
                    <Text style={[s.sumLabel, { color: colors.textSecondary }]}>Borrowed</Text>
                    <Text style={[s.sumVal, { color: colors.error }]}>₹{totalBorrowed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
                <View style={[s.summaryCard, { backgroundColor: colors.success + '18' }]}>
                    <Text style={[s.sumLabel, { color: colors.textSecondary }]}>Lent Out</Text>
                    <Text style={[s.sumVal, { color: colors.success }]}>₹{totalLent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={loans}
                    keyExtractor={(l) => l.id}
                    renderItem={({ item: loan }) => <LoanRow loan={loan} colors={colors} />}
                    ListEmptyComponent={<View style={s.centered}><Text style={{ color: colors.textSecondary }}>No loans. Add a loan!</Text></View>}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}
        </SafeAreaView>
    );
}

function LoanRow({ loan, colors }: { loan: Loan; colors: ColorPalette }) {
    const isOut = loan.loanType === 'LENT';
    const color = isOut ? colors.success : colors.error;
    return (
        <Pressable
            style={[rowS.row, { backgroundColor: colors.card }]}
            onPress={() => router.push(`/(main)/accounts/loans/${loan.id}` as Parameters<typeof router.push>[0])}
        >
            <View style={[rowS.badge, { backgroundColor: color + '22' }]}>
                <Text style={{ color, fontWeight: '700', fontSize: 11 }}>{isOut ? 'LENT' : 'BORROWED'}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[rowS.name, { color: colors.text }]}>{loan.lenderBorrowerName}</Text>
                <Text style={[rowS.meta, { color: colors.textSecondary }]}>{loan.interestRatePercent}% p.a. · {loan.interestType}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={[rowS.bal, { color }]}>₹{loan.currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                {loan.dueDate && <Text style={[rowS.due, { color: colors.textSecondary }]}>Due: {new Date(loan.dueDate).toLocaleDateString('en-IN')}</Text>}
            </View>
        </Pressable>
    );
}

const rowS = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.card, gap: Spacing.sm },
    badge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
    name: { fontWeight: '600', fontSize: 14 },
    meta: { fontSize: 11, marginTop: 2 },
    bal: { fontWeight: '700', fontSize: 15 },
    due: { fontSize: 11 },
});

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
    addBtn: { backgroundColor: colors.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
    addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    summaryRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    summaryCard: { flex: 1, borderRadius: Radius.card, padding: Spacing.lg },
    sumLabel: { fontSize: 12, marginBottom: 4 },
    sumVal: { fontSize: 20, fontWeight: '700' },
    centered: { paddingTop: 80, alignItems: 'center' },
});


