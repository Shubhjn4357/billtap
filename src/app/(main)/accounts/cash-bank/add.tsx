import { useEffect, useMemo } from 'react';
import {
    ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { navigateBackOrReplace, resolveSingleParam, useSmartBack } from '../../../../hooks/useSmartBack';
import { CASH_BANK_ACCOUNT_KIND_OPTIONS, type CashBankAccountKind } from '../../../../constants/accountingInputOptions';
import { DESIGN_SPACING, getInsetPanelStyle, getPillStyle } from '../../../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { ChipButton } from '../../../../components/ui/ChipBlocks';
import { FormHero, FormSectionCard } from '../../../../components/ui/FormBlocks';
import { AppInput } from '../../../../components/ui/AppInput';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useAccountingAccounts } from '../../../../hooks/useAccountingAccounts';
import { useAccountingAccountMutations } from '../../../../hooks/useAccountingMutations';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

type AccountSummary = {
    id: string;
    code: string;
    name: string;
};

const buildDefaultName = (kind: CashBankAccountKind) => {
    if (kind === 'CASH') return 'Cash in Hand';
    if (kind === 'BANK') return 'Bank Account';
    if (kind === 'CHEQUE') return 'Cheque in Hand';
    return 'Business Account';
};

const inferKind = (name: string): CashBankAccountKind => {
    const normalized = name.toLowerCase();
    if (normalized.includes('cash')) return 'CASH';
    if (normalized.includes('bank')) return 'BANK';
    if (normalized.includes('cheque')) return 'CHEQUE';
    return 'OTHER';
};

const getKindTone = (kind: CashBankAccountKind) => {
    if (kind === 'CASH') return 'success' as const;
    if (kind === 'BANK') return 'info' as const;
    if (kind === 'CHEQUE') return 'warning' as const;
    return 'default' as const;
};

const accountSchema = z.object({
    kind: z.enum(['CASH', 'BANK', 'CHEQUE', 'OTHER']),
    name: z.string().min(1, 'Account name is required.'),
    code: z.string().optional(),
});

type AccountFormInput = z.input<typeof accountSchema>;
type AccountForm = z.output<typeof accountSchema>;

export default function AddCashBankAccountScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const params = useLocalSearchParams<{ id?: string | string[]; returnPath?: string | string[] }>();
    const id = resolveSingleParam(params.id);
    const fallbackRoute = resolveSingleParam(params.returnPath) ?? (id ? `/(main)/accounts/cash-bank/${id}` : '/(main)/accounts/cash-bank');
    const smartBack = useSmartBack(fallbackRoute);
    const isEdit = Boolean(id);

    const {
        control,
        handleSubmit,
        formState: { errors },
        watch,
        setValue,
    } = useForm<AccountFormInput, unknown, AccountForm>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            kind: 'CASH',
            name: buildDefaultName('CASH'),
            code: '',
        },
    });

    const currentKind = watch('kind');

    const { accounts, isLoading: accountsLoading, isRefetching, refetch } = useAccountingAccounts({
        includeInactive: true,
        staleTime: 60_000,
    });
    const { saveAccount, isSavingAccount: isPending } = useAccountingAccountMutations();

    const account = useMemo(() => {
        const rows = accounts as AccountSummary[];
        return rows.find((entry) => entry.id === id) ?? null;
    }, [accounts, id]);

    useEffect(() => {
        if (!account) return;
        setValue('name', account.name);
        setValue('code', account.code);
        setValue('kind', inferKind(account.name));
    }, [account, setValue]);

    const handleSave = async (data: AccountForm) => {
        try {
            const finalName = data.name.trim();
            const generatedCode = data.code?.trim() || `1${Date.now().toString().slice(-5)}`;
            const res = await saveAccount({
                ...(isEdit && id ? { id } : {}),
                code: generatedCode,
                name: finalName,
                type: 'ASSET',
                parentId: null,
            });

            if (isEdit) {
                dialog.alert('Saved', 'Cash/Bank account updated.');
                navigateBackOrReplace(fallbackRoute);
                return;
            }

            const createdId = (res as { data?: { id?: string } })?.data?.id;
            dialog.alert('Saved', 'Cash/Bank account created.');
            if (createdId) {
                router.replace(`/(main)/accounts/cash-bank/${createdId}` as Parameters<typeof router.replace>[0]);
                return;
            }
            navigateBackOrReplace(fallbackRoute);
        } catch (error) {
            dialog.alert(isEdit ? 'Update failed' : 'Create failed', error instanceof Error ? error.message : 'Unable to save account.');
        }
    };

    const currentKindMeta = CASH_BANK_ACCOUNT_KIND_OPTIONS.find((entry) => entry.value === currentKind);

    const onKindSelect = (nextKind: CashBankAccountKind) => {
        setValue('kind', nextKind);
        const currentName = watch('name');
        if (!currentName.trim() || currentName === buildDefaultName(currentKind)) {
            setValue('name', buildDefaultName(nextKind));
        }
    };

    if (accountsLoading && isEdit) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={isEdit ? 'Edit Account' : 'Add Account'}
                subtitle="Cash and bank setup"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={isEdit ? 'Save account changes' : 'Save account'}
                        style={[s.saveBtn, { borderColor: colors.border }]}
                        onPress={handleSubmit(handleSave)}
                        disabled={isPending}
                    >
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.primary} />}
                    </Pressable>
                )}
            />

            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefetching}
                        onRefresh={() => {
                            void refetch();
                        }}
                    />
                )}
            >
                <View style={s.heroWrap}>
                    <FormHero
                        title={isEdit ? 'Edit Cash or Bank Account' : 'Create Cash or Bank Account'}
                        subtitle="Define the ledger type, label, and code used by cash, bank, and cheque workflows."
                        icon="bank-plus"
                        tone="info"
                    />
                </View>

                <FormSectionCard title="Account Identity" description="Choose the account kind, display name, and optional code." tone="info">
                    <Text style={[s.label, { color: colors.textSecondary }]}>Account Kind</Text>
                    <View style={s.kindsRow}>
                        {CASH_BANK_ACCOUNT_KIND_OPTIONS.map((entry) => (
                            <ChipButton
                                key={entry.value}
                                label={entry.label}
                                selected={entry.value === currentKind}
                                tone={getKindTone(entry.value)}
                                onPress={() => onKindSelect(entry.value)}
                            />
                        ))}
                    </View>
                    {currentKindMeta ? (
                        <Text style={[s.kindHelp, { color: colors.textSecondary }]}>{currentKindMeta.description}</Text>
                    ) : null}

                    <Controller
                        control={control}
                        name="name"
                        render={({ field: { onChange, value } }) => (
                            <>
                                <Text style={[s.label, { color: colors.textSecondary }]}>Account Name</Text>
                                <AppInput
                                    inputType="text"
                                    leadingIcon="bank-outline"
                                    value={value}
                                    onChangeText={onChange}
                                    placeholder="Account name"
                                    error={errors.name?.message}
                                />
                            </>
                        )}
                    />

                    <Controller
                        control={control}
                        name="code"
                        render={({ field: { onChange, value } }) => (
                            <>
                                <Text style={[s.label, { color: colors.textSecondary }]}>Account Code (optional)</Text>
                                <AppInput
                                    inputType="text"
                                    leadingIcon="pound"
                                    value={value || ''}
                                    onChangeText={onChange}
                                    placeholder="Auto-generated if empty"
                                    error={errors.code?.message}
                                />
                            </>
                        )}
                    />
                </FormSectionCard>

                <FormSectionCard title="Usage Notes" description="Understand how this account behaves in accounting and transfer flows." tone={currentKind === 'CHEQUE' ? 'warning' : 'default'}>
                    <View style={[s.noteBox, getInsetPanelStyle(colors, currentKind === 'CHEQUE' ? colors.warning : undefined)]}>
                        <Text style={[s.note, { color: colors.textSecondary }]}>
                            {currentKind === 'CHEQUE'
                                ? 'Use cheque accounts for received or issued cheques awaiting clearance. Move balances between cheque and bank with deposit or bounce flows.'
                                : 'Account is maintained under Assets and appears in cash and bank balances.'}
                        </Text>
                    </View>
                </FormSectionCard>

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSubmit(handleSave)} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryBtnText}>{isEdit ? 'Update Account' : 'Create Account'}</Text>}
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        saveBtn: {
            ...getPillStyle(colors),
            minHeight: 34,
            minWidth: 56,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.md,
        },
        content: { paddingHorizontal: DESIGN_SPACING.screenX, paddingTop: Spacing.sm, gap: DESIGN_SPACING.cardGap },
        heroWrap: { marginBottom: Spacing.xs },
        label: { fontSize: 12, fontWeight: '700', marginTop: Spacing.sm },
        kindsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
        kindHelp: { fontSize: 12, marginTop: -4 },
        noteBox: {
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginTop: Spacing.sm,
        },
        note: { fontSize: 12, lineHeight: 18 },
        primaryBtn: {
            marginTop: Spacing.md,
            borderRadius: Radius.pill,
            paddingVertical: Spacing.md,
            alignItems: 'center',
        },
        primaryBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
    });
