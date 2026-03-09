import { useState } from 'react';
import {
    ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSmartBack } from '../../../../hooks/useSmartBack';
import { format, parseISO } from 'date-fns';
import { Radius, Spacing, type ColorPalette } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useExpenses } from '../../../../hooks/useExpenses';
import { useExpenseMutations } from '../../../../hooks/useExpenseMutations';

export default function ExpenseRecycleBinScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { expenses: entries, isLoading, isRefetching, refetch } = useExpenses({
        limit: 200,
        recycleBin: true,
        staleTime: 15_000,
    });

    const { restoreExpense, permanentlyDeleteExpense } = useExpenseMutations();

    const handleRestore = (id: string) => {
        dialog.alert('Restore expense', 'Move this expense back to active list?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Restore',
                onPress: async () => {
                    try {
                        setProcessingId(id);
                        await restoreExpense(id);
                    } catch (error) {
                        dialog.alert('Restore failed', error instanceof Error ? error.message : 'Failed to restore expense.');
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    const handlePermanentDelete = (id: string) => {
        dialog.alert('Delete permanently', 'This cannot be undone. Continue?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        setProcessingId(id);
                        await permanentlyDeleteExpense(id);
                    } catch (error) {
                        dialog.alert('Delete failed', error instanceof Error ? error.message : 'Failed to delete expense.');
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Expense Recycle Bin"
                subtitle="Restore or delete permanently"
                onBackPress={smartBack}
            />

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.id}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                refetch();
                            }}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary }}>Recycle bin is empty.</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const busy = processingId === item.id;
                        return (
                            <View style={[s.row, { backgroundColor: colors.card }]}> 
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.cat, { color: colors.text }]}>{item.category.replace(/_/g, ' ')}</Text>
                                    <Text style={[s.meta, { color: colors.textSecondary }]}>{item.description ?? item.paymentMode}</Text>
                                    <Text style={[s.meta, { color: colors.textSecondary }]}>{format(parseISO(item.expenseDate), 'dd MMM yyyy')}</Text>
                                </View>
                                <Text style={[s.amount, { color: colors.error }]}>-Rs {item.amount.toLocaleString('en-IN')}</Text>
                                <View style={s.actions}>
                                    <Pressable style={[s.actionBtn, { borderColor: colors.primary }]} onPress={() => handleRestore(item.id)} disabled={busy}>
                                        <MaterialCommunityIcons name="backup-restore" size={16} color={colors.primary} />
                                    </Pressable>
                                    <Pressable style={[s.actionBtn, { borderColor: colors.error }]} onPress={() => handlePermanentDelete(item.id)} disabled={busy}>
                                        <MaterialCommunityIcons name="delete-forever-outline" size={16} color={colors.error} />
                                    </Pressable>
                                </View>
                            </View>
                        );
                    }}
                    contentContainerStyle={{ paddingBottom: 120 }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        row: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
            padding: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        cat: { fontWeight: '700', fontSize: 14 },
        meta: { fontSize: 12, marginTop: 2 },
        amount: { fontWeight: '700', minWidth: 88, textAlign: 'right' },
        actions: { gap: 6 },
        actionBtn: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            width: 34,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
        },
    });
