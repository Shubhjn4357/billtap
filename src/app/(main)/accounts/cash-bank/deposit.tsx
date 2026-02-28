// @ts-nocheck
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, useColorScheme, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashBankApi } from '../../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../../constants/theme';
import { format } from 'date-fns';
import type { Account } from '../../../../types/domain';

const depositSchema = z.object({
    accountId: z.string().min(1, 'Select an account'),
    amount: z.coerce.number().positive('Amount must be positive'),
    description: z.string().optional(),
    date: z.string().default(() => format(new Date(), 'yyyy-MM-dd')),
    paymentMode: z.string().default('CASH'),
});
type DepositForm = z.infer<typeof depositSchema>;

export default function DepositScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const qc = useQueryClient();
    const s = styles(colors);

    const { data: accountsData } = useQuery({ queryKey: ['cash-bank-balances'], queryFn: () => cashBankApi.getBalances() });
    const accounts = (accountsData?.data ?? []) as Account[];

    const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<DepositForm>({
        resolver: zodResolver(depositSchema),
        defaultValues: { date: format(new Date(), 'yyyy-MM-dd'), paymentMode: 'CASH' },
    });

    const { mutate, isPending } = useMutation({
        mutationFn: (data: DepositForm) => cashBankApi.deposit({ accountId: data.accountId, amount: data.amount, description: data.description, date: data.date, paymentMode: data.paymentMode }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-bank-balances'] }); router.back(); Alert.alert('✅ Deposit recorded'); },
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed'),
    });

    const accountId = watch('accountId');
    const payMode = watch('paymentMode');

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Cancel</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>Deposit</Text>
                <Pressable onPress={handleSubmit((d) => mutate(d))} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.save, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
                <View style={[s.amtCard, { backgroundColor: colors.success }]}>
                    <Text style={s.amtLabel}>DEPOSIT AMOUNT (₹)</Text>
                    <Controller control={control} name="amount" render={({ field: { onChange, value } }) => (
                        <TextInput style={s.amtInput} value={String(value || '')} onChangeText={onChange} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#ffffffaa" />
                    )} />
                    {errors.amount && <Text style={{ color: '#ffd0d0', fontSize: 11 }}>{errors.amount.message}</Text>}
                </View>

                <View style={s.form}>
                    <Field label="Select Account" error={errors.accountId?.message} colors={colors}>
                        {accounts.map((acc) => (
                            <Pressable key={acc.id} style={[s.accChip, { backgroundColor: accountId === acc.id ? colors.primary : colors.surfaceVariant }]} onPress={() => setValue('accountId', acc.id)}>
                                <Text style={{ color: accountId === acc.id ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                                    {acc.type === 'CASH' ? '💵' : '🏦'} {acc.name}
                                </Text>
                            </Pressable>
                        ))}
                    </Field>

                    <Field label="Payment Mode" colors={colors}>
                        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                            {['CASH', 'BANK', 'UPI', 'CARD'].map((m) => (
                                <Pressable key={m} style={[s.modeChip, { backgroundColor: payMode === m ? colors.primary : colors.surfaceVariant }]} onPress={() => setValue('paymentMode', m)}>
                                    <Text style={{ color: payMode === m ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{m}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </Field>

                    <Field label="Date" colors={colors}>
                        <Controller control={control} name="date" render={({ field: { onChange, value } }) => (
                            <TextInput style={[s.input, { color: colors.text, borderColor: colors.border }]} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
                        )} />
                    </Field>

                    <Field label="Description (optional)" colors={colors}>
                        <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
                            <TextInput style={[s.input, { color: colors.text, borderColor: colors.border, minHeight: 60 }]} value={value} onChangeText={onChange} placeholder="Notes…" placeholderTextColor={colors.textSecondary} multiline textAlignVertical="top" />
                        )} />
                    </Field>
                </View>
                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function Field({ label, children, error, colors }: { label: string; children: React.ReactNode; error?: string; colors: ColorPalette }) {
    return (
        <View style={{ marginBottom: Spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
            {children}
            {error && <Text style={{ color: colors.error, fontSize: 11, marginTop: 2 }}>{error}</Text>}
        </View>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
    save: { fontWeight: '700', fontSize: 15 },
    amtCard: { margin: Spacing.lg, borderRadius: Radius.card, padding: Spacing.xl, alignItems: 'center' },
    amtLabel: { color: '#ffffffbb', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    amtInput: { color: '#fff', fontWeight: '800', fontSize: 40, marginTop: Spacing.sm, minWidth: 120, textAlign: 'center' },
    form: { paddingHorizontal: Spacing.lg },
    accChip: { marginBottom: Spacing.sm, borderRadius: Radius.card, padding: Spacing.md },
    modeChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
    input: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, fontSize: 14 },
});


