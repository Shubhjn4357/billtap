import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashBankApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../components/ui/AppInput';
import { SelectField, type SelectOption } from '../../../../components/ui/SelectField';
import { DateField } from '../../../../components/ui/DateField';
import type { Account } from '../../../../types/domain';
import { useAppDialog } from '@/components/providers/DialogProvider';

const toAmount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function WithdrawScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const qc = useQueryClient();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');
    const params = useLocalSearchParams<{ accountId?: string }>();

    const [accountId, setAccountId] = useState(params.accountId ?? '');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [paymentMode, setPaymentMode] = useState('BANK');

    const { data: accountsData } = useQuery({ queryKey: ['cash-bank-balances'], queryFn: () => cashBankApi.getBalances() });
    const accounts = useMemo(() => (accountsData?.data ?? []) as Account[], [accountsData?.data]);
    const accountOptions = useMemo<SelectOption[]>(
        () =>
            accounts.map((entry) => ({
                label: entry.name,
                value: entry.id,
                description: `Balance Rs ${Number(entry.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
            })),
        [accounts]
    );

    const { mutate, isPending } = useMutation({
        mutationFn: () => {
            const numericAmount = toAmount(amount);
            if (!accountId) throw new Error('Select an account.');
            if (numericAmount <= 0) throw new Error('Amount must be positive.');
            return cashBankApi.withdraw({
                accountId,
                amount: numericAmount,
                description: description.trim() || undefined,
                date,
                paymentMode,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['cash-bank-balances'] });
            qc.invalidateQueries({ queryKey: ['cash-bank-summary'] });
            dialog.alert('Saved', 'Withdrawal recorded.');
            router.back();
        },
        onError: (error) => dialog.alert('Error', error instanceof Error ? error.message : 'Failed'),
    });

    const onSave = () => mutate();

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Withdraw"
                subtitle="Take money from account"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={onSave} disabled={isPending}>
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.saveText, { color: colors.primary }]}>Save</Text>}
                    </Pressable>
                )}
            />

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
                <View style={[s.heroCard, { backgroundColor: colors.error }]}>
                    <Text style={s.heroLabel}>WITHDRAW AMOUNT</Text>
                    <AppInput
                        inputType="decimal"
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="0.00"
                        style={s.heroInput}
                    />
                </View>

                <Text style={[s.label, { color: colors.textSecondary }]}>Select Account</Text>
                <SelectField
                    value={accountId}
                    onChange={setAccountId}
                    options={accountOptions}
                    title="Select Account"
                    placeholder="Choose account"
                    searchable
                />

                <Text style={[s.label, { color: colors.textSecondary }]}>Payment Mode</Text>
                <View style={s.modeRow}>
                    {['CASH', 'BANK', 'UPI', 'CARD'].map((mode) => {
                        const selected = paymentMode === mode;
                        return (
                            <Pressable
                                key={mode}
                                style={[s.modeChip, { backgroundColor: selected ? colors.primary : colors.surfaceVariant }]}
                                onPress={() => setPaymentMode(mode)}
                            >
                                <Text style={{ color: selected ? colors.onPrimary : colors.text, fontSize: 12, fontWeight: '700' }}>{mode}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={[s.label, { color: colors.textSecondary }]}>Date</Text>
                <DateField value={date} onChange={(value) => setDate(value ?? date)} allowClear={false} />

                <Text style={[s.label, { color: colors.textSecondary }]}>Description (optional)</Text>
                <AppInput
                    inputType="text"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Purpose"
                    multiline
                    style={s.notesInput}
                />

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={onSave} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryBtnText}>Record Withdrawal</Text>}
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
        heroCard: {
            borderRadius: Radius.card,
            padding: Spacing.lg,
            marginBottom: Spacing.sm,
            gap: Spacing.xs,
        },
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
