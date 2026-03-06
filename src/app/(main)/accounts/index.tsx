import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cashBankApi, expenseApi, loanApi } from '../../../api/endpoints';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import type { Account, Expense, Loan } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { useHaptics } from '../../../hooks/useHaptics';

const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_EXPENSES: Expense[] = [];
const EMPTY_LOANS: Loan[] = [];

export default function AccountsScreen() {
        const colors = useAppColors();
    const s = styles(colors);
    const [search, setSearch] = useState('');
    const { selection } = useHaptics();
    const queryClient = useQueryClient();

    const { data: balancesData, isLoading: balancesLoading, isRefetching: balancesRefetching } = useQuery({
        queryKey: ['cash-bank-balances'],
        queryFn: () => cashBankApi.getBalances(),
        staleTime: 60_000,
    });

    const { data: expensesData, isLoading: expensesLoading, isRefetching: expensesRefetching } = useQuery({
        queryKey: ['recent-expenses'],
        queryFn: () => expenseApi.list({ limit: 5 }),
        staleTime: 60_000,
    });

    const { data: loansData, isLoading: loansLoading, isRefetching: loansRefetching } = useQuery({
        queryKey: ['loans'],
        queryFn: () => loanApi.list(),
        staleTime: 60_000,
    });
    const isRefreshing = balancesRefetching || expensesRefetching || loansRefetching;

    const accounts = (balancesData?.data as Account[] | undefined) ?? EMPTY_ACCOUNTS;
    const expenses = (expensesData?.data as Expense[] | undefined) ?? EMPTY_EXPENSES;
    const loans = (loansData?.data as Loan[] | undefined) ?? EMPTY_LOANS;
    const needle = search.trim().toLowerCase();

    const filteredAccounts = useMemo(() => {
        if (!needle) return accounts;
        return accounts.filter((entry) => entry.name.toLowerCase().includes(needle));
    }, [accounts, needle]);
    const filteredExpenses = useMemo(() => {
        if (!needle) return expenses;
        return expenses.filter((entry) =>
            `${entry.category} ${entry.description ?? ''} ${entry.paymentMode}`.toLowerCase().includes(needle)
        );
    }, [expenses, needle]);
    const filteredLoans = useMemo(() => {
        if (!needle) return loans;
        return loans.filter((entry) => `${entry.lenderBorrowerName} ${entry.loanType}`.toLowerCase().includes(needle));
    }, [loans, needle]);
    const cashBalance = accounts.reduce((sum, entry) => sum + (entry.balance ?? 0), 0);
    const expenseTotal = expenses.reduce((sum, entry) => sum + entry.amount, 0);
    const loanExposure = loans.reduce((sum, entry) => sum + entry.currentBalance, 0);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefreshing}
                        onRefresh={() => {
                            queryClient.invalidateQueries({ queryKey: ['cash-bank-balances'] });
                            queryClient.invalidateQueries({ queryKey: ['recent-expenses'] });
                            queryClient.invalidateQueries({ queryKey: ['loans'] });
                        }}
                    />
                )}
            >
                <AppTopBar
                    title="Accounts"
                    subtitle="Cash, bank, expenses, loans and ledgers"
                    rightAction={(
                        <Pressable onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}>
                            <MaterialCommunityIcons name="compass-outline" size={20} color={colors.primary} />
                        </Pressable>
                    )}
                />
                <View style={s.searchWrap}>
                    <AppSearchBar
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search accounts, expense category, lender..."
                    />
                </View>

                <View style={s.metricsRow}>
                    <View style={[s.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.metricLabel, { color: colors.textSecondary }]}>Cash + Bank</Text>
                        <Text style={[s.metricValue, { color: cashBalance >= 0 ? colors.success : colors.error }]}>
                            Rs {cashBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                    <View style={[s.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.metricLabel, { color: colors.textSecondary }]}>Expenses</Text>
                        <Text style={[s.metricValue, { color: colors.error }]}>
                            Rs {expenseTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                    <View style={[s.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.metricLabel, { color: colors.textSecondary }]}>Loan Exposure</Text>
                        <Text style={[s.metricValue, { color: colors.primary }]}>
                            Rs {loanExposure.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                </View>

                <View style={[s.section, { marginBottom: Spacing.sm }]}> 
                    <View style={s.quickGrid}>
                        <Pressable style={[s.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {
                            void selection();
                            router.push('/(main)/reports/trial-balance' as Parameters<typeof router.push>[0]);
                        }}>
                            <Text style={s.quickTitle}>Trial Balance</Text>
                            <Text style={s.quickSub}>Debit/Credit check</Text>
                        </Pressable>
                        <Pressable style={[s.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {
                            void selection();
                            router.push('/(main)/reports/ledgers' as Parameters<typeof router.push>[0]);
                        }}>
                            <Text style={s.quickTitle}>Ledgers</Text>
                            <Text style={s.quickSub}>Account drill-down</Text>
                        </Pressable>
                        <Pressable style={[s.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {
                            void selection();
                            router.push('/(main)/reports/gst-summary' as Parameters<typeof router.push>[0]);
                        }}>
                            <Text style={s.quickTitle}>GST Summary</Text>
                            <Text style={s.quickSub}>Slab-wise tax data</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Cash and Bank</Text>
                        <Text style={s.sectionCount}>{filteredAccounts.length}</Text>
                        <Pressable onPress={() => router.push('/(main)/accounts/cash-bank' as Parameters<typeof router.push>[0])}>
                            <Text style={[s.viewAll, { color: colors.primary }]}>View all</Text>
                        </Pressable>
                    </View>
                    {balancesLoading ? <ActivityIndicator color={colors.primary} /> : filteredAccounts.length === 0 ? (
                        <Text style={s.emptyText}>No accounts set up</Text>
                    ) : filteredAccounts.slice(0, 3).map((account) => (
                        <View key={account.id} style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <Text style={s.rowName}>{account.name}</Text>
                            <View style={s.rowRight}>
                                <Text style={[s.rowBalance, { color: (account.balance ?? 0) >= 0 ? colors.success : colors.error }]}>
                                    Rs {(account.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </Text>
                                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                            </View>
                        </View>
                    ))}
                </View>

                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Expenses</Text>
                        <Text style={s.sectionCount}>{filteredExpenses.length}</Text>
                        <Pressable onPress={() => router.push('/(main)/accounts/expenses' as Parameters<typeof router.push>[0])}>
                            <Text style={[s.viewAll, { color: colors.primary }]}>View all</Text>
                        </Pressable>
                    </View>
                    {expensesLoading ? <ActivityIndicator color={colors.primary} /> : filteredExpenses.length === 0 ? (
                        <Text style={s.emptyText}>No expenses recorded</Text>
                    ) : filteredExpenses.map((expense) => (
                        <View key={expense.id} style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <View>
                                <Text style={s.rowName}>{expense.category}</Text>
                                <Text style={s.rowSub}>{expense.description ?? expense.paymentMode}</Text>
                            </View>
                            <View style={s.rowRight}>
                                <Text style={[s.rowBalance, { color: colors.error }]}>-Rs {expense.amount.toLocaleString('en-IN')}</Text>
                                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                            </View>
                        </View>
                    ))}
                    <Pressable style={[s.outlineButton, { borderColor: colors.primary }]} onPress={() => router.push('/(main)/accounts/expenses/add' as Parameters<typeof router.push>[0])}>
                        <Text style={[s.outlineText, { color: colors.primary }]}>Add expense</Text>
                    </Pressable>
                </View>

                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Loans</Text>
                        <Text style={s.sectionCount}>{filteredLoans.length}</Text>
                        <Pressable onPress={() => router.push('/(main)/accounts/loans' as Parameters<typeof router.push>[0])}>
                            <Text style={[s.viewAll, { color: colors.primary }]}>View all</Text>
                        </Pressable>
                    </View>
                    {loansLoading ? <ActivityIndicator color={colors.primary} /> : filteredLoans.length === 0 ? (
                        <Text style={s.emptyText}>No loans added</Text>
                    ) : filteredLoans.map((loan) => (
                        <Pressable key={loan.id} style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/(main)/accounts/loans/${loan.id}` as Parameters<typeof router.push>[0])}>
                            <View>
                                <Text style={s.rowName}>{loan.lenderBorrowerName}</Text>
                                <Text style={s.rowSub}>{loan.loanType} | {loan.interestRatePercent}%</Text>
                            </View>
                            <View style={s.rowRight}>
                                <Text style={[s.rowBalance, { color: loan.loanType === 'BORROWED' ? colors.error : colors.success }]}>
                                    Rs {loan.currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </Text>
                                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                            </View>
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
        searchWrap: {
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
        },
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
        metricsRow: {
            flexDirection: 'row',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
        },
        metricCard: {
            flex: 1,
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.sm,
        },
        metricLabel: { fontSize: Typography.caption.size, fontWeight: '600' },
        metricValue: { marginTop: 2, fontSize: Typography.title.size, fontWeight: '800' },
        sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
        sectionTitle: { fontWeight: '700', fontSize: Typography.title.size, color: colors.text },
        sectionCount: {
            minWidth: 22,
            textAlign: 'center',
            borderRadius: Radius.pill,
            paddingHorizontal: 6,
            paddingVertical: 2,
            backgroundColor: withAlpha(colors.primary, '12'),
            color: colors.primary,
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        viewAll: { marginLeft: 'auto', fontSize: 12, fontWeight: '600' },
        quickGrid: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
        quickCard: {
            borderRadius: Radius.card,
            padding: Spacing.md,
            minWidth: '47%',
            flex: 1,
            borderWidth: 1,
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
            borderWidth: 1,
        },
        rowName: { color: colors.text, fontWeight: '600', fontSize: 14 },
        rowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
        rowBalance: { fontWeight: '700', fontSize: 14 },
        rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
        emptyText: { color: colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
        outlineButton: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
        outlineText: { fontWeight: '600', fontSize: 13 },
    });

