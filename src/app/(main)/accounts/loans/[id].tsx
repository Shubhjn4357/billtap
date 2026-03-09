import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, Radius, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { format, parseISO } from 'date-fns';
import type { LoanTransaction } from '../../../../types/domain';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
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
                <View style={[s.summaryCard, { backgroundColor: color }]}>
                    <Text style={s.sumType}>{isLent ? 'Given' : 'Borrowed'}</Text>
                    <Text style={s.sumName}>{getLoanName(loan)}</Text>
                    <View style={s.sumRow}>
                        <View style={s.sumCell}>
                            <Text style={s.sumCellLabel}>Principal</Text>
                            <Text style={s.sumCellVal}>Rs {toAmount(loan.principalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        </View>
                        <View style={s.sumCell}>
                            <Text style={s.sumCellLabel}>Balance</Text>
                            <Text style={s.sumCellVal}>Rs {toAmount(loan.currentBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        </View>
                        <View style={s.sumCell}>
                            <Text style={s.sumCellLabel}>Rate</Text>
                            <Text style={s.sumCellVal}>{getInterestRate(loan)}%</Text>
                        </View>
                    </View>
                    {loan.dueDate ? <Text style={s.dueDate}>Due: {formatDisplayDate(loan.dueDate)}</Text> : null}
                </View>

                <View style={s.actionsRow}>
                    <Pressable style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/(main)/accounts/loans/${id}/payment` as Parameters<typeof router.push>[0])}>
                        <MaterialCommunityIcons name="cash-plus" size={16} color={colors.onPrimary} />
                        <Text style={s.actionBtnText}>Add Payment</Text>
                    </Pressable>
                    <Pressable style={[s.actionBtn, { backgroundColor: colors.warning }]} onPress={() => router.push(`/(main)/accounts/loans/${id}/interest` as Parameters<typeof router.push>[0])}>
                        <MaterialCommunityIcons name="percent-outline" size={16} color={colors.onPrimary} />
                        <Text style={s.actionBtnText}>Add Interest</Text>
                    </Pressable>
                </View>

                <View style={s.txnSection}>
                    <Text style={[s.txnTitle, { color: colors.textSecondary }]}>TRANSACTION HISTORY</Text>
                    {transactions.length === 0 ? (
                        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.lg }}>No transactions yet.</Text>
                    ) : (
                        transactions.map((txn) => (
                            <View key={txn.id} style={[s.txnRow, { backgroundColor: colors.card }]}>
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
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        summaryCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.xl, marginBottom: Spacing.md },
        sumType: { color: withAlpha(colors.onPrimary, 'bb'), fontSize: 12, fontWeight: '600' },
        sumName: { color: colors.onPrimary, fontWeight: '800', fontSize: 22, marginTop: 4, marginBottom: Spacing.md },
        sumRow: { flexDirection: 'row', gap: Spacing.md },
        sumCell: { flex: 1 },
        sumCellLabel: { color: withAlpha(colors.onPrimary, 'bb'), fontSize: 11 },
        sumCellVal: { color: colors.onPrimary, fontWeight: '700', fontSize: 16, marginTop: 2 },
        dueDate: { color: withAlpha(colors.onPrimary, 'cc'), fontSize: 12, marginTop: Spacing.md },
        actionsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        actionBtn: {
            flex: 1,
            borderRadius: Radius.pill,
            paddingVertical: Spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
        },
        actionBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
        txnSection: { paddingHorizontal: Spacing.lg },
        txnTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
        txnRow: { borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start' },
        txnType: { fontWeight: '600', fontSize: 14 },
        txnDate: { fontSize: 11, marginTop: 2 },
        txnDesc: { fontSize: 11, marginTop: 2 },
        txnAmt: { fontWeight: '700', fontSize: 15 },
        txnBal: { fontSize: 11, marginTop: 2 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    });
