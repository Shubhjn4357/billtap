import { useState } from 'react';
import {
    ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSmartBack } from '../../../../../hooks/useSmartBack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loanApi } from '../../../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette, withAlpha } from '../../../../../constants/theme';
import { AppTopBar } from '../../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../../components/ui/AppInput';
import { DateField } from '../../../../../components/ui/DateField';
import { useAppDialog } from '@/components/providers/DialogProvider';

export default function LoanInterestEntryScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');
    const qc = useQueryClient();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const numericAmount = Number(amount);
            if (!numericAmount || numericAmount <= 0) {
                throw new Error('Enter a valid interest amount.');
            }
            return loanApi.addTransaction(id!, {
                transactionType: 'INTEREST',
                amount: numericAmount,
                date,
                notes: notes.trim() || undefined,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['loan', id] });
            qc.invalidateQueries({ queryKey: ['loan-transactions', id] });
            qc.invalidateQueries({ queryKey: ['loans'] });
            dialog.alert('Saved', 'Interest entry recorded.');
            router.back();
        },
        onError: (error) => {
            dialog.alert('Failed', error instanceof Error ? error.message : 'Unable to save interest entry.');
        },
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Add Interest"
                subtitle="Loan interest transaction"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={() => mutate()} disabled={isPending}>
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.primary} />}
                    </Pressable>
                )}
            />

            <View style={s.content}>
                <View style={[s.heroCard, { backgroundColor: colors.warning }]}>
                    <Text style={s.heroLabel}>INTEREST AMOUNT</Text>
                    <AppInput inputType="decimal" value={amount} onChangeText={setAmount} placeholder="0.00" style={s.heroInput} />
                </View>

                <Text style={[s.label, { color: colors.textSecondary }]}>Date</Text>
                <DateField value={date} onChange={(value) => setDate(value ?? date)} allowClear={false} />

                <Text style={[s.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
                <AppInput
                    inputType="text"
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Interest period / remarks"
                    multiline
                    style={s.notesInput}
                />

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => mutate()} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryBtnText}>Record Interest</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        saveBtn: {
            minHeight: 34,
            minWidth: 56,
            borderWidth: 1,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.md,
        },
        saveText: { fontSize: 12, fontWeight: '700' },
        content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm },
        heroCard: { borderRadius: Radius.card, padding: Spacing.lg, marginBottom: Spacing.sm, gap: Spacing.xs },
        heroLabel: { color: withAlpha(colors.onPrimary, 'cc'), fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
        heroInput: { color: colors.onPrimary, fontSize: 24, fontWeight: '800' },
        label: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs },
        notesInput: { minHeight: 64, textAlignVertical: 'top' },
        primaryBtn: {
            marginTop: Spacing.md,
            borderRadius: Radius.pill,
            paddingVertical: Spacing.md,
            alignItems: 'center',
        },
        primaryBtnText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
    });
