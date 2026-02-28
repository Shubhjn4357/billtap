// @ts-nocheck
import { View, Text, ScrollView, Pressable, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { cashBankApi, expenseApi, loanApi } from '../../api/endpoints';
import { getColors, Spacing, Radius, Typography, type ColorPalette } from '../../constants/theme';
import type { Account, Expense, Loan } from '../../types/domain';

export default function AccountsScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);

    const { data: balancesData, isLoading: balancesLoading } = useQuery({
        queryKey: ['cash-bank-balances'],
        queryFn: () => cashBankApi.getBalances(),
        staleTime: 60_000,
    });

    const { data: expensesData, isLoading: expensesLoading } = useQuery({
        queryKey: ['recent-expenses'],
        queryFn: () => expenseApi.list({ limit: 5 }),
        staleTime: 60_000,
    });

    const { data: loansData, isLoading: loansLoading } = useQuery({
        queryKey: ['loans'],
        queryFn: () => loanApi.list(),
        staleTime: 60_000,
    });

    const accounts = (balancesData?.data ?? []) as Account[];
    const expenses = (expensesData?.data ?? []) as Expense[];
    const loans = (loansData?.data ?? []) as Loan[];

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.header}>
                    <Text style={s.title}>Accounts</Text>
                </View>

                {/* Cash & Bank */}
                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>🏦 Cash & Bank</Text>
                        <Pressable onPress={() => router.push('/(main)/accounts/cash-bank' as Parameters<typeof router.push>[0])}>
                            <Text style={[s.viewAll, { color: colors.primary }]}>View All →</Text>
                        </Pressable>
                    </View>
                    {balancesLoading ? <ActivityIndicator color={colors.primary} /> : accounts.length === 0 ? (
                        <Text style={s.emptyText}>No accounts set up</Text>
                    ) : accounts.slice(0, 3).map((acc) => (
                        <View key={acc.id} style={[s.accountRow, { backgroundColor: colors.card }]}>
                            <Text style={[s.accountName, { color: colors.text }]}>{acc.name}</Text>
                            <Text style={[s.accountBalance, { color: (acc.balance ?? 0) >= 0 ? colors.success : colors.error }]}>
                                ₹{(acc.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </Text>
                        </View>
                    ))}
                    <View style={s.quickBtns}>
                        <Pressable style={s.quickBtn} onPress={() => router.push('/(main)/accounts/cash-bank/deposit' as Parameters<typeof router.push>[0])}>
                            <Text style={s.quickBtnText}>+ Deposit</Text>
                        </Pressable>
                        <Pressable style={s.quickBtn} onPress={() => router.push('/(main)/accounts/cash-bank/withdraw' as Parameters<typeof router.push>[0])}>
                            <Text style={s.quickBtnText}>- Withdraw</Text>
                        </Pressable>
                        <Pressable style={s.quickBtn} onPress={() => router.push('/(main)/accounts/cash-bank/transfer' as Parameters<typeof router.push>[0])}>
                            <Text style={s.quickBtnText}>↔ Transfer</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Expenses */}
                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>💸 Expenses</Text>
                        <Pressable onPress={() => router.push('/(main)/accounts/expenses' as Parameters<typeof router.push>[0])}>
                            <Text style={[s.viewAll, { color: colors.primary }]}>View All →</Text>
                        </Pressable>
                    </View>
                    {expensesLoading ? <ActivityIndicator color={colors.primary} /> : expenses.length === 0 ? (
                        <Text style={s.emptyText}>No expenses recorded</Text>
                    ) : expenses.map((exp) => (
                        <View key={exp.id} style={[s.accountRow, { backgroundColor: colors.card }]}>
                            <View>
                                <Text style={[s.accountName, { color: colors.text }]}>{exp.category}</Text>
                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{exp.description ?? exp.paymentMode}</Text>
                            </View>
                            <Text style={[s.accountBalance, { color: colors.error }]}>-₹{exp.amount.toLocaleString('en-IN')}</Text>
                        </View>
                    ))}
                    <Pressable style={[s.addSectionBtn, { borderColor: colors.primary }]} onPress={() => router.push('/(main)/accounts/expenses/add' as Parameters<typeof router.push>[0])}>
                        <Text style={[s.addSectionBtnText, { color: colors.primary }]}>+ Add Expense</Text>
                    </Pressable>
                </View>

                {/* Loans */}
                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>🏛️ Loans</Text>
                        <Pressable onPress={() => router.push('/(main)/accounts/loans' as Parameters<typeof router.push>[0])}>
                            <Text style={[s.viewAll, { color: colors.primary }]}>View All →</Text>
                        </Pressable>
                    </View>
                    {loansLoading ? <ActivityIndicator color={colors.primary} /> : loans.length === 0 ? (
                        <Text style={s.emptyText}>No loans added</Text>
                    ) : loans.map((loan) => (
                        <Pressable key={loan.id} style={[s.accountRow, { backgroundColor: colors.card }]} onPress={() => router.push(`/(main)/accounts/loans/${loan.id}` as Parameters<typeof router.push>[0])}>
                            <View>
                                <Text style={[s.accountName, { color: colors.text }]}>{loan.lenderBorrowerName}</Text>
                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{loan.loanType} · {loan.interestRatePercent}% p.a.</Text>
                            </View>
                            <Text style={[s.accountBalance, { color: loan.loanType === 'BORROWED' ? colors.error : colors.success }]}>
                                ₹{loan.currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </Text>
                        </Pressable>
                    ))}
                    <Pressable style={[s.addSectionBtn, { borderColor: colors.primary }]} onPress={() => router.push('/(main)/accounts/loans/add' as Parameters<typeof router.push>[0])}>
                        <Text style={[s.addSectionBtnText, { color: colors.primary }]}>+ Add Loan</Text>
                    </Pressable>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    title: { fontSize: Typography.headline.size, fontWeight: '700', color: colors.text },
    section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    sectionTitle: { fontWeight: '700', fontSize: Typography.title.size, color: colors.text },
    viewAll: { fontSize: 12, fontWeight: '600' },
    accountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.sm },
    accountName: { fontWeight: '600', fontSize: 14 },
    accountBalance: { fontWeight: '700', fontSize: 15 },
    quickBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    quickBtn: { flex: 1, backgroundColor: colors.primaryVariant + '22', borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
    quickBtnText: { color: colors.primaryVariant, fontWeight: '600', fontSize: 12 },
    addSectionBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
    addSectionBtnText: { fontWeight: '600', fontSize: 13 },
    emptyText: { color: colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
});


