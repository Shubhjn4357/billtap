import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { navigateBackOrReplace, useSmartBack } from '../../../../hooks/useSmartBack';
import { DESIGN_SPACING, getPillStyle } from '../../../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { LoanType } from '../../../../constants/enums';
import { INTEREST_TYPE_OPTIONS, LOAN_TYPE_OPTIONS, type InterestType } from '../../../../constants/formOptions';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { FormHero, FormSectionCard } from '../../../../components/ui/FormBlocks';
import { AppInput } from '../../../../components/ui/AppInput';
import { SelectField } from '../../../../components/ui/SelectField';
import { DateField } from '../../../../components/ui/DateField';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useLoanMutations } from '../../../../hooks/useLoanMutations';

const toAmount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function AddLoanScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');

    const [loanType, setLoanType] = useState<LoanType>(LoanType.BORROWED);
    const [name, setName] = useState('');
    const [principalAmount, setPrincipalAmount] = useState('');
    const [interestRatePercent, setInterestRatePercent] = useState('0');
    const [interestType, setInterestType] = useState<InterestType>('SIMPLE');
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState<string | null>(null);
    const [description, setDescription] = useState('');

    const { saveLoan, isSavingLoan: isPending } = useLoanMutations();

    const handleSave = () => {
        const principal = toAmount(principalAmount);
        const rate = toAmount(interestRatePercent);
        if (!name.trim()) {
            dialog.alert('Error', 'Name is required.');
            return;
        }
        if (principal <= 0) {
            dialog.alert('Error', 'Principal must be positive.');
            return;
        }
        if (rate < 0) {
            dialog.alert('Error', 'Interest rate cannot be negative.');
            return;
        }

        void saveLoan({
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
        })
            .then(() => {
                dialog.alert('Saved', 'Loan created.');
                navigateBackOrReplace('/(main)/accounts/loans');
            })
            .catch((error) => {
                dialog.alert('Error', error instanceof Error ? error.message : 'Failed to create loan');
            });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Add Loan"
                subtitle="Track borrowed or given amount"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={handleSave} disabled={isPending}>
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.primary} />}
                    </Pressable>
                )}
            />

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
                <View style={s.heroWrap}>
                    <FormHero
                        title="Create Loan"
                        subtitle="Set principal, rate, type, and repayment timing for borrowed or given money."
                        icon="hand-coin-outline"
                        tone={loanType === LoanType.BORROWED ? 'warning' : 'success'}
                    />
                </View>

                <FormSectionCard title="Loan Setup" description="Choose the loan direction, counterparty, and principal amount." tone="warning">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Loan Type</Text>
                    <SelectField
                        value={loanType}
                        onChange={(value) => setLoanType(value as LoanType)}
                        options={LOAN_TYPE_OPTIONS}
                        title="Select Loan Type"
                    />

                    <Text style={[s.label, { color: colors.textSecondary }]}>{loanType === 'BORROWED' ? 'Lender Name' : 'Borrower Name'}</Text>
                    <AppInput inputType="name" value={name} onChangeText={setName} placeholder="Name" />

                    <Text style={[s.label, { color: colors.textSecondary }]}>Principal Amount</Text>
                    <AppInput inputType="decimal" value={principalAmount} onChangeText={setPrincipalAmount} placeholder="0.00" />
                </FormSectionCard>

                <FormSectionCard title="Interest and Timeline" description="Define how interest is calculated and when the loan starts or ends." tone="info">
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
                                options={INTEREST_TYPE_OPTIONS}
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
                </FormSectionCard>

                <FormSectionCard title="Notes" description="Optional purpose or internal description for the loan.">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
                    <AppInput inputType="text" value={description} onChangeText={setDescription} placeholder="Purpose" multiline style={s.notesInput} />
                </FormSectionCard>

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={isPending}>
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
