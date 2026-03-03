import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, useColorScheme, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { expenseApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../constants/theme';
import { ExpenseCategory } from '../../../constants/enums';
import type { Expense } from '../../../types/domain';

const CATEGORIES = ['ALL', ...Object.values(ExpenseCategory)] as const;

const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

export default function ExpensesScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const [cat, setCat] = useState<string>('ALL');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const s = styles(colors);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['expenses', cat],
        queryFn: () => expenseApi.list({ category: cat === 'ALL' ? undefined : (cat as ExpenseCategory), limit: 150 }),
        staleTime: 60_000,
    });

    const expenses = useMemo(() => (data?.data ?? []) as Expense[], [data?.data]);
    const total = expenses.reduce((sum, entry) => sum + entry.amount, 0);
    const selectedCount = selectedIds.length;

    const { mutate: bulkDelete, isPending: bulkDeleting } = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map((id) => expenseApi.delete(id)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['expenses-recycle-bin'] });
            setSelectionMode(false);
            setSelectedIds([]);
        },
        onError: (error) => {
            Alert.alert('Bulk delete failed', error instanceof Error ? error.message : 'Unable to archive selected expenses.');
        },
    });

    const { mutate: bulkSetMisc, isPending: bulkUpdating } = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map((id) => expenseApi.update(id, { category: ExpenseCategory.MISCELLANEOUS })));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            setSelectionMode(false);
            setSelectedIds([]);
        },
        onError: (error) => {
            Alert.alert('Bulk update failed', error instanceof Error ? error.message : 'Unable to update selected expenses.');
        },
    });

    const requestBulkDelete = () => {
        if (selectedCount === 0) return;
        Alert.alert('Archive expenses', `Move ${selectedCount} expense(s) to recycle bin?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Archive', style: 'destructive', onPress: () => bulkDelete(selectedIds) },
        ]);
    };

    const requestBulkSetMisc = () => {
        if (selectedCount === 0) return;
        Alert.alert('Set category', `Set ${selectedCount} expense(s) category to Miscellaneous?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Apply', onPress: () => bulkSetMisc(selectedIds) },
        ]);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>{'< Back'}</Text>
                </Pressable>
                <Text style={[s.title, { color: colors.text }]}>Expenses</Text>
                <View style={s.headerActions}>
                    <Pressable style={[s.iconBtn, { borderColor: colors.border }]} onPress={() => {
                        setSelectionMode((current) => !current);
                        setSelectedIds([]);
                    }}>
                        <Text style={[s.iconBtnText, { color: colors.textSecondary }]}>
                            {selectionMode ? 'Cancel' : 'Select'}
                        </Text>
                    </Pressable>
                    <Pressable style={[s.iconBtn, { borderColor: colors.border }]} onPress={() => router.push('/(main)/accounts/expenses/recycle-bin' as Parameters<typeof router.push>[0])}>
                        <Text style={[s.iconBtnText, { color: colors.textSecondary }]}>Bin</Text>
                    </Pressable>
                    <Pressable style={s.addBtn} onPress={() => router.push('/(main)/accounts/expenses/add' as Parameters<typeof router.push>[0])}>
                        <Text style={s.addBtnText}>+ Add</Text>
                    </Pressable>
                </View>
            </View>

            <View style={[s.totalCard, { backgroundColor: `${colors.error}18` }]}>
                <Text style={[s.totalLabel, { color: colors.textSecondary }]}>Total Expenses (filtered)</Text>
                <Text style={[s.totalVal, { color: colors.error }]}>{`INR ${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}</Text>
            </View>

            <View style={s.catRow}>
                <FlatList
                    horizontal
                    data={CATEGORIES}
                    keyExtractor={(entry) => entry}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.lg }}
                    renderItem={({ item }) => (
                        <Pressable style={[s.catChip, { backgroundColor: cat === item ? colors.primary : colors.surfaceVariant }]} onPress={() => setCat(item)}>
                            <Text style={{ color: cat === item ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 12 }}>
                                {item === 'ALL' ? 'All' : item.replace(/_/g, ' ')}
                            </Text>
                        </Pressable>
                    )}
                />
            </View>

            {selectionMode ? (
                <View style={s.bulkRow}>
                    <Text style={[s.bulkLabel, { color: colors.textSecondary }]}>Selected: {selectedCount}</Text>
                    <Pressable style={[s.bulkAction, { borderColor: colors.primary }]} onPress={requestBulkSetMisc} disabled={selectedCount === 0 || bulkUpdating}>
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>
                            {bulkUpdating ? 'Applying...' : 'Set Misc'}
                        </Text>
                    </Pressable>
                    <Pressable style={[s.bulkAction, { borderColor: colors.error }]} onPress={requestBulkDelete} disabled={selectedCount === 0 || bulkDeleting}>
                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 11 }}>
                            {bulkDeleting ? 'Archiving...' : 'Archive'}
                        </Text>
                    </Pressable>
                </View>
            ) : null}

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={expenses}
                    keyExtractor={(entry) => entry.id}
                    renderItem={({ item }) => (
                        <ExpenseRow
                            expense={item}
                            colors={colors}
                            selectionMode={selectionMode}
                            selected={selectedIds.includes(item.id)}
                            onToggleSelect={() => setSelectedIds((current) => toggleId(current, item.id))}
                        />
                    )}
                    ListEmptyComponent={<View style={s.centered}><Text style={{ color: colors.textSecondary }}>No expenses. Add one.</Text></View>}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}
        </SafeAreaView>
    );
}

function ExpenseRow({
    expense,
    colors,
    selectionMode,
    selected,
    onToggleSelect,
}: {
    expense: Expense;
    colors: ColorPalette;
    selectionMode: boolean;
    selected: boolean;
    onToggleSelect: () => void;
}) {
    return (
        <Pressable
            style={[
                rowStyles.row,
                {
                    backgroundColor: selected ? `${colors.primary}20` : colors.card,
                    borderColor: selected ? colors.primary : 'transparent',
                    borderWidth: selected ? 1 : 0,
                },
            ]}
            onPress={selectionMode ? onToggleSelect : undefined}
        >
            {selectionMode ? (
                <View style={[rowStyles.selector, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}22` : 'transparent' }]}>
                    <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                        {selected ? 'ON' : 'OFF'}
                    </Text>
                </View>
            ) : null}
            <View style={rowStyles.left}>
                <Text style={[rowStyles.cat, { color: colors.text }]}>{expense.category.replace(/_/g, ' ')}</Text>
                <Text style={[rowStyles.desc, { color: colors.textSecondary }]}>{expense.description ?? expense.paymentMode}</Text>
                <Text style={[rowStyles.date, { color: colors.textSecondary }]}>{format(parseISO(expense.expenseDate), 'dd MMM yyyy')}</Text>
            </View>
            <Text style={[rowStyles.amt, { color: colors.error }]}>{`-INR ${expense.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}</Text>
        </Pressable>
    );
}

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: Spacing.md,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
        borderRadius: Radius.card,
        gap: Spacing.sm,
    },
    selector: {
        width: 42,
        borderWidth: 1,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    left: { flex: 1 },
    cat: { fontWeight: '600', fontSize: 14 },
    desc: { fontSize: 12, marginTop: 2 },
    date: { fontSize: 11, marginTop: 2 },
    amt: { fontWeight: '700', fontSize: 15, minWidth: 84, textAlign: 'right' },
});

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
        back: { fontWeight: '600', fontSize: 14, width: 52 },
        title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
        iconBtn: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 4,
            minWidth: 42,
            alignItems: 'center',
        },
        iconBtnText: { fontWeight: '700', fontSize: 12 },
        addBtn: { backgroundColor: colors.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
        addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
        totalCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.lg, marginBottom: Spacing.md },
        totalLabel: { fontSize: 12 },
        totalVal: { fontSize: 24, fontWeight: '800', marginTop: 4 },
        catRow: { marginBottom: Spacing.sm },
        catChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
        bulkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        bulkLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
        bulkAction: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
    });

