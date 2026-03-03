import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { expenseApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../../constants/theme';
import type { Expense } from '../../../../types/domain';

export default function ExpenseRecycleBinScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const s = styles(colors);
    const qc = useQueryClient();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['expenses-recycle-bin'],
        queryFn: () => expenseApi.recycleBin({ limit: 200 }),
        staleTime: 15_000,
    });

    const { mutateAsync: restore } = useMutation({
        mutationFn: (id: string) => expenseApi.restore(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses-recycle-bin'] });
            qc.invalidateQueries({ queryKey: ['expenses'] });
        },
    });

    const { mutateAsync: permanentDelete } = useMutation({
        mutationFn: (id: string) => expenseApi.permanentDelete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses-recycle-bin'] });
            qc.invalidateQueries({ queryKey: ['expenses'] });
        },
    });

    const entries = (data?.data ?? []) as Expense[];

    const handleRestore = (id: string) => {
        Alert.alert('Restore expense', 'Move this expense back to active list?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Restore',
                onPress: async () => {
                    try {
                        setProcessingId(id);
                        await restore(id);
                    } catch (error) {
                        Alert.alert('Restore failed', error instanceof Error ? error.message : 'Failed to restore expense.');
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    const handlePermanentDelete = (id: string) => {
        Alert.alert('Delete permanently', 'This cannot be undone. Continue?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        setProcessingId(id);
                        await permanentDelete(id);
                    } catch (error) {
                        Alert.alert('Delete failed', error instanceof Error ? error.message : 'Failed to delete expense.');
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>{'< Back'}</Text>
                </Pressable>
                <Text style={[s.title, { color: colors.text }]}>Expense Recycle Bin</Text>
                <View style={{ width: 52 }} />
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.id}
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
                                    <Text style={[s.meta, { color: colors.textSecondary }]}>
                                        {item.description ?? item.paymentMode}
                                    </Text>
                                    <Text style={[s.meta, { color: colors.textSecondary }]}>
                                        {format(parseISO(item.expenseDate), 'dd MMM yyyy')}
                                    </Text>
                                </View>
                                <Text style={[s.amount, { color: colors.error }]}>
                                    -{item.amount.toLocaleString('en-IN')}
                                </Text>
                                <View style={s.actions}>
                                    <Pressable style={[s.actionBtn, { borderColor: colors.primary }]} onPress={() => handleRestore(item.id)} disabled={busy}>
                                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Restore</Text>
                                    </Pressable>
                                    <Pressable style={[s.actionBtn, { borderColor: colors.error }]} onPress={() => handlePermanentDelete(item.id)} disabled={busy}>
                                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 12 }}>Delete</Text>
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
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
        back: { fontWeight: '600', fontSize: 14, width: 52 },
        title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16 },
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
        amount: { fontWeight: '700', minWidth: 72, textAlign: 'right' },
        actions: { gap: 6 },
        actionBtn: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 4,
            alignItems: 'center',
        },
    });
