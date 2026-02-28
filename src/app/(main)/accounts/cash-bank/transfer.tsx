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

const transferSchema = z.object({
    fromAccountId: z.string().min(1, 'Select source'),
    toAccountId: z.string().min(1, 'Select destination'),
    amount: z.coerce.number().positive('Amount must be positive'),
    description: z.string().optional(),
    date: z.string().default(() => format(new Date(), 'yyyy-MM-dd')),
});
type TransferForm = z.infer<typeof transferSchema>;

export default function TransferScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const qc = useQueryClient();
    const s = styles(colors);

    const { data: accountsData } = useQuery({ queryKey: ['cash-bank-balances'], queryFn: () => cashBankApi.getBalances() });
    const accounts = (accountsData?.data ?? []) as Account[];

    const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<TransferForm>({
        resolver: zodResolver(transferSchema),
        defaultValues: { date: format(new Date(), 'yyyy-MM-dd') },
    });

    const { mutate, isPending } = useMutation({
        mutationFn: (data: TransferForm) => cashBankApi.transfer({ fromAccountId: data.fromAccountId, toAccountId: data.toAccountId, amount: data.amount, description: data.description, date: data.date }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-bank-balances'] }); router.back(); Alert.alert('✅ Transfer recorded'); },
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed'),
    });

    const fromId = watch('fromAccountId');
    const toId = watch('toAccountId');

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Cancel</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>Fund Transfer</Text>
                <Pressable onPress={handleSubmit((d) => mutate(d))} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.save, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
                <View style={[s.amtCard, { backgroundColor: colors.primaryVariant }]}>
                    <Text style={s.amtLabel}>TRANSFER AMOUNT (₹)</Text>
                    <Controller control={control} name="amount" render={({ field: { onChange, value } }) => (
                        <TextInput style={s.amtInput} value={String(value || '')} onChangeText={onChange} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#ffffffaa" />
                    )} />
                    {errors.amount && <Text style={{ color: '#ffd0d0', fontSize: 11 }}>{errors.amount.message}</Text>}
                </View>

                <View style={s.form}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>FROM ACCOUNT</Text>
                    {accounts.map((acc) => (
                        <Pressable key={acc.id} style={[s.accChip, { backgroundColor: fromId === acc.id ? colors.primary : colors.surfaceVariant }]} onPress={() => setValue('fromAccountId', acc.id)}>
                            <Text style={{ color: fromId === acc.id ? '#fff' : colors.text, fontWeight: '600' }}>
                                {acc.type === 'CASH' ? '💵' : '🏦'} {acc.name} — ₹{(acc.balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </Text>
                        </Pressable>
                    ))}
                    {errors.fromAccountId && <Text style={{ color: colors.error, fontSize: 11 }}>{errors.fromAccountId.message}</Text>}

                    <View style={s.arrowRow}>
                        <Text style={[s.arrow, { color: colors.primary }]}>↓ Transfer</Text>
                    </View>

                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>TO ACCOUNT</Text>
                    {accounts.map((acc) => (
                        <Pressable key={acc.id} style={[s.accChip, { backgroundColor: toId === acc.id ? colors.success : colors.surfaceVariant }]} onPress={() => setValue('toAccountId', acc.id)}>
                            <Text style={{ color: toId === acc.id ? '#fff' : colors.text, fontWeight: '600' }}>
                                {acc.type === 'CASH' ? '💵' : '🏦'} {acc.name}
                            </Text>
                        </Pressable>
                    ))}
                    {errors.toAccountId && <Text style={{ color: colors.error, fontSize: 11 }}>{errors.toAccountId.message}</Text>}

                    <View style={{ marginTop: Spacing.md }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Date</Text>
                        <Controller control={control} name="date" render={({ field: { onChange, value } }) => (
                            <TextInput style={[s.input, { color: colors.text, borderColor: colors.border }]} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
                        )} />
                    </View>

                    <View style={{ marginTop: Spacing.md }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Note (optional)</Text>
                        <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
                            <TextInput style={[s.input, { color: colors.text, borderColor: colors.border }]} value={value} onChangeText={onChange} placeholder="Notes…" placeholderTextColor={colors.textSecondary} />
                        )} />
                    </View>
                </View>
                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
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
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
    accChip: { borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.sm },
    arrowRow: { alignItems: 'center', marginVertical: Spacing.md },
    arrow: { fontWeight: '700', fontSize: 18 },
    input: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, fontSize: 14 },
});


