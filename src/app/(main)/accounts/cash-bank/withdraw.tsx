import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { navigateBackOrReplace, resolveSingleParam, useSmartBack } from '../../../../hooks/useSmartBack';
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

export default function WithdrawScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const params = useLocalSearchParams<{ accountId?: string | string[]; returnPath?: string | string[] }>();
    const initialAccountId = resolveSingleParam(params.accountId) ?? '';
    const fallbackRoute = resolveSingleParam(params.returnPath) ?? (initialAccountId ? `/(main)/accounts/cash-bank/${initialAccountId}` : '/(main)/accounts/cash-bank');
    const smartBack = useSmartBack(fallbackRoute);

    const [accountId, setAccountId] = useState(initialAccountId);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('BANK');

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

    const { withdraw, isWithdrawing: isPending } = useCashBankMutations();

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
        void withdraw({
            accountId,
            amount: numericAmount,
            description: description.trim() || undefined,
            date,
            paymentMode,
        })
            .then((response) => {
                dialog.alert('Saved', response.message ?? 'Withdrawal recorded.');
                navigateBackOrReplace(fallbackRoute);
            })
            .catch((error) => {
                console.error('[cash-bank/withdraw] save failed', { accountId, amount, date, paymentMode, error });
                dialog.alert('Error', toUserMessage(error, 'Failed to save withdrawal.'));
            });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Withdraw"
                subtitle="Take money from account"
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
                        title="Record Withdrawal"
                        subtitle="Post money paid out from a selected cash, bank, or cheque account."
                        icon="cash-minus"
                        tone="danger"
                    />
                </View>

                <FormSectionCard title="Amount and Account" description="Choose the source account and the amount being withdrawn." tone="danger">
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

                <FormSectionCard title="Posting Details" description="Set withdrawal mode, date, and narration used for the payment voucher." tone="warning">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Payment Mode</Text>
                    <SelectField
                        value={paymentMode}
                        onChange={(value) => setPaymentMode(value as PaymentMode)}
                        options={CASH_BANK_VOUCHER_MODE_OPTIONS.map((entry) => ({
                            label: entry.label,
                            value: entry.value,
                            description: entry.description,
                        }))}
                        title="Withdrawal Mode"
                        placeholder="Choose payment mode"
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
                        Withdrawal will be posted as {getPaymentModeLabel(paymentMode)} payment from the selected account.
                    </Text>
                </FormSectionCard>

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
