import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { DESIGN_SPACING, getSurfaceStyle } from '../../../constants/designSystem';
import { Spacing, Radius, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import type { Loan } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { EmptyStateCard } from '../../../components/ui/ListBlocks';
import { SwipeableRow } from '../../../components/ui/SwipeableRow';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useLoans } from '../../../hooks/useLoans';

const toAmount = (value: unknown) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const getLoanName = (loan: Partial<Loan>) => loan.lenderBorrowerName?.trim() || 'Loan account';
const getLoanType = (loan: Partial<Loan>) => loan.loanType === 'GIVEN' ? 'GIVEN' : 'BORROWED';
const getInterestRate = (loan: Partial<Loan>) => toAmount(loan.interestRatePercent);
const getInterestType = (loan: Partial<Loan>) => loan.interestType ?? 'SIMPLE';

const formatDueDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString('en-IN');
};

export default function LoansScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');

    const { loans, isLoading, isRefetching, refetch, stats } = useLoans({
        staleTime: 60_000,
    });
    const totalBorrowed = stats.totalBorrowed;
    const totalLent = stats.totalLent;
    const dueLoans = stats.dueLoans;

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

            <View style={s.heroWrap}>
                <UtilityHero
                    title="Loan Ledger"
                    subtitle="Track borrowed and given balances, due status, and interest profiles from one list."
                    icon="hand-coin-outline"
                    tone="info"
                />
            </View>

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
                <View style={[s.statCard, getSurfaceStyle(colors, { elevated: true })]}>
                    <Text style={[s.statLabel, { color: colors.textSecondary }]}>Accounts</Text>
                    <Text style={[s.statValue, { color: colors.text }]}>{loans.length}</Text>
                </View>
                <View style={[s.statCard, getSurfaceStyle(colors, { elevated: true })]}>
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
                        <EmptyStateCard
                            icon="hand-coin-outline"
                            title="No loans yet"
                            subtitle="Add a loan account to track borrowed and given balances."
                            tone="info"
                            actionLabel="Add Loan"
                            onActionPress={() => router.push('/(main)/accounts/loans/add' as Parameters<typeof router.push>[0])}
                        />
                    }
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}
        </SafeAreaView>
    );
}

function LoanRow({ loan, colors }: { loan: Loan; colors: ColorPalette }) {
    const isOut = getLoanType(loan) === 'GIVEN';
    const color = isOut ? colors.success : colors.error;
    const dueDateLabel = formatDueDate(loan.dueDate);

    return (
        <SwipeableRow
            leftActions={[
                { label: 'Open', icon: 'arrow-top-right', onPress: () => router.push(`/(main)/accounts/loans/${loan.id}` as Parameters<typeof router.push>[0]), tone: 'info' },
            ]}
        >
            <Pressable
                style={({ pressed }) => [rowStyles.row, getSurfaceStyle(colors, { elevated: true }), { opacity: pressed ? 0.86 : 1 }]}
                onPress={() => router.push(`/(main)/accounts/loans/${loan.id}` as Parameters<typeof router.push>[0])}
            >
                <View style={[rowStyles.badge, { backgroundColor: withAlpha(color, '22') }]}>
                    <Text style={{ color, fontWeight: '700', fontSize: 11 }}>{isOut ? 'GIVEN' : 'BORROWED'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[rowStyles.name, { color: colors.text }]}>{getLoanName(loan)}</Text>
                    <Text style={[rowStyles.meta, { color: colors.textSecondary }]}>{getInterestRate(loan)}% p.a. - {getInterestType(loan)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[rowStyles.bal, { color }]}>Rs {toAmount(loan.currentBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    {dueDateLabel ? (
                        <Text style={[rowStyles.due, { color: colors.textSecondary }]}>Due: {dueDateLabel}</Text>
                    ) : null}
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} style={rowStyles.chevron} />
                </View>
            </Pressable>
        </SwipeableRow>
    );
}

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        marginHorizontal: DESIGN_SPACING.screenX,
        marginBottom: Spacing.sm,
        borderRadius: Radius.card,
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
    heroWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
    addBtn: {
        backgroundColor: colors.primary,
        borderRadius: Radius.pill,
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.sectionGap },
    summaryCard: { flex: 1, borderRadius: Radius.card, padding: Spacing.lg },
    sumLabel: { fontSize: 12, marginBottom: 4 },
    sumVal: { fontSize: 20, fontWeight: '700' },
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingHorizontal: DESIGN_SPACING.screenX,
        marginBottom: Spacing.sm,
    },
    statCard: {
        flex: 1,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    statLabel: { fontSize: Typography.caption.size, fontWeight: '600' },
    statValue: { marginTop: 2, fontSize: Typography.title.size, fontWeight: '800' },
    sectionLabel: {
        paddingHorizontal: DESIGN_SPACING.screenX,
        marginBottom: Spacing.xs,
        fontSize: Typography.caption.size,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    centered: { paddingTop: 80, alignItems: 'center' },
    emptyAddBtn: {
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    emptyAddBtnText: {
        color: colors.onPrimary,
        fontWeight: '700',
        fontSize: Typography.body.size,
    },
});
