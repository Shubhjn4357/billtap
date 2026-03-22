import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { navigateBackOrReplace, useSmartBack } from '../../../../hooks/useSmartBack';
import { DESIGN_SPACING, getPillStyle } from '../../../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { ExpenseCategory, PaymentMode } from '../../../../constants/enums';
import { EXPENSE_CATEGORY_OPTIONS, EXPENSE_PAYMENT_MODE_OPTIONS } from '../../../../constants/formOptions';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { FormHero, FormSectionCard } from '../../../../components/ui/FormBlocks';
import { AppInput } from '../../../../components/ui/AppInput';
import { SelectField } from '../../../../components/ui/SelectField';
import { DateField } from '../../../../components/ui/DateField';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useExpenseMutations } from '../../../../hooks/useExpenseMutations';

const toAmount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function AddExpenseScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');

    const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.MISCELLANEOUS);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
    const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
    const [partyName, setPartyName] = useState('');

    const { saveExpense, isSavingExpense: isPending } = useExpenseMutations();

    const handleSave = () => {
        const numericAmount = toAmount(amount);
        if (numericAmount <= 0) {
            dialog.alert('Error', 'Amount must be positive.');
            return;
        }

        void saveExpense({
            data: {
                category,
                amount: numericAmount,
                description: description.trim() || null,
                date: expenseDate,
                expenseDate,
                paymentMode,
                accountId: null,
                partyId: null,
                partyName: partyName.trim() || null,
                receiptUrl: null,
                gstRate: 0,
                isGstIncluded: false,
            },
        })
            .then(() => {
                dialog.alert('Saved', 'Expense recorded.');
                navigateBackOrReplace('/(main)/accounts/expenses');
            })
            .catch((error) => {
                dialog.alert('Error', error instanceof Error ? error.message : 'Failed to save expense');
            });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Add Expense"
                subtitle="Record expense transaction"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={handleSave} disabled={isPending}>
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.primary} />}
                    </Pressable>
                )}
            />

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
                <View style={s.heroWrap}>
                    <FormHero
                        title="Create Expense"
                        subtitle="Record category, payment mode, date, and vendor details for every outgoing amount."
                        icon="receipt-text-plus-outline"
                        tone="danger"
                    />
                </View>

                <FormSectionCard title="Amount and Classification" description="Capture the amount, category, and how the payment was made." tone="danger">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Amount</Text>
                    <AppInput inputType="decimal" value={amount} onChangeText={setAmount} placeholder="0.00" />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Category</Text>
                    <SelectField
                        value={category}
                        onChange={(value) => setCategory(value as ExpenseCategory)}
                        options={EXPENSE_CATEGORY_OPTIONS}
                        title="Select Category"
                        placeholder="Choose category"
                    />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Payment Mode</Text>
                    <SelectField
                        value={paymentMode}
                        onChange={(value) => setPaymentMode(value as PaymentMode)}
                        options={EXPENSE_PAYMENT_MODE_OPTIONS}
                        title="Select Payment Mode"
                        placeholder="Choose payment mode"
                    />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Date</Text>
                    <DateField value={expenseDate} onChange={(value) => setExpenseDate(value ?? expenseDate)} allowClear={false} />
                </FormSectionCard>

                <FormSectionCard title="Narration and Counterparty" description="Add notes and who the expense was paid to." tone="warning">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Description (optional)</Text>
                    <AppInput
                        inputType="text"
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Notes"
                        multiline
                        style={s.notesInput}
                    />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Paid To (optional)</Text>
                    <AppInput inputType="text" value={partyName} onChangeText={setPartyName} placeholder="Vendor / Party name" />
                </FormSectionCard>

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryBtnText}>Record Expense</Text>}
                </Pressable>

                <View style={{ height: 60 }} />
            </ScrollView>
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
        content: { paddingHorizontal: DESIGN_SPACING.screenX, paddingTop: Spacing.sm, gap: DESIGN_SPACING.cardGap, paddingBottom: Spacing.lg },
        heroWrap: { marginBottom: Spacing.xs },
        label: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs },
        notesInput: { minHeight: 64, textAlignVertical: 'top' },
        primaryBtn: {
            marginTop: Spacing.md,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
        },
        primaryBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
    });
