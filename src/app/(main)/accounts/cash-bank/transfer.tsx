import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashBankApi } from '../../../../api/endpoints';
import { Radius, Spacing, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
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

export default function TransferScreen() {
    const dialog = useAppDialog();
        const colors = useAppColors();
    const qc = useQueryClient();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');
    const params = useLocalSearchParams<{ fromAccountId?: string }>();

    const [fromAccountId, setFromAccountId] = useState(params.fromAccountId ?? '');
    const [toAccountId, setToAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

    const { data: accountsData, isRefetching, refetch } = useQuery({ queryKey: ['cash-bank-balances'], queryFn: () => cashBankApi.getBalances() });
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

    const toOptions = useMemo(
        () => accountOptions.filter((entry) => entry.value !== fromAccountId),
        [accountOptions, fromAccountId]
    );

    const { mutate, isPending } = useMutation({
        mutationFn: () => {
            const numericAmount = toAmount(amount);
            if (!fromAccountId) throw new Error('Select source account.');
            if (!toAccountId) throw new Error('Select destination account.');
            if (fromAccountId === toAccountId) throw new Error('Source and destination must be different.');
            if (numericAmount <= 0) throw new Error('Amount must be positive.');

            return cashBankApi.transfer({
                fromAccountId,
                toAccountId,
                amount: numericAmount,
                description: description.trim() || undefined,
                date,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['cash-bank-balances'] });
            qc.invalidateQueries({ queryKey: ['cash-bank-summary'] });
            dialog.alert('Saved', 'Transfer recorded.');
            router.back();
        },
        onError: (error) => dialog.alert('Error', error instanceof Error ? error.message : 'Failed'),
    });

    const onSave = () => mutate();

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
                <View style={[s.heroCard, { backgroundColor: colors.primaryVariant }]}>
                    <Text style={s.heroLabel}>TRANSFER AMOUNT</Text>
                    <AppInput
                        inputType="decimal"
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="0.00"
                        style={s.heroInput}
                    />
                </View>

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

                <Text style={[s.label, { color: colors.textSecondary }]}>Date</Text>
                <DateField value={date} onChange={(value) => setDate(value ?? date)} allowClear={false} />

                <Text style={[s.label, { color: colors.textSecondary }]}>Note (optional)</Text>
                <AppInput
                    inputType="text"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Reason"
                />

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
        primaryBtn: {
            marginTop: Spacing.md,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
        },
        primaryBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
    });
