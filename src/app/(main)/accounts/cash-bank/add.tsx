import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../../constants/theme';

type AccountKind = 'CASH' | 'BANK' | 'CHEQUE' | 'OTHER';

type AccountSummary = {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
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
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const qc = useQueryClient();
    const { id } = useLocalSearchParams<{ id?: string }>();
    const isEdit = Boolean(id);

    const [kind, setKind] = useState<AccountKind>('CASH');
    const [name, setName] = useState(buildDefaultName('CASH'));
    const [code, setCode] = useState('');

    const { data: accountsRes, isLoading: accountsLoading } = useQuery({
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
                Alert.alert('Saved', 'Cash/Bank account updated.');
                router.back();
                return;
            }

            const createdId = (res as { data?: { id?: string } })?.data?.id;
            Alert.alert('Saved', 'Cash/Bank account created.');
            if (createdId) {
                router.replace(`/(main)/accounts/cash-bank/${createdId}` as Parameters<typeof router.replace>[0]);
                return;
            }
            router.back();
        },
        onError: (error) => {
            Alert.alert(isEdit ? 'Update failed' : 'Create failed', error instanceof Error ? error.message : 'Unable to save account.');
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
            <SafeAreaView style={s.safe}>
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.headerAction, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>{isEdit ? 'Edit Account' : 'Add Account'}</Text>
                <Pressable onPress={() => mutate()} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.headerAction, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            <View style={s.content}>
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
                                        backgroundColor: selected ? `${colors.primary}22` : colors.surfaceVariant,
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
                <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Account name"
                    placeholderTextColor={colors.textSecondary}
                    style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                />

                <Text style={[s.label, { color: colors.textSecondary }]}>Account Code (optional)</Text>
                <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="Auto-generated if empty"
                    placeholderTextColor={colors.textSecondary}
                    style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                />

                <View style={[s.noteBox, { borderColor: colors.border, backgroundColor: colors.card }]}> 
                    <Text style={[s.note, { color: colors.textSecondary }]}>
                        Account is maintained under Assets and appears in Cash & Bank balances.
                    </Text>
                </View>

                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => mutate()} disabled={isPending}>
                    {isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>{isEdit ? 'Update Account' : 'Create Account'}</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        headerAction: { fontSize: 14, fontWeight: '700' },
        title: { fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
        label: { fontSize: 12, fontWeight: '700', marginBottom: Spacing.xs, marginTop: Spacing.md },
        kindsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
        kindChip: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: 7,
        },
        input: {
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            fontSize: 14,
        },
        noteBox: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginTop: Spacing.lg,
        },
        note: { fontSize: 12, lineHeight: 18 },
        primaryBtn: {
            marginTop: Spacing.lg,
            borderRadius: Radius.pill,
            paddingVertical: Spacing.md,
            alignItems: 'center',
        },
        primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    });
