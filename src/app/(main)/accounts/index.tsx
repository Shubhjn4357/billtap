import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ACCOUNTS_HUB_LINKS } from '../../../constants/accountsOptions';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import type { Expense, Loan } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { HubActionCard, HubMetricCard } from '../../../components/ui/HubBlocks';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useHaptics } from '../../../hooks/useHaptics';
import { invalidateCashBankQueries, useCashBankAccounts } from '../../../hooks/useCashBankAccounts';
import { useBusinessQueryScope } from '../../../hooks/useBusinessQueryScope';
import { invalidateExpenseQueries, useExpenses } from '../../../hooks/useExpenses';
import { invalidateLoanQueries, useLoans } from '../../../hooks/useLoans';

const EMPTY_EXPENSES: Expense[] = [];
const EMPTY_LOANS: Loan[] = [];

const toAmount = (value: unknown) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const getLoanName = (loan: Partial<Loan>) => loan.lenderBorrowerName?.trim() || 'Loan account';
const getLoanType = (loan: Partial<Loan>) => loan.loanType === 'GIVEN' ? 'GIVEN' : 'BORROWED';
const getLoanRate = (loan: Partial<Loan>) => toAmount(loan.interestRatePercent);
const getExpenseDescription = (expense: Partial<Expense>) => expense.description ?? expense.paymentMode ?? 'No description';

export default function AccountsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const [search, setSearch] = useState('');
    const { selection } = useHaptics();
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const { accounts, isLoading: balancesLoading, isRefetching: balancesRefetching } = useCashBankAccounts({
        staleTime: 60_000,
    });

    const {
        expenses: filteredExpenses,
        allExpenses = EMPTY_EXPENSES,
        isLoading: expensesLoading,
        isRefetching: expensesRefetching,
    } = useExpenses({
        search,
        limit: 150,
        staleTime: 60_000,
    });

    const {
        loans: filteredLoans,
        allLoans = EMPTY_LOANS,
        isLoading: loansLoading,
        isRefetching: loansRefetching,
    } = useLoans({
        search,
        staleTime: 60_000,
    });
    const isRefreshing = balancesRefetching || expensesRefetching || loansRefetching;

    const needle = search.trim().toLowerCase();

    const filteredAccounts = useMemo(() => {
        if (!needle) return accounts;
        return accounts.filter((entry) => entry.name.toLowerCase().includes(needle));
    }, [accounts, needle]);
    const cashBalance = accounts.reduce((sum, entry) => sum + (entry.balance ?? 0), 0);
    const expenseTotal = allExpenses.reduce((sum, entry) => sum + toAmount(entry.amount), 0);
    const loanExposure = allLoans.reduce((sum, entry) => sum + toAmount(entry.currentBalance), 0);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefreshing}
                        onRefresh={() => {
                            void Promise.all([
                                invalidateCashBankQueries(queryClient, businessId),
                                invalidateExpenseQueries(queryClient, businessId),
                                invalidateLoanQueries(queryClient, businessId),
                            ]);
                        }}
                    />
                )}
            >
                <AppTopBar
                    title="Accounts"
                    subtitle="Cash, bank, expenses, loans and ledgers"
                />
                <View style={s.searchWrap}>
                    <AppSearchBar
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search accounts, expense category, lender..."
                    />
                </View>

                <View style={s.heroWrap}>
                    <UtilityHero
                        title="Accounts Hub"
                        subtitle="Cash, bank, expenses, loans, and linked report shortcuts from one screen."
                        icon="bank-outline"
                        tone="info"
                    />
                </View>

                <View style={s.metricsRow}>
                    <HubMetricCard
                        label="Cash + Bank"
                        value={`Rs ${cashBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        meta={`${accounts.length} accounts`}
                        tone={cashBalance >= 0 ? 'success' : 'danger'}
                    />
                    <HubMetricCard
                        label="Expenses"
                        value={`Rs ${expenseTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        meta={`${allExpenses.length} records`}
                        tone="danger"
                    />
                    <HubMetricCard
                        label="Loan Exposure"
                        value={`Rs ${loanExposure.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        meta={`${allLoans.length} loans`}
                        tone="info"
                    />
                </View>

                <View style={[s.section, { marginBottom: Spacing.sm }]}> 
                    <View style={s.quickGrid}>
                        {ACCOUNTS_HUB_LINKS.map((entry) => (
                            <HubActionCard
                                key={entry.title}
                                title={entry.title}
                                subtitle={entry.subtitle}
                                icon={entry.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                                tone={entry.tone}
                                onPress={() => {
                                    void selection();
                                    router.push(entry.route as Parameters<typeof router.push>[0]);
                                }}
                            />
                        ))}
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
                    {balancesLoading ? <SectionSkeleton colors={colors} rows={2} /> : filteredAccounts.length === 0 ? (
                        <Text style={s.emptyText}>No accounts set up</Text>
                    ) : filteredAccounts.slice(0, 3).map((account) => (
                        <Pressable
                            key={account.id}
                            style={({ pressed }) => [s.row, getSurfaceStyle(colors, { elevated: true }), { opacity: pressed ? 0.86 : 1 }]}
                            onPress={() => router.push(`/(main)/accounts/cash-bank/${account.id}` as Parameters<typeof router.push>[0])}
                        >
                            <Text style={s.rowName}>{account.name}</Text>
                            <View style={s.rowRight}>
                                <Text style={[s.rowBalance, { color: (account.balance ?? 0) >= 0 ? colors.success : colors.error }]}>
                                    Rs {(account.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </Text>
                                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                            </View>
                        </Pressable>
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
                    {expensesLoading ? <SectionSkeleton colors={colors} rows={2} /> : filteredExpenses.length === 0 ? (
                        <Text style={s.emptyText}>No expenses recorded</Text>
                    ) : filteredExpenses.slice(0, 5).map((expense) => (
                        <View key={expense.id} style={[s.row, getSurfaceStyle(colors, { elevated: true })]}> 
                            <View>
                                <Text style={s.rowName}>{expense.category}</Text>
                                <Text style={s.rowSub}>{getExpenseDescription(expense)}</Text>
                            </View>
                            <View style={s.rowRight}>
                                <Text style={[s.rowBalance, { color: colors.error }]}>-Rs {toAmount(expense.amount).toLocaleString('en-IN')}</Text>
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
                    {loansLoading ? <SectionSkeleton colors={colors} rows={2} /> : filteredLoans.length === 0 ? (
                        <Text style={s.emptyText}>No loans added</Text>
                    ) : filteredLoans.slice(0, 5).map((loan) => (
                        <Pressable
                            key={loan.id}
                            style={({ pressed }) => [s.row, getSurfaceStyle(colors, { elevated: true }), { opacity: pressed ? 0.86 : 1 }]}
                            onPress={() => router.push(`/(main)/accounts/loans/${loan.id}` as Parameters<typeof router.push>[0])}
                        >
                            <View>
                                <Text style={s.rowName}>{getLoanName(loan)}</Text>
                                <Text style={s.rowSub}>{getLoanType(loan)} | {getLoanRate(loan)}%</Text>
                            </View>
                            <View style={s.rowRight}>
                                <Text style={[s.rowBalance, { color: getLoanType(loan) === 'BORROWED' ? colors.error : colors.success }]}>
                                    Rs {toAmount(loan.currentBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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

function SectionSkeleton({
    colors,
    rows = 2,
}: {
    colors: ColorPalette;
    rows?: number;
}) {
    return (
        <View style={sectionSkeletonStyles.wrap}>
            <ListSkeleton rows={rows} compact />
            <View pointerEvents="none" style={[sectionSkeletonStyles.fade, { backgroundColor: colors.background }]} />
        </View>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        searchWrap: {
            paddingHorizontal: DESIGN_SPACING.screenX,
            marginBottom: DESIGN_SPACING.cardGap,
        },
        heroWrap: {
            paddingHorizontal: DESIGN_SPACING.screenX,
            marginBottom: DESIGN_SPACING.sectionGap,
        },
        section: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.sectionGap },
        metricsRow: {
            flexDirection: 'row',
            gap: Spacing.sm,
            flexWrap: 'wrap',
            paddingHorizontal: DESIGN_SPACING.screenX,
            marginBottom: DESIGN_SPACING.sectionGap,
        },
        sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
        sectionTitle: { fontWeight: '700', fontSize: Typography.title.size, color: colors.text },
        sectionCount: {
            minWidth: 22,
            textAlign: 'center',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: Radius.pill,
            borderWidth: 1,
            borderColor: `${colors.primary}33`,
            backgroundColor: `${colors.primary}12`,
            color: colors.primary,
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        viewAll: { marginLeft: 'auto', fontSize: 12, fontWeight: '600' },
        quickGrid: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
        row: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: Spacing.md,
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
        },
        rowName: { color: colors.text, fontWeight: '600', fontSize: 14 },
        rowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
        rowBalance: { fontWeight: '700', fontSize: 14 },
        rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
        emptyText: { color: colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
        outlineButton: { ...getPillStyle(colors, colors.primary), borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
        outlineText: { fontWeight: '600', fontSize: 13 },
    });

const sectionSkeletonStyles = StyleSheet.create({
    wrap: {
        position: 'relative',
        marginBottom: Spacing.xs,
    },
    fade: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 12,
        opacity: 0.82,
    },
});

