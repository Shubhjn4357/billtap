// @ts-nocheck
import { View, Text, ScrollView, Pressable, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { loanApi } from '../../../../api/endpoints';
import { Colors, Spacing, Radius } from '../../../../constants/theme';
import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
import type { LoanTransaction } from '../../../../types/domain';

export default function LoanDetailScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme as 'light' | 'dark'] ?? Colors.light;
    const { id } = useLocalSearchParams<{ id: string }>();
    const s = styles(colors);

    const { data: loanData, isLoading } = useQuery({
        queryKey: ['loan', id],
        queryFn: () => loanApi.get(id!),
        enabled: !!id,
    });

    const { data: txnData } = useQuery({
        queryKey: ['loan-transactions', id],
        queryFn: () => loanApi.getTransactions(id!),
        enabled: !!id,
    });

    const loan = loanData?.data;
    const transactions = (txnData?.data ?? []) as LoanTransaction[];

    if (isLoading) return <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>;
    if (!loan) return <View style={s.centered}><Text style={{ color: colors.textSecondary }}>Loan not found.</Text></View>;

    const isLent = loan.loanType === 'LENT';
    const color = isLent ? colors.success : colors.error;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Back</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>{loan.lenderBorrowerName}</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Summary */}
                <View style={[s.summaryCard, { backgroundColor: color }]}>
                    <Text style={s.sumType}>{isLent ? '💸 Lent Out' : '🏛 Borrowed'}</Text>
                    <Text style={s.sumName}>{loan.lenderBorrowerName}</Text>
                    <View style={s.sumRow}>
                        <View style={s.sumCell}>
                            <Text style={s.sumCellLabel}>Principal</Text>
                            <Text style={s.sumCellVal}>₹{loan.principalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        </View>
                        <View style={s.sumCell}>
                            <Text style={s.sumCellLabel}>Balance</Text>
                            <Text style={s.sumCellVal}>₹{loan.currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        </View>
                        <View style={s.sumCell}>
                            <Text style={s.sumCellLabel}>Rate</Text>
                            <Text style={s.sumCellVal}>{loan.interestRatePercent}%</Text>
                        </View>
                    </View>
                    {loan.dueDate && <Text style={s.dueDate}>Due: {format(parseISO(loan.dueDate), 'dd MMM yyyy')}</Text>}
                </View>

                {/* Quick actions */}
                <View style={s.actionsRow}>
                    <Pressable style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/(main)/accounts/loans/${id}/payment` as Parameters<typeof router.push>[0])}>
                        <Text style={s.actionBtnText}>+ Add Payment</Text>
                    </Pressable>
                    <Pressable style={[s.actionBtn, { backgroundColor: colors.warning }]} onPress={() => router.push(`/(main)/accounts/loans/${id}/interest` as Parameters<typeof router.push>[0])}>
                        <Text style={s.actionBtnText}>+ Add Interest</Text>
                    </Pressable>
                </View>

                {/* Transactions */}
                <View style={s.txnSection}>
                    <Text style={[s.txnTitle, { color: colors.textSecondary }]}>TRANSACTION HISTORY</Text>
                    {transactions.length === 0 ? (
                        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.lg }}>No transactions yet.</Text>
                    ) : (
                        transactions.map((txn) => (
                            <View key={txn.id} style={[s.txnRow, { backgroundColor: colors.card }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.txnType, { color: colors.text }]}>{txn.type.replace(/_/g, ' ')}</Text>
                                    <Text style={[s.txnDate, { color: colors.textSecondary }]}>{format(parseISO(txn.date), 'dd MMM yyyy')}</Text>
                                    {txn.description && <Text style={[s.txnDesc, { color: colors.textSecondary }]}>{txn.description}</Text>}
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[s.txnAmt, { color: txn.type === 'REPAYMENT' ? colors.success : txn.type === 'INTEREST' ? colors.warning : colors.primary }]}>
                                        ₹{txn.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </Text>
                                    <Text style={[s.txnBal, { color: colors.textSecondary }]}>Bal: ₹{txn.balanceAfter.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
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

const styles = (colors: typeof Colors.light) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
    summaryCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.xl, marginBottom: Spacing.md },
    sumType: { color: '#ffffffbb', fontSize: 12, fontWeight: '600' },
    sumName: { color: '#fff', fontWeight: '800', fontSize: 22, marginTop: 4, marginBottom: Spacing.md },
    sumRow: { flexDirection: 'row', gap: Spacing.md },
    sumCell: { flex: 1 },
    sumCellLabel: { color: '#ffffffbb', fontSize: 11 },
    sumCellVal: { color: '#fff', fontWeight: '700', fontSize: 16, marginTop: 2 },
    dueDate: { color: '#ffffffcc', fontSize: 12, marginTop: Spacing.md },
    actionsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    actionBtn: { flex: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
    actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
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


