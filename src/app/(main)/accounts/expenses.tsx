import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { format, parseISO } from 'date-fns';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Spacing, Radius, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { ExpenseCategory } from '../../../constants/enums';
import { EXPENSE_CATEGORY_FILTER_OPTIONS } from '../../../constants/formOptions';
import type { Expense } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { EmptyStateCard } from '../../../components/ui/ListBlocks';
import { SwipeableRow } from '../../../components/ui/SwipeableRow';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useExpenses, type ExpenseCategoryFilter } from '../../../hooks/useExpenses';
import { useExpenseMutations } from '../../../hooks/useExpenseMutations';

const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

const toAmount = (value: unknown) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const getExpenseCategoryLabel = (expense: Partial<Expense>) =>
    (expense.category ?? ExpenseCategory.MISCELLANEOUS).replace(/_/g, ' ');

const getExpenseDescription = (expense: Partial<Expense>) =>
    expense.description ?? expense.paymentMode ?? 'No description';

const formatExpenseDate = (expense: Partial<Expense>) => {
    const value = expense.expenseDate ?? expense.date ?? expense.createdAt;
    if (!value) return 'Date unavailable';
    try {
        return format(parseISO(value), 'dd MMM yyyy');
    } catch {
        return value;
    }
};

export default function ExpensesScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const [cat, setCat] = useState<string>('ALL');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');
    const { expenses, isLoading, isRefetching, refetch, stats } = useExpenses({
        category: cat as ExpenseCategoryFilter,
        limit: 150,
    });
    const total = stats.total;
    const average = stats.average;
    const categoriesUsed = stats.categoriesUsed;
    const selectedCount = selectedIds.length;

    const {
        archiveExpenses,
        updateExpenseCategories,
        isArchivingExpenses: bulkDeleting,
        isUpdatingExpenseCategories: bulkUpdating,
    } = useExpenseMutations();

    const requestBulkDelete = () => {
        if (selectedCount === 0) return;
        dialog.alert('Archive expenses', `Move ${selectedCount} expense(s) to recycle bin?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Archive',
                style: 'destructive',
                onPress: () => {
                    void archiveExpenses(selectedIds)
                        .then(() => {
                            setSelectionMode(false);
                            setSelectedIds([]);
                        })
                        .catch((error) => {
                            dialog.alert('Bulk delete failed', error instanceof Error ? error.message : 'Unable to archive selected expenses.');
                        });
                },
            },
        ]);
    };

    const requestBulkSetMisc = () => {
        if (selectedCount === 0) return;
        dialog.alert('Set category', `Set ${selectedCount} expense(s) category to Miscellaneous?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Apply',
                onPress: () => {
                    void updateExpenseCategories({ ids: selectedIds, category: ExpenseCategory.MISCELLANEOUS })
                        .then(() => {
                            setSelectionMode(false);
                            setSelectedIds([]);
                        })
                        .catch((error) => {
                            dialog.alert('Bulk update failed', error instanceof Error ? error.message : 'Unable to update selected expenses.');
                        });
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Expenses"
                subtitle="Track spending and categories"
                onBackPress={smartBack}
                rightAction={(
                    <View style={s.topActionRow}>
                        <Pressable
                            style={s.iconBtn}
                            onPress={() => {
                                setSelectionMode((current) => !current);
                                setSelectedIds([]);
                            }}
                        >
                            <MaterialCommunityIcons
                                name={selectionMode ? 'close' : 'checkbox-multiple-marked-outline'}
                                size={18}
                                color={colors.textSecondary}
                            />
                        </Pressable>
                        <Pressable
                            style={s.iconBtn}
                            onPress={() => router.push('/(main)/accounts/expenses/recycle-bin' as Parameters<typeof router.push>[0])}
                        >
                            <MaterialCommunityIcons name="delete-outline" size={18} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable style={s.addBtn} onPress={() => router.push('/(main)/accounts/expenses/add' as Parameters<typeof router.push>[0])}>
                            <MaterialCommunityIcons name="plus" size={18} color={colors.onPrimary} />
                        </Pressable>
                    </View>
                )}
            />

            <View style={s.heroWrap}>
                <UtilityHero
                    title="Expense Tracker"
                    subtitle="Filter spending by category, manage bulk actions, and keep operating costs tidy."
                    icon="cash-minus"
                    tone="warning"
                />
            </View>

            <View style={[s.totalCard, getSurfaceStyle(colors, { accent: colors.error, elevated: true, muted: true })]}>
                <Text style={[s.totalLabel, { color: colors.textSecondary }]}>Total Expenses (filtered)</Text>
                <Text style={[s.totalVal, { color: colors.error }]}>{`INR ${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}</Text>
            </View>

            <View style={s.statsRow}>
                <View style={s.statCard}>
                    <Text style={[s.statLabel, { color: colors.textSecondary }]}>Entries</Text>
                    <Text style={[s.statValue, { color: colors.text }]}>{expenses.length}</Text>
                </View>
                <View style={s.statCard}>
                    <Text style={[s.statLabel, { color: colors.textSecondary }]}>Average</Text>
                    <Text style={[s.statValue, { color: colors.warning }]}>Rs {average.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
                <View style={s.statCard}>
                    <Text style={[s.statLabel, { color: colors.textSecondary }]}>Categories</Text>
                    <Text style={[s.statValue, { color: colors.primary }]}>{categoriesUsed}</Text>
                </View>
            </View>

            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Category Filter</Text>
            <View style={s.catRow}>
                <FlatList
                    horizontal
                    data={EXPENSE_CATEGORY_FILTER_OPTIONS}
                    keyExtractor={(entry) => entry.value}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: DESIGN_SPACING.screenX }}
                    renderItem={({ item }) => (
                        <ChipButton
                            label={item.label}
                            selected={cat === item.value}
                            tone={item.value === 'ALL' ? 'info' : 'warning'}
                            onPress={() => setCat(item.value)}
                        />
                    )}
                />
            </View>

            {selectionMode ? (
                <>
                    <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Bulk Actions</Text>
                <View style={s.bulkRow}>
                    <Text style={[s.bulkLabel, { color: colors.textSecondary }]}>Selected: {selectedCount}</Text>
                    <Pressable style={[s.bulkAction, { ...getPillStyle(colors, colors.primary) }]} onPress={requestBulkSetMisc} disabled={selectedCount === 0 || bulkUpdating}>
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>
                            {bulkUpdating ? 'Applying...' : 'Set Misc'}
                        </Text>
                    </Pressable>
                    <Pressable style={[s.bulkAction, { ...getPillStyle(colors, colors.error) }]} onPress={requestBulkDelete} disabled={selectedCount === 0 || bulkDeleting}>
                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 11 }}>
                            {bulkDeleting ? 'Archiving...' : 'Archive'}
                        </Text>
                    </Pressable>
                </View>
                </>
            ) : null}

            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Entries</Text>
            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={expenses}
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
                    renderItem={({ item }) => (
                        <ExpenseRow
                            expense={item}
                            colors={colors}
                            selectionMode={selectionMode}
                            selected={selectedIds.includes(item.id)}
                            onToggleSelect={() => setSelectedIds((current) => toggleId(current, item.id))}
                            onSelectAction={() => {
                                setSelectionMode(true);
                                setSelectedIds((current) => toggleId(current, item.id));
                            }}
                        />
                    )}
                    ListEmptyComponent={(
                        <EmptyStateCard
                            icon="cash-minus"
                            title="No expenses yet"
                            subtitle="Add an expense entry to start tracking operating costs."
                            tone="warning"
                            actionLabel="Add Expense"
                            onActionPress={() => router.push('/(main)/accounts/expenses/add' as Parameters<typeof router.push>[0])}
                        />
                    )}
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
    onSelectAction,
    onToggleSelect,
}: {
    expense: Expense;
    colors: ColorPalette;
    selectionMode: boolean;
    selected: boolean;
    onSelectAction: () => void;
    onToggleSelect: () => void;
}) {
    return (
        <SwipeableRow
            enabled={!selectionMode}
            leftActions={[
                { label: 'Select', icon: 'check-circle-outline', onPress: onSelectAction, tone: 'warning' },
            ]}
        >
            <Pressable
                style={[
                    rowStyles.row,
                    getSurfaceStyle(colors, { elevated: true }),
                    {
                        backgroundColor: selected ? withAlpha(colors.primary, '20') : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                    },
                ]}
                onPress={selectionMode ? onToggleSelect : undefined}
            >
                {selectionMode ? (
                    <View style={[rowStyles.selector, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? withAlpha(colors.primary, '22') : 'transparent' }]}>
                        <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                            {selected ? 'ON' : 'OFF'}
                        </Text>
                    </View>
                ) : null}
                <View style={rowStyles.left}>
                    <Text style={[rowStyles.cat, { color: colors.text }]}>{getExpenseCategoryLabel(expense)}</Text>
                    <Text style={[rowStyles.desc, { color: colors.textSecondary }]}>{getExpenseDescription(expense)}</Text>
                    <Text style={[rowStyles.date, { color: colors.textSecondary }]}>{formatExpenseDate(expense)}</Text>
                </View>
                <Text style={[rowStyles.amt, { color: colors.error }]}>{`-INR ${toAmount(expense.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}</Text>
            </Pressable>
        </SwipeableRow>
    );
}

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: Spacing.md,
        marginHorizontal: DESIGN_SPACING.screenX,
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
        heroWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
        topActionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
        iconBtn: {
            ...getPillStyle(colors),
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
        },
        addBtn: { backgroundColor: colors.primary, borderRadius: Radius.pill, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
        totalCard: { marginHorizontal: DESIGN_SPACING.screenX, borderRadius: Radius.card, padding: Spacing.lg, marginBottom: Spacing.sm },
        totalLabel: { fontSize: 12 },
        totalVal: { fontSize: 24, fontWeight: '800', marginTop: 4 },
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
            ...getSurfaceStyle(colors, { elevated: true }),
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
        catRow: { marginBottom: Spacing.sm },
        bulkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.sm },
        bulkLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
        bulkAction: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
    });
