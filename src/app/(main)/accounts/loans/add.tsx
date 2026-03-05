import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loanApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../../constants/theme';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../components/ui/AppInput';
import { SelectField } from '../../../../components/ui/SelectField';
import { DateField } from '../../../../components/ui/DateField';
import { useAppDialog } from '@/components/providers/DialogProvider';

type LoanType = 'BORROWED' | 'GIVEN';
type InterestType = 'SIMPLE' | 'COMPOUND';

const toAmount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function AddLoanScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const qc = useQueryClient();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');

    const [loanType, setLoanType] = useState<LoanType>('BORROWED');
    const [name, setName] = useState('');
    const [principalAmount, setPrincipalAmount] = useState('');
    const [interestRatePercent, setInterestRatePercent] = useState('0');
    const [interestType, setInterestType] = useState<InterestType>('SIMPLE');
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState<string | null>(null);
    const [description, setDescription] = useState('');

    const { mutate, isPending } = useMutation({
        mutationFn: () => {
            const principal = toAmount(principalAmount);
            const rate = toAmount(interestRatePercent);
            if (!name.trim()) throw new Error('Name is required.');
            if (principal <= 0) throw new Error('Principal must be positive.');
            if (rate < 0) throw new Error('Interest rate cannot be negative.');

            return loanApi.create({
                loanType,
                lenderBorrowerName: name.trim(),
                openingDate: startDate,
                openingBalance: principal,
                interestRatePercent: rate,
                emiAmount: null,
                accountId: null,
                partyId: null,
                dueDate: dueDate || null,
                notes: description.trim() || null,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['loans'] });
            dialog.alert('Saved', 'Loan created.');
            router.back();
        },
        onError: (error) => dialog.alert('Error', error instanceof Error ? error.message : 'Failed to create loan'),
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Add Loan"
                subtitle="Track borrowed or given amount"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={() => mutate()} disabled={isPending}>
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.primary} />}
                    </Pressable>
                )}
            />

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
                <Text style={[s.label, { color: colors.textSecondary }]}>Loan Type</Text>
                <SelectField
                    value={loanType}
                    onChange={(value) => setLoanType(value as LoanType)}
                    options={[
                        { label: 'Borrowed', value: 'BORROWED', description: 'Money you owe' },
                        { label: 'Given', value: 'GIVEN', description: 'Money owed to you' },
                    ]}
                    title="Select Loan Type"
                />

                <Text style={[s.label, { color: colors.textSecondary }]}>{loanType === 'BORROWED' ? 'Lender Name' : 'Borrower Name'}</Text>
                <AppInput inputType="name" value={name} onChangeText={setName} placeholder="Name" />

                <Text style={[s.label, { color: colors.textSecondary }]}>Principal Amount</Text>
                <AppInput inputType="decimal" value={principalAmount} onChangeText={setPrincipalAmount} placeholder="0.00" />

                <View style={s.row}>
                    <View style={s.flex1}>
                        <Text style={[s.label, { color: colors.textSecondary }]}>Interest Rate %</Text>
                        <AppInput inputType="decimal" value={interestRatePercent} onChangeText={setInterestRatePercent} placeholder="0" />
                    </View>
                    <View style={s.flex1}>
                        <Text style={[s.label, { color: colors.textSecondary }]}>Interest Type</Text>
                        <SelectField
                            value={interestType}
                            onChange={(value) => setInterestType(value as InterestType)}
                            options={[
                                { label: 'Simple', value: 'SIMPLE' },
                                { label: 'Compound', value: 'COMPOUND' },
                            ]}
                            title="Select Interest Type"
                        />
                    </View>
                </View>

                <View style={s.row}>
                    <View style={s.flex1}>
                        <Text style={[s.label, { color: colors.textSecondary }]}>Start Date</Text>
                        <DateField value={startDate} onChange={(value) => setStartDate(value ?? startDate)} allowClear={false} />
                    </View>
                    <View style={s.flex1}>
                        <Text style={[s.label, { color: colors.textSecondary }]}>Due Date (optional)</Text>
                        <DateField value={dueDate} onChange={setDueDate} />
                    </View>
                </View>

                <Text style={[s.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
                <AppInput inputType="text" value={description} onChangeText={setDescription} placeholder="Purpose" multiline style={s.notesInput} />

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => mutate()} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryBtnText}>Create Loan</Text>}
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
        label: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs },
        row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
        flex1: { flex: 1 },
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
