import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashBankApi, partyApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';
import type { Account, Party } from '../../../types/domain';

const toAmount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export default function PaymentOutScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const qc = useQueryClient();

    const [partyId, setPartyId] = useState<string | null>(null);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [amountInput, setAmountInput] = useState('');
    const [description, setDescription] = useState('');

    const { data: partiesRes, isLoading: partiesLoading } = useQuery({
        queryKey: ['billing-payment-out-parties'],
        queryFn: () => partyApi.list({ type: 'supplier', limit: 100 }),
        staleTime: 30_000,
    });

    const { data: accountsRes, isLoading: accountsLoading } = useQuery({
        queryKey: ['billing-payment-out-accounts'],
        queryFn: () => cashBankApi.getBalances(),
        staleTime: 30_000,
    });

    const parties = useMemo(() => (partiesRes?.data ?? []) as Party[], [partiesRes?.data]);
    const accounts = useMemo(() => (accountsRes?.data ?? []) as Account[], [accountsRes?.data]);

    const { mutate: submitPayment, isPending } = useMutation({
        mutationFn: async () => {
            const amount = toAmount(amountInput);
            if (!accountId) throw new Error('Select account.');
            if (amount <= 0) throw new Error('Enter a valid amount.');

            const party = parties.find((entry) => entry.id === partyId);
            const note = description.trim() || (party ? `Payment sent to ${party.name}` : 'Payment Out');

            return cashBankApi.withdraw({
                accountId,
                amount,
                paymentMode: 'BANK',
                description: note,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['cash-bank-balances'] });
            qc.invalidateQueries({ queryKey: ['cash-bank-summary'] });
            Alert.alert('Payment Out', 'Payment recorded successfully.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        },
        onError: (error) => {
            Alert.alert('Payment Out failed', error instanceof Error ? error.message : 'Unable to record payment.');
        },
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.backText, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Payment Out</Text>
                <View style={{ width: 44 }} />
            </View>

            {(partiesLoading || accountsLoading) ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={s.content}>
                    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                        <Text style={[s.label, { color: colors.textSecondary }]}>Supplier / Vendor</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
                            <Pressable
                                style={[s.chip, { borderColor: !partyId ? colors.primary : colors.border, backgroundColor: !partyId ? colors.surfaceVariant : 'transparent' }]}
                                onPress={() => setPartyId(null)}
                            >
                                <Text style={{ color: !partyId ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                                    Unlinked
                                </Text>
                            </Pressable>
                            {parties.map((party) => {
                                const selected = partyId === party.id;
                                return (
                                    <Pressable
                                        key={party.id}
                                        style={[s.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceVariant : 'transparent' }]}
                                        onPress={() => setPartyId(party.id)}
                                    >
                                        <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                                            {party.name}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        <Text style={[s.label, { color: colors.textSecondary }]}>Account</Text>
                        <View style={s.accountList}>
                            {accounts.map((account) => {
                                const selected = accountId === account.id;
                                return (
                                    <Pressable
                                        key={account.id}
                                        style={[s.accountRow, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceVariant : 'transparent' }]}
                                        onPress={() => setAccountId(account.id)}
                                    >
                                        <Text style={[s.accountName, { color: colors.text }]}>{account.name}</Text>
                                        <Text style={[s.accountBalance, { color: colors.textSecondary }]}>
                                            Rs {Number(account.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={[s.label, { color: colors.textSecondary }]}>Amount</Text>
                        <TextInput
                            style={[s.input, { borderColor: colors.border, color: colors.text }]}
                            value={amountInput}
                            onChangeText={setAmountInput}
                            keyboardType="numeric"
                            placeholder="0.00"
                            placeholderTextColor={colors.textSecondary}
                        />

                        <Text style={[s.label, { color: colors.textSecondary }]}>Description</Text>
                        <TextInput
                            style={[s.input, { borderColor: colors.border, color: colors.text }]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Optional note"
                            placeholderTextColor={colors.textSecondary}
                        />

                        <Pressable
                            style={[s.submitBtn, { backgroundColor: colors.primary }, isPending && { opacity: 0.7 }]}
                            onPress={() => submitPayment()}
                            disabled={isPending}
                        >
                            {isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Save Payment Out</Text>}
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
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        backText: { fontWeight: '600', fontSize: 14 },
        title: { color: colors.text, fontSize: Typography.title.size, fontWeight: '700' },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        content: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
        card: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            gap: Spacing.sm,
        },
        label: { fontSize: 12, fontWeight: '600' },
        chipsRow: { gap: Spacing.xs, paddingVertical: 4 },
        chip: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        accountList: { gap: Spacing.xs },
        accountRow: {
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        accountName: { fontSize: 13, fontWeight: '600' },
        accountBalance: { fontSize: 12 },
        input: {
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            fontSize: 14,
        },
        submitBtn: {
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            marginTop: Spacing.sm,
        },
        submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    });
