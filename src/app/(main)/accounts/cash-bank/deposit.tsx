import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { CASH_BANK_VOUCHER_MODE_OPTIONS, getPaymentModeLabel, getVoucherReferenceHint } from '../../../../constants/accountingInputOptions';
import { DESIGN_SPACING, getPillStyle } from '../../../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../components/ui/AppInput';
import { SelectField, type SelectOption } from '../../../../components/ui/SelectField';
import { DateField } from '../../../../components/ui/DateField';
import { FormHero, FormSectionCard } from '../../../../components/ui/FormBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { toUserMessage } from '../../../../api/client';
import type { PaymentMode } from '../../../../constants/enums';
import { useCashBankAccounts } from '../../../../hooks/useCashBankAccounts';
import { useCashBankMutations } from '../../../../hooks/useCashBankMutations';

const toAmount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function DepositScreen() {
    const dialog = useAppDialog();
        const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');
    const params = useLocalSearchParams<{ accountId?: string }>();

    const [accountId, setAccountId] = useState(params.accountId ?? '');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');

    const { accounts, isRefetching, refetch } = useCashBankAccounts();
    const accountOptions = useMemo<SelectOption[]>(
        () =>
            accounts.map((entry) => ({
                label: entry.name,
                value: entry.id,
                description: `Balance Rs ${Number(entry.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
            })),
        [accounts]
    );

    const { deposit, isDepositing: isPending } = useCashBankMutations();

    const onSave = () => {
        const numericAmount = toAmount(amount);
        if (!accountId) {
            dialog.alert('Error', 'Select an account.');
            return;
        }
        if (numericAmount <= 0) {
            dialog.alert('Error', 'Amount must be positive.');
            return;
        }
        void deposit({
            accountId,
            amount: numericAmount,
            description: description.trim() || undefined,
            date,
            paymentMode,
        })
            .then((response) => {
                dialog.alert('Saved', response.message ?? 'Deposit recorded.');
                router.back();
            })
            .catch((error) => {
                console.error('[cash-bank/deposit] save failed', { accountId, amount, date, paymentMode, error });
                dialog.alert('Error', toUserMessage(error, 'Failed to save deposit.'));
            });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Deposit"
                subtitle="Add money to account"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={onSave} disabled={isPending}>
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.primary} />}
                    </Pressable>
                )}
            />

            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.content}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefetching}
                        onRefresh={() => {
                            refetch();
                        }}
                    />
                )}
            >
                <View style={s.heroWrap}>
                    <FormHero
                        title="Record Deposit"
                        subtitle="Post money received into the selected cash, bank, or cheque account."
                        icon="cash-plus"
                        tone="success"
                    />
                </View>

                <FormSectionCard title="Amount and Account" description="Choose the destination account and the amount being deposited." tone="success">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Amount</Text>
                    <AppInput
                        inputType="decimal"
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="0.00"
                    />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Select Account</Text>
                    <SelectField
                        value={accountId}
                        onChange={setAccountId}
                        options={accountOptions}
                        title="Select Account"
                        placeholder="Choose account"
                        searchable
                    />
                </FormSectionCard>

                <FormSectionCard title="Posting Details" description="Set deposit mode, date, and narration used for the voucher." tone="info">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Payment Mode</Text>
                    <SelectField
                        value={paymentMode}
                        onChange={(value) => setPaymentMode(value as PaymentMode)}
                        options={CASH_BANK_VOUCHER_MODE_OPTIONS.map((entry) => ({
                            label: entry.label,
                            value: entry.value,
                            description: entry.description,
                        }))}
                        title="Deposit Mode"
                        placeholder="Choose deposit mode"
                        searchable={false}
                    />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Date</Text>
                    <DateField value={date} onChange={(value) => setDate(value ?? date)} allowClear={false} />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Description (optional)</Text>
                    <AppInput
                        inputType="text"
                        value={description}
                        onChangeText={setDescription}
                        placeholder={getVoucherReferenceHint(paymentMode)}
                        multiline
                        style={s.notesInput}
                    />
                    <Text style={[s.modeHint, { color: colors.textSecondary }]}>
                        Deposit will be posted as {getPaymentModeLabel(paymentMode)} receipt into the selected account.
                    </Text>
                </FormSectionCard>

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={onSave} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryBtnText}>Record Deposit</Text>}
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
        content: { paddingHorizontal: DESIGN_SPACING.screenX, gap: DESIGN_SPACING.cardGap, paddingBottom: Spacing.lg },
        heroWrap: { marginBottom: Spacing.xs },
        label: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs },
        modeHint: { fontSize: 12 },
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
