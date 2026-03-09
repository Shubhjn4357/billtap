import { useState } from 'react';
import {
    ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSmartBack } from '../../../../../hooks/useSmartBack';
import { Radius, Spacing, type ColorPalette } from '../../../../../constants/theme';
import { useAppColors } from '../../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../../components/ui/AppInput';
import { DateField } from '../../../../../components/ui/DateField';
import { FormHero, FormSectionCard } from '../../../../../components/ui/FormBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useLoanMutations } from '../../../../../hooks/useLoanMutations';

export default function LoanInterestEntryScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');
    const { id } = useLocalSearchParams<{ id: string }>();

    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');

    const { addLoanTransaction, isSavingLoanTransaction: isPending } = useLoanMutations();

    const handleSave = () => {
        const numericAmount = Number(amount);
        if (!numericAmount || numericAmount <= 0) {
            dialog.alert('Failed', 'Enter a valid interest amount.');
            return;
        }

        void addLoanTransaction({
            loanId: id!,
            payload: {
                transactionType: 'INTEREST',
                amount: numericAmount,
                date,
                notes: notes.trim() || undefined,
            },
        })
            .then(() => {
                dialog.alert('Saved', 'Interest entry recorded.');
                router.back();
            })
            .catch((error) => {
                dialog.alert('Failed', error instanceof Error ? error.message : 'Unable to save interest entry.');
            });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Add Interest"
                subtitle="Loan interest transaction"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={handleSave} disabled={isPending}>
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.primary} />}
                    </Pressable>
                )}
            />

            <View style={s.content}>
                <View style={s.heroWrap}>
                    <FormHero
                        title="Record Loan Interest"
                        subtitle="Post accrued interest with date and supporting notes."
                        icon="percent-circle-outline"
                        tone="warning"
                    />
                </View>

                <FormSectionCard title="Interest Entry" description="Capture the interest amount and posting date." tone="warning">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Amount</Text>
                    <AppInput inputType="decimal" value={amount} onChangeText={setAmount} placeholder="0.00" />

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
                </FormSectionCard>

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={isPending}>
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
        content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm },
        heroWrap: { marginBottom: Spacing.xs },
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
