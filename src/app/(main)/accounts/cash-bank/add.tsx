import { useEffect, useMemo } from 'react';
import {
    ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../../../../api/endpoints';
import { Radius, Spacing, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../components/ui/AppInput';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

type AccountKind = 'CASH' | 'BANK' | 'CHEQUE' | 'OTHER';

type AccountSummary = {
    id: string;
    code: string;
    name: string;
};

const buildDefaultName = (kind: AccountKind) => {
    if (kind === 'CASH') return 'Cash in Hand';
    if (kind === 'BANK') return 'Bank Account';
    if (kind === 'CHEQUE') return 'Cheque in Hand';
    return 'Business Account';
};

const inferKind = (name: string): AccountKind => {
    const normalized = name.toLowerCase();
    if (normalized.includes('cash')) return 'CASH';
    if (normalized.includes('bank')) return 'BANK';
    if (normalized.includes('cheque')) return 'CHEQUE';
    return 'OTHER';
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
    const smartBack = useSmartBack('/(main)/accounts');
    const qc = useQueryClient();
    const { id } = useLocalSearchParams<{ id?: string }>();
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

    const { data: accountsRes, isLoading: accountsLoading, isRefetching, refetch } = useQuery({
        queryKey: ['accounting-accounts'],
        queryFn: () => accountingApi.getAccounts(),
        staleTime: 60_000,
    });

    const account = useMemo(() => {
        const rows = (accountsRes?.data?.accounts ?? []) as AccountSummary[];
        return rows.find((entry) => entry.id === id) ?? null;
    }, [accountsRes?.data?.accounts, id]);

    useEffect(() => {
        if (!account) return;
        setValue('name', account.name);
        setValue('code', account.code);
        setValue('kind', inferKind(account.name));
    }, [account, setValue]);

    const { mutate, isPending } = useMutation({
        mutationFn: async (data: AccountForm) => {
            const finalName = data.name.trim();
            const generatedCode = data.code?.trim() || `1${Date.now().toString().slice(-5)}`;

            if (isEdit && id) {
                return accountingApi.updateAccount(id, {
                    name: finalName,
                    code: generatedCode,
                });
            }

            return accountingApi.createAccount({
                code: generatedCode,
                name: finalName,
                type: 'ASSET',
                parentId: null,
            });
        },
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['cash-bank-balances'] });
            qc.invalidateQueries({ queryKey: ['cash-bank-summary'] });
            qc.invalidateQueries({ queryKey: ['accounting-accounts'] });

            if (isEdit) {
                dialog.alert('Saved', 'Cash/Bank account updated.');
                router.back();
                return;
            }

            const createdId = (res as { data?: { id?: string } })?.data?.id;
            dialog.alert('Saved', 'Cash/Bank account created.');
            if (createdId) {
                router.replace(`/(main)/accounts/cash-bank/${createdId}` as Parameters<typeof router.replace>[0]);
                return;
            }
            router.back();
        },
        onError: (error) => {
            dialog.alert(isEdit ? 'Update failed' : 'Create failed', error instanceof Error ? error.message : 'Unable to save account.');
        },
    });

    const onKindSelect = (nextKind: AccountKind) => {
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
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={handleSubmit((data) => mutate(data))} disabled={isPending}>
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
                            refetch();
                        }}
                    />
                )}
            >
                <Text style={[s.label, { color: colors.textSecondary }]}>Account Kind</Text>
                <View style={s.kindsRow}>
                    {(['CASH', 'BANK', 'CHEQUE', 'OTHER'] as AccountKind[]).map((entry) => {
                        const selected = entry === currentKind;
                        return (
                            <Pressable
                                key={entry}
                                style={[
                                    s.kindChip,
                                    {
                                        borderColor: selected ? colors.primary : colors.border,
                                        backgroundColor: selected ? withAlpha(colors.primary, '22') : colors.surfaceVariant,
                                    },
                                ]}
                                onPress={() => onKindSelect(entry)}
                            >
                                <Text style={{ color: selected ? colors.primary : colors.text, fontWeight: '700', fontSize: 12 }}>{entry}</Text>
                            </Pressable>
                        );
                    })}
                </View>

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

                <View style={[s.noteBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Text style={[s.note, { color: colors.textSecondary }]}>Account is maintained under Assets and appears in Cash and Bank balances.</Text>
                </View>

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSubmit((data) => mutate(data))} disabled={isPending}>
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
            minHeight: 34,
            minWidth: 56,
            borderWidth: 1,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.md,
        },
        saveText: { fontSize: 12, fontWeight: '700' },
        content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm },
        label: { fontSize: 12, fontWeight: '700', marginTop: Spacing.sm },
        kindsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
        kindChip: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: 7,
        },
        noteBox: {
            borderWidth: 1,
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
