import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING, getSurfaceStyle } from '../../../../constants/designSystem';
import { Spacing, Radius, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { format, parseISO } from 'date-fns';
import type { LoanTransaction } from '../../../../types/domain';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { HubMetricCard } from '../../../../components/ui/HubBlocks';
import { UtilityEmptyState, UtilityHero, UtilitySection } from '../../../../components/ui/UtilityBlocks';
import { useLoanDetails } from '../../../../hooks/useLoans';

const toAmount = (value: unknown) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const getLoanName = (loan: { lenderBorrowerName?: string | null }) => loan.lenderBorrowerName?.trim() || 'Loan account';
const getLoanType = (loan: { loanType?: string | null }) => loan.loanType === 'GIVEN' ? 'GIVEN' : 'BORROWED';
const getInterestRate = (loan: { interestRatePercent?: unknown }) => toAmount(loan.interestRatePercent);

const formatDisplayDate = (value?: string | null, fallback = 'Date unavailable') => {
    if (!value) return fallback;
    try {
        return format(parseISO(value), 'dd MMM yyyy');
    } catch {
        return fallback;
    }
};

const getTransactionType = (txn: LoanTransaction) => txn.type ?? txn.transactionType ?? 'TRANSACTION';

export default function LoanDetailScreen() {
    const colors = useAppColors();
    const { id } = useLocalSearchParams<{ id: string }>();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');
    const detailRoute = `/(main)/accounts/loans/${id}`;

    const { loan, transactions, isLoading, isRefetching, refetch } = useLoanDetails(id, {
        enabled: Boolean(id),
    });

    if (isLoading) {
        return (
            <View style={s.centered}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    if (!loan) {
        return (
            <View style={s.centered}>
                <Text style={{ color: colors.textSecondary }}>Loan not found.</Text>
            </View>
        );
    }

    const isLent = getLoanType(loan) === 'GIVEN';
    const color = isLent ? colors.success : colors.error;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={getLoanName(loan)}
                subtitle={isLent ? 'Given loan' : 'Borrowed loan'}
                onBackPress={smartBack}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.content}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefetching}
                        onRefresh={() => {
                            void refetch();
                        }}
                    />
                )}
            >
                <View style={s.heroWrap}>
                    <UtilityHero
                        title={getLoanName(loan)}
                        subtitle={isLent ? 'Money given out and tracked with repayments.' : 'Borrowed money with running balance and interest.'}
                        icon={isLent ? 'cash-fast' : 'cash-clock'}
                        tone={isLent ? 'success' : 'warning'}
                        footer={(
                            <>
                                <View style={[s.statusChip, { backgroundColor: withAlpha(color, '14') }]}>
                                    <Text style={[s.statusChipText, { color }]}>{isLent ? 'GIVEN' : 'BORROWED'}</Text>
                                </View>
                                {loan.dueDate ? (
                                    <View style={[s.statusChip, { backgroundColor: withAlpha(colors.primary, '10') }]}>
                                        <Text style={[s.statusChipText, { color: colors.primary }]}>
                                            Due {formatDisplayDate(loan.dueDate)}
                                        </Text>
                                    </View>
                                ) : null}
                            </>
                        )}
                    />
                </View>

                <View style={s.statsRow}>
                    <HubMetricCard
                        label="Principal"
                        value={`Rs ${toAmount(loan.principalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        meta="Original amount"
                        tone={isLent ? 'success' : 'warning'}
                    />
                    <HubMetricCard
                        label="Balance"
                        value={`Rs ${toAmount(loan.currentBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        meta="Outstanding amount"
                        tone={toAmount(loan.currentBalance) > 0 ? 'info' : 'default'}
                    />
                    <HubMetricCard
                        label="Interest"
                        value={`${getInterestRate(loan)}%`}
                        meta="Configured rate"
                        tone="default"
                    />
                </View>

                <UtilitySection title="Quick Actions" count={2}>
                    <View style={s.actionsRow}>
                        <Pressable
                            style={[s.actionBtn, getSurfaceStyle(colors, { accent: colors.success, elevated: true, muted: true })]}
                            onPress={() => router.push({ pathname: '/(main)/accounts/loans/[id]/payment', params: { id, returnPath: detailRoute } })}
                        >
                            <MaterialCommunityIcons name="cash-plus" size={16} color={colors.success} />
                            <Text style={[s.actionBtnText, { color: colors.success }]}>Add Payment</Text>
                        </Pressable>
                        <Pressable
                            style={[s.actionBtn, getSurfaceStyle(colors, { accent: colors.warning, elevated: true, muted: true })]}
                            onPress={() => router.push({ pathname: '/(main)/accounts/loans/[id]/interest', params: { id, returnPath: detailRoute } })}
                        >
                            <MaterialCommunityIcons name="percent-outline" size={16} color={colors.warning} />
                            <Text style={[s.actionBtnText, { color: colors.warning }]}>Add Interest</Text>
                        </Pressable>
                    </View>
                </UtilitySection>

                <UtilitySection title="Transaction History" count={transactions.length}>
                    {transactions.length === 0 ? (
                        <View style={s.emptyWrap}>
                            <UtilityEmptyState
                                icon="file-document-outline"
                                title="No transactions yet"
                                description="Repayments and interest postings will appear here after you record them."
                            />
                        </View>
                    ) : (
                        transactions.map((txn) => (
                            <View key={txn.id} style={[s.txnRow, getSurfaceStyle(colors, { elevated: true })]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.txnType, { color: colors.text }]}>{getTransactionType(txn).replace(/_/g, ' ')}</Text>
                                    <Text style={[s.txnDate, { color: colors.textSecondary }]}>{formatDisplayDate(txn.date)}</Text>
                                    {txn.description ? <Text style={[s.txnDesc, { color: colors.textSecondary }]}>{txn.description}</Text> : null}
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[s.txnAmt, { color: getTransactionType(txn) === 'REPAYMENT' ? colors.success : getTransactionType(txn) === 'INTEREST' ? colors.warning : colors.primary }]}>
                                        Rs {toAmount(txn.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </Text>
                                    <Text style={[s.txnBal, { color: colors.textSecondary }]}>Bal: Rs {toAmount(txn.balanceAfter).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </UtilitySection>

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        content: {
            paddingHorizontal: DESIGN_SPACING.screenX,
            paddingBottom: 80,
            gap: DESIGN_SPACING.sectionGap,
        },
        heroWrap: { marginTop: Spacing.sm },
        statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
        statusChip: {
            minHeight: 32,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
            justifyContent: 'center',
        },
        statusChipText: {
            fontSize: 12,
            fontWeight: '700',
        },
        actionsRow: { flexDirection: 'row', gap: Spacing.sm },
        actionBtn: {
            flex: 1,
            borderRadius: Radius.card,
            paddingVertical: Spacing.md,
            paddingHorizontal: Spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
        },
        actionBtnText: { fontWeight: '700', fontSize: 13 },
        emptyWrap: { paddingVertical: Spacing.lg },
        txnRow: { borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start' },
        txnType: { fontWeight: '600', fontSize: 14 },
        txnDate: { fontSize: 11, marginTop: 2 },
        txnDesc: { fontSize: 11, marginTop: 2 },
        txnAmt: { fontWeight: '700', fontSize: 15 },
        txnBal: { fontSize: 11, marginTop: 2 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    });
