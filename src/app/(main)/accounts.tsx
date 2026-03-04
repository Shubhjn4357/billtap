import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { cashBankApi, expenseApi, loanApi } from '../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
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
                    <Pressable onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}>
                        <Text style={[s.headerAction, { color: colors.primary }]}>All Screens</Text>
                    </Pressable>
                </View>

                <View style={[s.section, { marginBottom: Spacing.sm }]}> 
                    <View style={s.quickGrid}>
                        <Pressable style={[s.quickCard, { backgroundColor: colors.card }]} onPress={() => router.push('/(main)/reports/trial-balance' as Parameters<typeof router.push>[0])}>
                            <Text style={s.quickTitle}>Trial Balance</Text>
                            <Text style={s.quickSub}>Debit/Credit check</Text>
                        </Pressable>
                        <Pressable style={[s.quickCard, { backgroundColor: colors.card }]} onPress={() => router.push('/(main)/reports/ledgers' as Parameters<typeof router.push>[0])}>
                            <Text style={s.quickTitle}>Ledgers</Text>
                            <Text style={s.quickSub}>Account drill-down</Text>
                        </Pressable>
                        <Pressable style={[s.quickCard, { backgroundColor: colors.card }]} onPress={() => router.push('/(main)/reports/gst-summary' as Parameters<typeof router.push>[0])}>
                            <Text style={s.quickTitle}>GST Summary</Text>
                            <Text style={s.quickSub}>Slab-wise tax data</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Cash and Bank</Text>
                        <Pressable onPress={() => router.push('/(main)/accounts/cash-bank' as Parameters<typeof router.push>[0])}>
                            <Text style={[s.viewAll, { color: colors.primary }]}>View all</Text>
                        </Pressable>
                    </View>
                    {balancesLoading ? <ActivityIndicator color={colors.primary} /> : accounts.length === 0 ? (
                        <Text style={s.emptyText}>No accounts set up</Text>
                    ) : accounts.slice(0, 3).map((account) => (
                        <View key={account.id} style={[s.row, { backgroundColor: colors.card }]}> 
                            <Text style={s.rowName}>{account.name}</Text>
                            <Text style={[s.rowBalance, { color: (account.balance ?? 0) >= 0 ? colors.success : colors.error }]}>
                                Rs {(account.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Expenses</Text>
                        <Pressable onPress={() => router.push('/(main)/accounts/expenses' as Parameters<typeof router.push>[0])}>
                            <Text style={[s.viewAll, { color: colors.primary }]}>View all</Text>
                        </Pressable>
                    </View>
                    {expensesLoading ? <ActivityIndicator color={colors.primary} /> : expenses.length === 0 ? (
                        <Text style={s.emptyText}>No expenses recorded</Text>
                    ) : expenses.map((expense) => (
                        <View key={expense.id} style={[s.row, { backgroundColor: colors.card }]}> 
                            <View>
                                <Text style={s.rowName}>{expense.category}</Text>
                                <Text style={s.rowSub}>{expense.description ?? expense.paymentMode}</Text>
                            </View>
                            <Text style={[s.rowBalance, { color: colors.error }]}>-Rs {expense.amount.toLocaleString('en-IN')}</Text>
                        </View>
                    ))}
                    <Pressable style={[s.outlineButton, { borderColor: colors.primary }]} onPress={() => router.push('/(main)/accounts/expenses/add' as Parameters<typeof router.push>[0])}>
                        <Text style={[s.outlineText, { color: colors.primary }]}>Add expense</Text>
                    </Pressable>
                </View>

                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Loans</Text>
                        <Pressable onPress={() => router.push('/(main)/accounts/loans' as Parameters<typeof router.push>[0])}>
                            <Text style={[s.viewAll, { color: colors.primary }]}>View all</Text>
                        </Pressable>
                    </View>
                    {loansLoading ? <ActivityIndicator color={colors.primary} /> : loans.length === 0 ? (
                        <Text style={s.emptyText}>No loans added</Text>
                    ) : loans.map((loan) => (
                        <Pressable key={loan.id} style={[s.row, { backgroundColor: colors.card }]} onPress={() => router.push(`/(main)/accounts/loans/${loan.id}` as Parameters<typeof router.push>[0])}>
                            <View>
                                <Text style={s.rowName}>{loan.lenderBorrowerName}</Text>
                                <Text style={s.rowSub}>{loan.loanType} | {loan.interestRatePercent}%</Text>
                            </View>
                            <Text style={[s.rowBalance, { color: loan.loanType === 'BORROWED' ? colors.error : colors.success }]}>
                                Rs {loan.currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </Text>
                        </Pressable>
                    ))}
                    <Pressable style={[s.outlineButton, { borderColor: colors.primary }]} onPress={() => router.push('/(main)/accounts/loans/add' as Parameters<typeof router.push>[0])}>
                        <Text style={[s.outlineText, { color: colors.primary }]}>Add loan</Text>
                    </Pressable>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
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
        title: { fontSize: Typography.headline.size, fontWeight: '700', color: colors.text },
        headerAction: { fontSize: Typography.body.size, fontWeight: '700' },
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
        sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
        sectionTitle: { fontWeight: '700', fontSize: Typography.title.size, color: colors.text },
        viewAll: { fontSize: 12, fontWeight: '600' },
        quickGrid: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
        quickCard: {
            borderRadius: Radius.card,
            padding: Spacing.md,
            minWidth: '47%',
            flex: 1,
        },
        quickTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
        quickSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        row: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.sm,
        },
        rowName: { color: colors.text, fontWeight: '600', fontSize: 14 },
        rowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
        rowBalance: { fontWeight: '700', fontSize: 14 },
        emptyText: { color: colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
        outlineButton: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
        outlineText: { fontWeight: '600', fontSize: 13 },
    });
