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
import { router } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashBankApi, partyApi } from '../../../api/endpoints';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import type { Account, Party } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { SelectField, type SelectOption } from '../../../components/ui/SelectField';
import { useAppDialog } from '../../../components/providers/DialogProvider';

const toAmount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export default function PaymentInScreen() {
        const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/billing');
    const qc = useQueryClient();
    const dialog = useAppDialog();

    const [partyId, setPartyId] = useState<string | null>(null);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [amountInput, setAmountInput] = useState('');
    const [description, setDescription] = useState('');

    const openInfoDialog = (title: string, message: string) => {
        dialog.alert(title, message);
    };

    const { data: partiesRes, isLoading: partiesLoading, isRefetching: partiesRefetching, refetch: refetchParties } = useQuery({
        queryKey: ['billing-payment-in-parties'],
        queryFn: () => partyApi.list({ type: 'customer', limit: 100 }),
        staleTime: 30_000,
    });

    const { data: accountsRes, isLoading: accountsLoading, isRefetching: accountsRefetching, refetch: refetchAccounts } = useQuery({
        queryKey: ['billing-payment-in-accounts'],
        queryFn: () => cashBankApi.getBalances(),
        staleTime: 30_000,
    });

    const parties = useMemo(() => (partiesRes?.data ?? []) as Party[], [partiesRes?.data]);
    const accounts = useMemo(() => (accountsRes?.data ?? []) as Account[], [accountsRes?.data]);
    const partyOptions = useMemo<SelectOption[]>(
        () => [
            { label: 'Walk-in', value: '__walk_in__', description: 'No linked customer ledger' },
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

    const { mutate: submitPayment, isPending } = useMutation({
        mutationFn: async () => {
            const amount = toAmount(amountInput);
            if (!accountId) throw new Error('Select account.');
            if (amount <= 0) throw new Error('Enter a valid amount.');

            const party = parties.find((entry) => entry.id === partyId);
            const note = description.trim() || (party ? `Payment received from ${party.name}` : 'Payment In');

            return cashBankApi.deposit({
                accountId,
                amount,
                paymentMode: 'CASH',
                description: note,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['cash-bank-balances'] });
            qc.invalidateQueries({ queryKey: ['cash-bank-summary'] });
            dialog.alert('Payment In', 'Payment recorded successfully.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        },
        onError: (error) => {
            openInfoDialog('Payment In failed', error instanceof Error ? error.message : 'Unable to record payment.');
        },
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Payment In"
                subtitle="Record customer receipts"
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
                    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.label, { color: colors.textSecondary }]}>Customer</Text>
                        <SelectField
                            value={partyId ?? '__walk_in__'}
                            onChange={(value) => setPartyId(value === '__walk_in__' ? null : value)}
                            options={partyOptions}
                            placeholder="Select customer"
                            title="Select Customer"
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
                            placeholder="Optional note"
                        />

                        <Pressable
                            style={[s.submitBtn, { backgroundColor: colors.primary }, isPending && { opacity: 0.7 }]}
                            onPress={() => submitPayment()}
                            disabled={isPending}
                        >
                            {isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.submitText}>Save Payment In</Text>}
                        </Pressable>
                    </View>
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
        content: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
        card: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            gap: Spacing.sm,
        },
        label: { fontSize: 12, fontWeight: '600' },
        submitBtn: {
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            marginTop: Spacing.sm,
        },
        submitText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
    });
