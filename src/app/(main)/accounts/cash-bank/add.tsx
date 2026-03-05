import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../components/ui/AppInput';
import { useAppDialog } from '@/components/providers/DialogProvider';

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

export default function AddCashBankAccountScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');
    const qc = useQueryClient();
    const { id } = useLocalSearchParams<{ id?: string }>();
    const isEdit = Boolean(id);

    const [kind, setKind] = useState<AccountKind>('CASH');
    const [name, setName] = useState(buildDefaultName('CASH'));
    const [code, setCode] = useState('');

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
        setName(account.name);
        setCode(account.code);
        setKind(inferKind(account.name));
    }, [account]);

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const finalName = name.trim();
            if (!finalName) throw new Error('Account name is required.');

            const generatedCode = code.trim() || `1${Date.now().toString().slice(-5)}`;
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
        setKind(nextKind);
        if (!name.trim() || name === buildDefaultName(kind)) {
            setName(buildDefaultName(nextKind));
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
                    <Pressable style={[s.saveBtn, { borderColor: colors.border }]} onPress={() => mutate()} disabled={isPending}>
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
                        const selected = entry === kind;
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

                <Text style={[s.label, { color: colors.textSecondary }]}>Account Name</Text>
                <AppInput
                    inputType="text"
                    leadingIcon="bank-outline"
                    value={name}
                    onChangeText={setName}
                    placeholder="Account name"
                />

                <Text style={[s.label, { color: colors.textSecondary }]}>Account Code (optional)</Text>
                <AppInput
                    inputType="text"
                    leadingIcon="pound"
                    value={code}
                    onChangeText={setCode}
                    placeholder="Auto-generated if empty"
                />

                <View style={[s.noteBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Text style={[s.note, { color: colors.textSecondary }]}>Account is maintained under Assets and appears in Cash and Bank balances.</Text>
                </View>

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => mutate()} disabled={isPending}>
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
