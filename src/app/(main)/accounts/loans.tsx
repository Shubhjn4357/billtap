import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useQuery } from '@tanstack/react-query';
import { loanApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import type { Loan } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';

export default function LoansScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['loans'],
        queryFn: () => loanApi.list(),
        staleTime: 60_000,
    });

    const loans = (data?.data ?? []) as Loan[];
    const totalBorrowed = loans.filter((entry) => entry.loanType === 'BORROWED').reduce((sum, entry) => sum + entry.currentBalance, 0);
    const totalLent = loans.filter((entry) => entry.loanType === 'GIVEN').reduce((sum, entry) => sum + entry.currentBalance, 0);
    const dueLoans = loans.filter((entry) => entry.dueDate).length;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Loans"
                subtitle="Borrowed and given balances"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={s.addBtn} onPress={() => router.push('/(main)/accounts/loans/add' as Parameters<typeof router.push>[0])}>
                        <MaterialCommunityIcons name="plus" size={18} color={colors.onPrimary} />
                    </Pressable>
                )}
            />

            <View style={s.summaryRow}>
                <View style={[s.summaryCard, { backgroundColor: withAlpha(colors.error, '18') }]}>
                    <Text style={[s.sumLabel, { color: colors.textSecondary }]}>Borrowed</Text>
                    <Text style={[s.sumVal, { color: colors.error }]}>Rs {totalBorrowed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
                <View style={[s.summaryCard, { backgroundColor: withAlpha(colors.success, '18') }]}>
                    <Text style={[s.sumLabel, { color: colors.textSecondary }]}>Given</Text>
                    <Text style={[s.sumVal, { color: colors.success }]}>Rs {totalLent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
            </View>

            <View style={s.statsRow}>
                <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.statLabel, { color: colors.textSecondary }]}>Accounts</Text>
                    <Text style={[s.statValue, { color: colors.text }]}>{loans.length}</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.statLabel, { color: colors.textSecondary }]}>Due Marked</Text>
                    <Text style={[s.statValue, { color: colors.warning }]}>{dueLoans}</Text>
                </View>
            </View>

            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Loan Accounts</Text>
            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={loans}
                    keyExtractor={(entry) => entry.id}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                refetch();
                            }}
                        />
                    )}
                    renderItem={({ item: loan }) => <LoanRow loan={loan} colors={colors} />}
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary, marginBottom: Spacing.sm }}>No loans. Add a loan.</Text>
                            <Pressable style={[s.emptyAddBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(main)/accounts/loans/add' as Parameters<typeof router.push>[0])}>
                                <Text style={s.emptyAddBtnText}>Add Loan</Text>
                            </Pressable>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}
        </SafeAreaView>
    );
}

function LoanRow({ loan, colors }: { loan: Loan; colors: ColorPalette }) {
    const isOut = loan.loanType === 'GIVEN';
    const color = isOut ? colors.success : colors.error;

    return (
        <Pressable
            style={[rowStyles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/(main)/accounts/loans/${loan.id}` as Parameters<typeof router.push>[0])}
        >
            <View style={[rowStyles.badge, { backgroundColor: withAlpha(color, '22') }]}>
                <Text style={{ color, fontWeight: '700', fontSize: 11 }}>{isOut ? 'GIVEN' : 'BORROWED'}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[rowStyles.name, { color: colors.text }]}>{loan.lenderBorrowerName}</Text>
                <Text style={[rowStyles.meta, { color: colors.textSecondary }]}>{loan.interestRatePercent}% p.a. - {loan.interestType}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={[rowStyles.bal, { color }]}>Rs {loan.currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                {loan.dueDate ? (
                    <Text style={[rowStyles.due, { color: colors.textSecondary }]}>Due: {new Date(loan.dueDate).toLocaleDateString('en-IN')}</Text>
                ) : null}
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} style={rowStyles.chevron} />
            </View>
        </Pressable>
    );
}

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
        borderRadius: Radius.card,
        borderWidth: 1,
        gap: Spacing.sm,
    },
    badge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
    name: { fontWeight: '600', fontSize: 14 },
    meta: { fontSize: 11, marginTop: 2 },
    bal: { fontWeight: '700', fontSize: 15 },
    due: { fontSize: 11 },
    chevron: { marginTop: 6, alignSelf: 'flex-end' },
});

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    addBtn: {
        backgroundColor: colors.primary,
        borderRadius: Radius.pill,
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    summaryCard: { flex: 1, borderRadius: Radius.card, padding: Spacing.lg },
    sumLabel: { fontSize: 12, marginBottom: 4 },
    sumVal: { fontSize: 20, fontWeight: '700' },
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    statCard: {
        flex: 1,
        borderWidth: 1,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    statLabel: { fontSize: Typography.caption.size, fontWeight: '600' },
    statValue: { marginTop: 2, fontSize: Typography.title.size, fontWeight: '800' },
    sectionLabel: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.xs,
        fontSize: Typography.caption.size,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    centered: { paddingTop: 80, alignItems: 'center' },
    emptyAddBtn: {
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    emptyAddBtnText: {
        color: colors.onPrimary,
        fontWeight: '700',
        fontSize: Typography.body.size,
    },
});
