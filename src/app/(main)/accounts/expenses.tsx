import { View, Text, FlatList, Pressable, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { expenseApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../constants/theme';
import { ExpenseCategory } from '../../../constants/enums';
import { format, parseISO } from 'date-fns';
import type { Expense } from '../../../types/domain';

const CATEGORIES = ['ALL', ...Object.values(ExpenseCategory)] as const;

export default function ExpensesScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const [cat, setCat] = useState<string>('ALL');
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['expenses', cat],
        queryFn: () => expenseApi.list({ category: cat === 'ALL' ? undefined : cat as ExpenseCategory, limit: 50 }),
        staleTime: 60_000,
    });

    const expenses = (data?.data ?? []) as Expense[];
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Back</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>Expenses</Text>
                <Pressable style={s.addBtn} onPress={() => router.push('/(main)/accounts/expenses/add' as Parameters<typeof router.push>[0])}>
                    <Text style={s.addBtnText}>+ Add</Text>
                </Pressable>
            </View>

            {/* Total card */}
            <View style={[s.totalCard, { backgroundColor: colors.error + '18' }]}>
                <Text style={[s.totalLabel, { color: colors.textSecondary }]}>Total Expenses (filtered)</Text>
                <Text style={[s.totalVal, { color: colors.error }]}>₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            </View>

            {/* Category filter */}
            <View style={s.catRow}>
                <FlatList
                    horizontal
                    data={CATEGORIES}
                    keyExtractor={(c) => c}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.lg }}
                    renderItem={({ item: c }) => (
                        <Pressable style={[s.catChip, { backgroundColor: cat === c ? colors.primary : colors.surfaceVariant }]} onPress={() => setCat(c)}>
                            <Text style={{ color: cat === c ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 12 }}>
                                {c === 'ALL' ? 'All' : c.replace(/_/g, ' ')}
                            </Text>
                        </Pressable>
                    )}
                />
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={expenses}
                    keyExtractor={(e) => e.id}
                    renderItem={({ item: exp }) => <ExpenseRow expense={exp} colors={colors} />}
                    ListEmptyComponent={<View style={s.centered}><Text style={{ color: colors.textSecondary }}>No expenses. Add one!</Text></View>}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}
        </SafeAreaView>
    );
}

function ExpenseRow({ expense, colors }: { expense: Expense; colors: ColorPalette }) {
    return (
        <View style={[rowS.row, { backgroundColor: colors.card }]}>
            <View style={rowS.left}>
                <Text style={[rowS.cat, { color: colors.text }]}>{expense.category.replace(/_/g, ' ')}</Text>
                <Text style={[rowS.desc, { color: colors.textSecondary }]}>{expense.description ?? expense.paymentMode}</Text>
                <Text style={[rowS.date, { color: colors.textSecondary }]}>{format(parseISO(expense.expenseDate), 'dd MMM yyyy')}</Text>
            </View>
            <Text style={[rowS.amt, { color: colors.error }]}>-₹{expense.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
        </View>
    );
}

const rowS = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.card },
    left: { flex: 1 },
    cat: { fontWeight: '600', fontSize: 14 },
    desc: { fontSize: 12, marginTop: 2 },
    date: { fontSize: 11, marginTop: 2 },
    amt: { fontWeight: '700', fontSize: 15 },
});

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
    addBtn: { backgroundColor: colors.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
    addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    totalCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.lg, marginBottom: Spacing.md },
    totalLabel: { fontSize: 12 },
    totalVal: { fontSize: 28, fontWeight: '800', marginTop: 4 },
    catRow: { marginBottom: Spacing.sm },
    catChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
});
