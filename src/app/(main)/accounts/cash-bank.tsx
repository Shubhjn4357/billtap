import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { cashBankApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import type { Account } from '../../../types/domain';

type CashBankAccount = Account & { kind?: string };

const getKindLabel = (account: CashBankAccount) => {
    const kind = String(account.kind ?? '').toUpperCase();
    if (kind) return kind;
    const name = account.name.toLowerCase();
    if (name.includes('cash')) return 'CASH';
    if (name.includes('bank')) return 'BANK';
    if (name.includes('cheque')) return 'CHEQUE';
    return 'ACCOUNT';
};

export default function CashBankScreen() {
    const scheme = useColorScheme();
    const colors = getColors(scheme);
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['cash-bank-balances'],
        queryFn: () => cashBankApi.getBalances(),
        staleTime: 30_000,
    });

    const accounts = (data?.data ?? []) as CashBankAccount[];
    const totalBalance = accounts.reduce((sum, account) => sum + (account.balance ?? 0), 0);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>Back</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>Cash and Bank</Text>
                <View style={{ width: 48 }} />
            </View>

            <View style={[s.totalCard, { backgroundColor: colors.primary }]}> 
                <Text style={s.totalLabel}>TOTAL BALANCE</Text>
                <Text style={s.totalVal}>Rs {totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>

            <View style={s.actionsRow}>
                {[
                    { label: 'Deposit', route: '/(main)/accounts/cash-bank/deposit', color: colors.success },
                    { label: 'Withdraw', route: '/(main)/accounts/cash-bank/withdraw', color: colors.error },
                    { label: 'Transfer', route: '/(main)/accounts/cash-bank/transfer', color: colors.primary },
                    { label: 'Add Account', route: '/(main)/accounts/cash-bank/add', color: colors.primaryVariant },
                ].map((entry) => (
                    <Pressable key={entry.label} style={[s.actionBtn, { backgroundColor: `${entry.color}22` }]} onPress={() => router.push(entry.route as Parameters<typeof router.push>[0])}>
                        <Text style={[s.actionBtnText, { color: entry.color }]}>{entry.label}</Text>
                    </Pressable>
                ))}
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : accounts.length === 0 ? (
                <View style={s.centered}>
                    <Text style={{ color: colors.textSecondary, marginBottom: Spacing.md }}>No accounts set up yet.</Text>
                    <Pressable style={[s.addAccBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(main)/accounts/cash-bank/add' as Parameters<typeof router.push>[0])}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Add Cash or Bank Account</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={accounts}
                    keyExtractor={(account) => account.id}
                    renderItem={({ item: account }) => (
                        <Pressable
                            style={[s.accountCard, { backgroundColor: colors.card }]}
                            onPress={() => router.push(`/(main)/accounts/cash-bank/${account.id}` as Parameters<typeof router.push>[0])}
                        >
                            <View style={[s.accountIcon, { backgroundColor: `${colors.primary}22` }]}>
                                <Text style={s.accountIconText}>{getKindLabel(account)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.accountName, { color: colors.text }]}>{account.name}</Text>
                                <Text style={[s.accountMeta, { color: colors.textSecondary }]}>{getKindLabel(account)}</Text>
                            </View>
                            <Text style={[s.accountBalance, { color: (account.balance ?? 0) >= 0 ? colors.success : colors.error }]}>
                                Rs {(account.balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </Text>
                        </Pressable>
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
        back: { fontWeight: '600', fontSize: 14 },
        title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
        totalCard: { margin: Spacing.lg, borderRadius: Radius.card, padding: Spacing.xl, alignItems: 'center' },
        totalLabel: { color: '#ffffffbb', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
        totalVal: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 4 },
        actionsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, flexWrap: 'wrap' },
        actionBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
        actionBtnText: { fontWeight: '700', fontSize: 12 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        addAccBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
        accountCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: Spacing.md,
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
            gap: Spacing.md,
        },
        accountIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
        accountIconText: { fontSize: 10, fontWeight: '700' },
        accountName: { fontWeight: '700', fontSize: 14 },
        accountMeta: { fontSize: 11, marginTop: 2 },
        accountBalance: { fontWeight: '700', fontSize: 14 },
    });
