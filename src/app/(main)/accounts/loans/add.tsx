// @ts-nocheck
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, useColorScheme, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loanApi } from '../../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../../constants/theme';
import { format } from 'date-fns';

const loanSchema = z.object({
    loanType: z.enum(['BORROWED', 'LENT']),
    lenderBorrowerName: z.string().min(1, 'Name is required'),
    principalAmount: z.coerce.number().positive('Amount must be positive'),
    interestRatePercent: z.coerce.number().nonnegative().default(0),
    interestType: z.enum(['SIMPLE', 'COMPOUND']).default('SIMPLE'),
    startDate: z.string().default(() => format(new Date(), 'yyyy-MM-dd')),
    dueDate: z.string().optional(),
    description: z.string().optional(),
});
type LoanForm = z.infer<typeof loanSchema>;

export default function AddLoanScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const qc = useQueryClient();
    const s = styles(colors);

    const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<LoanForm>({
        resolver: zodResolver(loanSchema),
        defaultValues: { loanType: 'BORROWED', interestRatePercent: 0, interestType: 'SIMPLE', startDate: format(new Date(), 'yyyy-MM-dd') },
    });

    const { mutate, isPending } = useMutation({
        mutationFn: (data: LoanForm) => loanApi.create({
            loanType: data.loanType,
            lenderBorrowerName: data.lenderBorrowerName,
            principalAmount: data.principalAmount,
            interestRatePercent: data.interestRatePercent,
            interestType: data.interestType,
            startDate: data.startDate,
            dueDate: data.dueDate ?? null,
            description: data.description,
        }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); router.back(); },
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create loan'),
    });

    const loanType = watch('loanType');
    const interestType = watch('interestType');

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Cancel</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>Add Loan</Text>
                <Pressable onPress={handleSubmit((d) => mutate(d))} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.save, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
                {/* Type */}
                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>LOAN TYPE</Text>
                    <View style={s.typeRow}>
                        <Pressable style={[s.typeChip, { backgroundColor: loanType === 'BORROWED' ? colors.error : colors.surfaceVariant }]} onPress={() => setValue('loanType', 'BORROWED')}>
                            <Text style={{ color: loanType === 'BORROWED' ? '#fff' : colors.text, fontWeight: '700' }}>🏛 Borrowed</Text>
                            <Text style={{ color: loanType === 'BORROWED' ? '#ffffffbb' : colors.textSecondary, fontSize: 11 }}>Money you owe</Text>
                        </Pressable>
                        <Pressable style={[s.typeChip, { backgroundColor: loanType === 'LENT' ? colors.success : colors.surfaceVariant }]} onPress={() => setValue('loanType', 'LENT')}>
                            <Text style={{ color: loanType === 'LENT' ? '#fff' : colors.text, fontWeight: '700' }}>💸 Lent Out</Text>
                            <Text style={{ color: loanType === 'LENT' ? '#ffffffbb' : colors.textSecondary, fontSize: 11 }}>Money owed to you</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={s.section}>
                    <Field label={loanType === 'BORROWED' ? 'Lender Name *' : 'Borrower Name *'} error={errors.lenderBorrowerName?.message} colors={colors}>
                        <Controller control={control} name="lenderBorrowerName" render={({ field: { onChange, value } }) => (
                            <TextInput style={inp(colors)} value={value} onChangeText={onChange} placeholder="Name" placeholderTextColor={colors.textSecondary} />
                        )} />
                    </Field>

                    <Field label="Principal Amount (₹) *" error={errors.principalAmount?.message} colors={colors}>
                        <Controller control={control} name="principalAmount" render={({ field: { onChange, value } }) => (
                            <TextInput style={inp(colors)} value={String(value || '')} onChangeText={onChange} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textSecondary} />
                        )} />
                    </Field>

                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                        <View style={{ flex: 1 }}>
                            <Field label="Interest Rate % p.a." colors={colors}>
                                <Controller control={control} name="interestRatePercent" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={String(value || '')} onChangeText={onChange} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSecondary} />
                                )} />
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="Interest Type" colors={colors}>
                                <View style={{ flexDirection: 'row', gap: 4 }}>
                                    {(['SIMPLE', 'COMPOUND'] as const).map((t) => (
                                        <Pressable key={t} style={[s.smallChip, { backgroundColor: interestType === t ? colors.primary : colors.surfaceVariant, flex: 1 }]} onPress={() => setValue('interestType', t)}>
                                            <Text style={{ color: interestType === t ? '#fff' : colors.text, fontSize: 11, fontWeight: '600' }}>{t[0]}{t.slice(1,3).toLowerCase()}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </Field>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                        <View style={{ flex: 1 }}>
                            <Field label="Start Date" colors={colors}>
                                <Controller control={control} name="startDate" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
                                )} />
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="Due Date (optional)" colors={colors}>
                                <Controller control={control} name="dueDate" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
                                )} />
                            </Field>
                        </View>
                    </View>

                    <Field label="Notes (optional)" colors={colors}>
                        <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
                            <TextInput style={[inp(colors), { minHeight: 60 }]} value={value} onChangeText={onChange} placeholder="Purpose of loan…" placeholderTextColor={colors.textSecondary} multiline textAlignVertical="top" />
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
const inp = (c: ColorPalette) => ({ borderWidth: 1, borderColor: c.border, borderRadius: Radius.md, padding: Spacing.md, color: c.text, fontSize: 14 });
const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
    save: { fontWeight: '700', fontSize: 15 },
    section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
    typeRow: { flexDirection: 'row', gap: Spacing.sm },
    typeChip: { flex: 1, borderRadius: Radius.card, padding: Spacing.md, alignItems: 'center', gap: 4 },
    smallChip: { borderRadius: Radius.pill, paddingVertical: 6, alignItems: 'center' },
});


