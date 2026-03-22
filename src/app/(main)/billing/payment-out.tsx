import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSmartBack } from '../../../hooks/useSmartBack';
import { CASH_BANK_VOUCHER_MODE_OPTIONS, getPaymentModeLabel, getVoucherReferenceHint } from '../../../constants/accountingInputOptions';
import { DESIGN_SPACING } from '../../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { FormHero, FormSectionCard } from '../../../components/ui/FormBlocks';
import { SelectField, type SelectOption } from '../../../components/ui/SelectField';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import type { PaymentMode } from '../../../constants/enums';
import { useCashBankAccounts } from '../../../hooks/useCashBankAccounts';
import { useParties } from '../../../hooks/useParties';
import { useCashBankMutations } from '../../../hooks/useCashBankMutations';

const toAmount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export default function PaymentOutScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/billing');
    const dialog = useAppDialog();

    const [partyId, setPartyId] = useState<string | null>(null);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('BANK');
    const [amountInput, setAmountInput] = useState('');
    const [description, setDescription] = useState('');

    const openInfoDialog = (title: string, message: string) => {
        dialog.alert(title, message);
    };

    const { parties, isLoading: partiesLoading, isRefetching: partiesRefetching, refetch: refetchParties } = useParties({
        type: 'SUPPLIER',
        limit: 100,
    });
    const { accounts, isLoading: accountsLoading, isRefetching: accountsRefetching, refetch: refetchAccounts } = useCashBankAccounts();
    const partyOptions = useMemo<SelectOption[]>(
        () => [
            { label: 'Unlinked', value: '__unlinked__', description: 'No linked supplier ledger' },
            ...parties.map((entry) => ({ label: entry.name, value: entry.id, description: entry.phone || entry.gstin || undefined })),
        ],
        [parties]
    );
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

    const handleSave = () => {
        const amount = toAmount(amountInput);
        if (!accountId) {
            openInfoDialog('Payment Out failed', 'Select account.');
            return;
        }
        if (amount <= 0) {
            openInfoDialog('Payment Out failed', 'Enter a valid amount.');
            return;
        }

        const party = parties.find((entry) => entry.id === partyId);
        const note = description.trim() || (party ? `Payment sent to ${party.name}` : 'Payment Out');

        void withdraw({
            accountId,
            amount,
            paymentMode,
            description: note,
        })
            .then(() => {
                dialog.alert('Payment Out', 'Payment recorded successfully.', [
                    { text: 'OK', onPress: smartBack },
                ]);
            })
            .catch((error) => {
                openInfoDialog('Payment Out failed', error instanceof Error ? error.message : 'Unable to record payment.');
            });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Payment Out"
                subtitle="Record supplier payments"
                onBackPress={smartBack}
            />

            {(partiesLoading || accountsLoading) ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={s.content}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={partiesRefetching || accountsRefetching}
                            onRefresh={() => {
                                void Promise.all([refetchParties(), refetchAccounts()]);
                            }}
                        />
                    )}
                >
                    <View style={s.heroWrap}>
                        <FormHero
                            title="Record Payment Out"
                            subtitle="Capture supplier or vendor payments from cash, bank, or cheque accounts."
                            icon="cash-minus"
                            tone="danger"
                        />
                    </View>

                    <FormSectionCard title="Payment Setup" description="Choose supplier, source account, and settlement mode." tone="danger">
                        <Text style={[s.label, { color: colors.textSecondary }]}>Supplier / Vendor</Text>
                        <SelectField
                            value={partyId ?? '__unlinked__'}
                            onChange={(value) => setPartyId(value === '__unlinked__' ? null : value)}
                            options={partyOptions}
                            placeholder="Select supplier"
                            title="Select Supplier"
                            searchable
                        />

                        <Text style={[s.label, { color: colors.textSecondary }]}>Account</Text>
                        <SelectField
                            value={accountId}
                            onChange={setAccountId}
                            options={accountOptions}
                            placeholder="Select account"
                            title="Select Account"
                            searchable
                        />

                        <Text style={[s.label, { color: colors.textSecondary }]}>Payment Mode</Text>
                        <SelectField
                            value={paymentMode}
                            onChange={(value) => setPaymentMode(value as PaymentMode)}
                            options={CASH_BANK_VOUCHER_MODE_OPTIONS.map((entry) => ({
                                label: entry.label,
                                value: entry.value,
                                description: entry.description,
                            }))}
                            placeholder="Select payment mode"
                            title="Payment Mode"
                            searchable={false}
                        />
                    </FormSectionCard>

                    <FormSectionCard title="Amount and Narration" description="Enter payment amount and the posting note used for this voucher." tone="warning">
                        <Text style={[s.label, { color: colors.textSecondary }]}>Amount</Text>
                        <AppInput
                            inputType="decimal"
                            value={amountInput}
                            onChangeText={setAmountInput}
                            placeholder="0.00"
                        />

                        <Text style={[s.label, { color: colors.textSecondary }]}>Description</Text>
                        <AppInput
                            inputType="text"
                            value={description}
                            onChangeText={setDescription}
                            placeholder={getVoucherReferenceHint(paymentMode)}
                        />
                        <Text style={[s.modeHint, { color: colors.textSecondary }]}>
                            Payment posts as {getPaymentModeLabel(paymentMode)} disbursement.
                        </Text>
                    </FormSectionCard>

                    <Pressable
                        style={[s.submitBtn, { backgroundColor: colors.primary }, isPending && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={isPending}
                    >
                        {isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.submitText}>Save Payment Out</Text>}
                    </Pressable>
                    <View style={{ height: 80 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        content: { paddingHorizontal: DESIGN_SPACING.screenX, paddingTop: Spacing.sm, paddingBottom: 40, gap: DESIGN_SPACING.cardGap },
        heroWrap: { marginBottom: Spacing.xs },
        label: { fontSize: 12, fontWeight: '600' },
        modeHint: { fontSize: 12 },
        submitBtn: {
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            marginTop: Spacing.sm,
        },
        submitText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
    });
