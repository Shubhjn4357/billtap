import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { ExpenseCategory, PaymentMode } from '../../../../constants/enums';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../components/ui/AppInput';
import { SelectField } from '../../../../components/ui/SelectField';
import { DateField } from '../../../../components/ui/DateField';
import { useAppDialog } from '@/components/providers/DialogProvider';

const CATEGORIES = Object.values(ExpenseCategory);
const PAYMENT_MODES = ['CASH', 'BANK', 'UPI', 'CARD'] as const;

const toAmount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function AddExpenseScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const qc = useQueryClient();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');

    const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.MISCELLANEOUS);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
    const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
    const [partyName, setPartyName] = useState('');

    const { mutate, isPending } = useMutation({
        mutationFn: () => {
            const numericAmount = toAmount(amount);
            if (numericAmount <= 0) throw new Error('Amount must be positive.');

            return expenseApi.create({
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
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] });
            qc.invalidateQueries({ queryKey: ['recent-expenses'] });
            dialog.alert('Saved', 'Expense recorded.');
            router.back();
        },
        onError: (error) => dialog.alert('Error', error instanceof Error ? error.message : 'Failed to save expense'),
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Add Expense"
                subtitle="Record expense transaction"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={() => mutate()} disabled={isPending}>
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.saveText, { color: colors.primary }]}>Save</Text>}
                    </Pressable>
                )}
            />

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
                <View style={[s.heroCard, { backgroundColor: colors.primary }]}>
                    <Text style={s.heroLabel}>AMOUNT</Text>
                    <AppInput inputType="decimal" value={amount} onChangeText={setAmount} placeholder="0.00" style={s.heroInput} />
                </View>

                <Text style={[s.label, { color: colors.textSecondary }]}>Category</Text>
                <SelectField
                    value={category}
                    onChange={(value) => setCategory(value as ExpenseCategory)}
                    options={CATEGORIES.map((entry) => ({ label: entry.replace(/_/g, ' '), value: entry }))}
                    title="Select Category"
                    placeholder="Choose category"
                />

                <Text style={[s.label, { color: colors.textSecondary }]}>Payment Mode</Text>
                <View style={s.modeRow}>
                    {PAYMENT_MODES.map((mode) => {
                        const selected = paymentMode === mode;
                        return (
                            <Pressable
                                key={mode}
                                style={[s.modeChip, { backgroundColor: selected ? colors.primary : colors.surfaceVariant }]}
                                onPress={() => setPaymentMode(mode)}
                            >
                                <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '700', fontSize: 12 }}>{mode}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={[s.label, { color: colors.textSecondary }]}>Date</Text>
                <DateField value={expenseDate} onChange={(value) => setExpenseDate(value ?? expenseDate)} allowClear={false} />

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

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => mutate()} disabled={isPending}>
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
            minHeight: 34,
            minWidth: 56,
            borderWidth: 1,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.md,
        },
        saveText: { fontSize: 12, fontWeight: '700' },
        content: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.lg },
        heroCard: { borderRadius: Radius.card, padding: Spacing.lg, marginBottom: Spacing.sm, gap: Spacing.xs },
        heroLabel: { color: withAlpha(colors.onPrimary, 'cc'), fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
        heroInput: { color: colors.onPrimary, fontSize: 24, fontWeight: '800' },
        label: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs },
        modeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
        modeChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 7 },
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
