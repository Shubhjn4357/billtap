import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, useColorScheme, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseApi } from '../../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../../constants/theme';
import { ExpenseCategory, PaymentMode } from '../../../../constants/enums';
import { format } from 'date-fns';

const expenseSchema = z.object({
    category: z.string().min(1),
    amount: z.coerce.number().positive('Amount must be positive'),
    description: z.string().optional(),
    expenseDate: z.string().default(() => format(new Date(), 'yyyy-MM-dd')),
    paymentMode: z.string().default('CASH'),
    partyName: z.string().optional(),
    gstRate: z.coerce.number().default(0),
    isGstIncluded: z.boolean().default(false),
});
type ExpenseFormInput = z.input<typeof expenseSchema>;
type ExpenseForm = z.output<typeof expenseSchema>;

const CATS = Object.values(ExpenseCategory);
const PAYMENT_MODES = ['CASH', 'BANK', 'UPI', 'CARD'];

export default function AddExpenseScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const qc = useQueryClient();
    const s = styles(colors);

    const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<ExpenseFormInput, unknown, ExpenseForm>({
        resolver: zodResolver(expenseSchema),
        defaultValues: { category: ExpenseCategory.MISCELLANEOUS, expenseDate: format(new Date(), 'yyyy-MM-dd'), paymentMode: 'CASH', amount: 0, gstRate: 0, isGstIncluded: false },
    });

    const { mutate, isPending } = useMutation({
        mutationFn: (data: ExpenseForm) => expenseApi.create({
            category: data.category as ExpenseCategory,
            amount: data.amount,
            description: data.description ?? null,
            date: data.expenseDate,
            expenseDate: data.expenseDate,
            paymentMode: data.paymentMode as PaymentMode,
            accountId: null,
            partyId: null,
            partyName: data.partyName ?? null,
            receiptUrl: null,
            gstRate: data.gstRate,
            isGstIncluded: data.isGstIncluded,
        }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['recent-expenses'] }); router.back(); },
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save expense'),
    });

    const catActive = watch('category');
    const payActive = watch('paymentMode');

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Cancel</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>Add Expense</Text>
                <Pressable onPress={handleSubmit((d) => mutate(d))} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.save, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
                {/* Amount */}
                <View style={[s.amtCard, { backgroundColor: colors.primary }]}>
                    <Text style={s.amtLabel}>AMOUNT (₹)</Text>
                    <Controller control={control} name="amount" render={({ field: { onChange, value } }) => (
                        <TextInput
                            style={s.amtInput}
                            value={String(value || '')}
                            onChangeText={onChange}
                            keyboardType="numeric"
                            placeholder="0.00"
                            placeholderTextColor="#ffffffaa"
                        />
                    )} />
                    {errors.amount && <Text style={{ color: '#ffd0d0', fontSize: 11 }}>{errors.amount.message}</Text>}
                </View>

                <View style={s.form}>
                    {/* Category */}
                    <View style={s.field}>
                        <Text style={[s.label, { color: colors.textSecondary }]}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                                {CATS.map((c) => (
                                    <Pressable key={c} style={[s.chip, { backgroundColor: catActive === c ? colors.primary : colors.surfaceVariant }]} onPress={() => setValue('category', c)}>
                                        <Text style={{ color: catActive === c ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{c.replace(/_/g, ' ')}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>
                    </View>

                    {/* Payment Mode */}
                    <View style={s.field}>
                        <Text style={[s.label, { color: colors.textSecondary }]}>Payment Mode</Text>
                        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                            {PAYMENT_MODES.map((m) => (
                                <Pressable key={m} style={[s.chip, { backgroundColor: payActive === m ? colors.primary : colors.surfaceVariant }]} onPress={() => setValue('paymentMode', m)}>
                                    <Text style={{ color: payActive === m ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{m}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <View style={s.field}>
                        <Text style={[s.label, { color: colors.textSecondary }]}>Date</Text>
                        <Controller control={control} name="expenseDate" render={({ field: { onChange, value } }) => (
                            <TextInput style={[s.input, { color: colors.text, borderColor: colors.border }]} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
                        )} />
                    </View>

                    <View style={s.field}>
                        <Text style={[s.label, { color: colors.textSecondary }]}>Description (optional)</Text>
                        <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
                            <TextInput style={[s.input, s.multiline, { color: colors.text, borderColor: colors.border }]} value={value} onChangeText={onChange} placeholder="Notes…" placeholderTextColor={colors.textSecondary} multiline numberOfLines={2} textAlignVertical="top" />
                        )} />
                    </View>

                    <View style={s.field}>
                        <Text style={[s.label, { color: colors.textSecondary }]}>Paid To (optional)</Text>
                        <Controller control={control} name="partyName" render={({ field: { onChange, value } }) => (
                            <TextInput style={[s.input, { color: colors.text, borderColor: colors.border }]} value={value} onChangeText={onChange} placeholder="Vendor / Party name" placeholderTextColor={colors.textSecondary} />
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
    field: { marginBottom: Spacing.md },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
    chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
    input: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, fontSize: 14 },
    multiline: { minHeight: 60 },
});



