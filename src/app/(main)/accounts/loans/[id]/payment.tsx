import { useState } from 'react';
import {
    ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSmartBack } from '../../../../../hooks/useSmartBack';
import { DESIGN_SPACING, getPillStyle } from '../../../../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../../../../constants/theme';
import { useAppColors } from '../../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../../components/ui/AppInput';
import { DateField } from '../../../../../components/ui/DateField';
import { FormHero, FormSectionCard } from '../../../../../components/ui/FormBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useLoanMutations } from '../../../../../hooks/useLoanMutations';

export default function LoanPaymentEntryScreen() {
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
            dialog.alert('Failed', 'Enter a valid payment amount.');
            return;
        }

        void addLoanTransaction({
            loanId: id!,
            payload: {
                transactionType: 'REPAYMENT',
                amount: numericAmount,
                date,
                notes: notes.trim() || undefined,
            },
        })
            .then(() => {
                dialog.alert('Saved', 'Loan repayment recorded.');
                router.back();
            })
            .catch((error) => {
                dialog.alert('Failed', error instanceof Error ? error.message : 'Unable to save repayment.');
            });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Add Payment"
                subtitle="Loan repayment transaction"
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
                        title="Record Loan Payment"
                        subtitle="Post a repayment entry against this loan with date and reference notes."
                        icon="cash-check"
                        tone="success"
                    />
                </View>

                <FormSectionCard title="Repayment Entry" description="Capture the repayment amount and posting date." tone="success">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Amount</Text>
                    <AppInput inputType="decimal" value={amount} onChangeText={setAmount} placeholder="0.00" />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Date</Text>
                    <DateField value={date} onChange={(value) => setDate(value ?? date)} allowClear={false} />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
                    <AppInput
                        inputType="text"
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Reference / remarks"
                        multiline
                        style={s.notesInput}
                    />
                </FormSectionCard>

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryBtnText}>Record Payment</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        saveBtn: {
            ...getPillStyle(colors),
            minHeight: 34,
            minWidth: 56,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.md,
        },
        content: { paddingHorizontal: DESIGN_SPACING.screenX, paddingTop: Spacing.sm, gap: DESIGN_SPACING.cardGap },
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
