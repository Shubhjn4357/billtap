import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { navigateBackOrReplace, resolveSingleParam, useSmartBack } from '../../../../hooks/useSmartBack';
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
import { useCashBankAccounts } from '../../../../hooks/useCashBankAccounts';
import { useCashBankMutations } from '../../../../hooks/useCashBankMutations';

const toAmount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function TransferScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const params = useLocalSearchParams<{ fromAccountId?: string | string[]; returnPath?: string | string[] }>();
    const initialFromAccountId = resolveSingleParam(params.fromAccountId) ?? '';
    const fallbackRoute = resolveSingleParam(params.returnPath) ?? (initialFromAccountId ? `/(main)/accounts/cash-bank/${initialFromAccountId}` : '/(main)/accounts/cash-bank');
    const smartBack = useSmartBack(fallbackRoute);

    const [fromAccountId, setFromAccountId] = useState(initialFromAccountId);
    const [toAccountId, setToAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

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

    const toOptions = useMemo(
        () => accountOptions.filter((entry) => entry.value !== fromAccountId),
        [accountOptions, fromAccountId]
    );

    const { transfer, isTransferring: isPending } = useCashBankMutations();

    const onSave = () => {
        const numericAmount = toAmount(amount);
        if (!fromAccountId) {
            dialog.alert('Error', 'Select source account.');
            return;
        }
        if (!toAccountId) {
            dialog.alert('Error', 'Select destination account.');
            return;
        }
        if (fromAccountId === toAccountId) {
            dialog.alert('Error', 'Source and destination must be different.');
            return;
        }
        if (numericAmount <= 0) {
            dialog.alert('Error', 'Amount must be positive.');
            return;
        }

        void transfer({
            fromAccountId,
            toAccountId,
            amount: numericAmount,
            description: description.trim() || undefined,
            date,
        })
            .then((response) => {
                dialog.alert('Saved', response.message ?? 'Transfer recorded.');
                navigateBackOrReplace(fallbackRoute);
            })
            .catch((error) => {
                console.error('[cash-bank/transfer] save failed', { fromAccountId, toAccountId, amount, date, error });
                dialog.alert('Error', toUserMessage(error, 'Failed to save transfer.'));
            });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Fund Transfer"
                subtitle="Move between accounts"
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
                        title="Record Transfer"
                        subtitle="Move funds between internal accounts without losing ledger traceability."
                        icon="bank-transfer"
                        tone="info"
                    />
                </View>

                <FormSectionCard title="Transfer Setup" description="Select source, destination, and the amount being moved." tone="info">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Amount</Text>
                    <AppInput
                        inputType="decimal"
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="0.00"
                    />

                    <Text style={[s.label, { color: colors.textSecondary }]}>From Account</Text>
                    <SelectField
                        value={fromAccountId}
                        onChange={(value) => {
                            setFromAccountId(value);
                            if (toAccountId === value) {
                                setToAccountId('');
                            }
                        }}
                        options={accountOptions}
                        title="Select Source Account"
                        placeholder="Choose source"
                        searchable
                    />

                    <Text style={[s.label, { color: colors.textSecondary }]}>To Account</Text>
                    <SelectField
                        value={toAccountId}
                        onChange={setToAccountId}
                        options={toOptions}
                        title="Select Destination Account"
                        placeholder="Choose destination"
                        searchable
                    />
                </FormSectionCard>

                <FormSectionCard title="Voucher Details" description="Choose posting date and optional narration for the contra entry." tone="warning">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Date</Text>
                    <DateField value={date} onChange={(value) => setDate(value ?? date)} allowClear={false} />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Note (optional)</Text>
                    <AppInput
                        inputType="text"
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Reason"
                    />
                </FormSectionCard>

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={onSave} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryBtnText}>Record Transfer</Text>}
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
        primaryBtn: {
            marginTop: Spacing.md,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
        },
        primaryBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
    });
