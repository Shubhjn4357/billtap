import { useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountingApi, cashBankApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../../constants/theme';
import type { Account } from '../../../../types/domain';

const formatDate = (value: unknown) => {
    if (!value) return '-';
    try {
        const asDate = new Date(String(value));
        return asDate.toLocaleDateString('en-IN');
    } catch {
        return String(value);
    }
};

const formatAmount = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return `Rs ${parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function CashBankAccountDetailScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const { id } = useLocalSearchParams<{ id: string }>();
    const qc = useQueryClient();

    const { data: balancesRes, isLoading: balancesLoading } = useQuery({
        queryKey: ['cash-bank-balances'],
        queryFn: () => cashBankApi.getBalances(),
        staleTime: 30_000,
    });

    const { data: ledgerRes, isLoading: ledgerLoading } = useQuery({
        queryKey: ['cash-bank-ledger', id],
        queryFn: () => cashBankApi.getLedger(id!, { limit: 200 }),
        enabled: Boolean(id),
        staleTime: 30_000,
    });

    const account = useMemo(() => {
        const list = (balancesRes?.data ?? []) as Account[];
        return list.find((entry) => entry.id === id) ?? null;
    }, [balancesRes?.data, id]);

    const entries = useMemo(() => (ledgerRes?.data ?? []) as Record<string, unknown>[], [ledgerRes?.data]);
    const currentBalance = Number((ledgerRes as any)?.currentBalance ?? account?.balance ?? 0);

    const { mutate: deactivateAccount, isPending: deactivating } = useMutation({
        mutationFn: async () => {
            if (!id) throw new Error('Account ID missing.');
            return accountingApi.deactivateAccount(id);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['cash-bank-balances'] });
            qc.invalidateQueries({ queryKey: ['cash-bank-summary'] });
            qc.invalidateQueries({ queryKey: ['accounting-accounts'] });
            Alert.alert('Deactivated', 'Account moved to inactive state.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        },
        onError: (error) => {
            Alert.alert('Deactivate failed', error instanceof Error ? error.message : 'Unable to deactivate account.');
        },
    });

    const isLoading = balancesLoading || ledgerLoading;

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.headerAction, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title} numberOfLines={1}>
                    {account?.name ?? 'Account'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item, index) => String(item.id ?? `${index}`)}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <>
                            <View style={[s.balanceCard, { backgroundColor: colors.primary }]}>
                                <Text style={s.balanceLabel}>CURRENT BALANCE</Text>
                                <Text style={s.balanceValue}>{formatAmount(currentBalance)}</Text>
                                <Text style={s.balanceMeta}>
                                    {(ledgerRes as any)?.accountKind ?? 'ACCOUNT'} {account?.code ? `- ${account.code}` : ''}
                                </Text>
                            </View>

                            <View style={s.actionRow}>
                                <Pressable
                                    style={[s.actionBtn, { backgroundColor: colors.success }]}
                                    onPress={() => router.push({ pathname: '/(main)/accounts/cash-bank/deposit', params: { accountId: id } })}
                                >
                                    <Text style={s.actionBtnText}>Deposit</Text>
                                </Pressable>
                                <Pressable
                                    style={[s.actionBtn, { backgroundColor: colors.error }]}
                                    onPress={() => router.push({ pathname: '/(main)/accounts/cash-bank/withdraw', params: { accountId: id } })}
                                >
                                    <Text style={s.actionBtnText}>Withdraw</Text>
                                </Pressable>
                                <Pressable
                                    style={[s.actionBtn, { backgroundColor: colors.primaryVariant }]}
                                    onPress={() => router.push({ pathname: '/(main)/accounts/cash-bank/transfer', params: { fromAccountId: id } })}
                                >
                                    <Text style={s.actionBtnText}>Transfer</Text>
                                </Pressable>
                            </View>

                            <View style={s.actionRow}>
                                <Pressable
                                    style={[s.actionBtn, { backgroundColor: colors.surfaceVariant }]}
                                    onPress={() => router.push({ pathname: '/(main)/accounts/cash-bank/add', params: { id } })}
                                >
                                    <Text style={[s.actionBtnText, { color: colors.text }]}>Edit</Text>
                                </Pressable>
                                <Pressable
                                    style={[s.actionBtn, { backgroundColor: `${colors.error}22` }]}
                                    onPress={() => Alert.alert('Deactivate account', 'Hide this account from active balances?', [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Deactivate', style: 'destructive', onPress: () => deactivateAccount() },
                                    ])}
                                    disabled={deactivating || Boolean((account as any)?.isSystem) || Boolean((account as any)?.isDefault)}
                                >
                                    <Text style={[s.actionBtnText, { color: colors.error }]}>
                                        {deactivating ? '...' : 'Deactivate'}
                                    </Text>
                                </Pressable>
                            </View>

                            <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>LEDGER</Text>
                        </>
                    }
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary }}>No entries yet.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.rowTitle, { color: colors.text }]}>
                                    {String(item.voucherType ?? 'ENTRY')} {item.voucherNumber ? `#${item.voucherNumber}` : ''}
                                </Text>
                                <Text style={[s.rowMeta, { color: colors.textSecondary }]}>
                                    {formatDate(item.date)} {item.narration ? `- ${String(item.narration)}` : ''}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[s.rowValue, { color: colors.success }]}>Dr {formatAmount(item.debit)}</Text>
                                <Text style={[s.rowValue, { color: colors.error }]}>Cr {formatAmount(item.credit)}</Text>
                                <Text style={[s.rowMeta, { color: colors.textSecondary }]}>
                                    Bal {formatAmount(item.runningBalance)}
                                </Text>
                            </View>
                        </View>
                    )}
                />
            )}
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
            gap: Spacing.sm,
        },
        headerAction: { fontSize: 14, fontWeight: '700' },
        title: { flex: 1, textAlign: 'center', fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
        centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
        balanceCard: {
            borderRadius: Radius.card,
            padding: Spacing.xl,
            marginBottom: Spacing.md,
        },
        balanceLabel: { color: '#ffffffcc', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
        balanceValue: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 6 },
        balanceMeta: { color: '#ffffffcc', fontSize: 12, marginTop: 6 },
        actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
        actionBtn: { flex: 1, borderRadius: Radius.pill, alignItems: 'center', paddingVertical: Spacing.sm },
        actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
        sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
        row: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            gap: Spacing.sm,
        },
        rowTitle: { fontSize: 13, fontWeight: '700' },
        rowMeta: { fontSize: 11, marginTop: 2 },
        rowValue: { fontSize: 11, fontWeight: '700' },
    });

