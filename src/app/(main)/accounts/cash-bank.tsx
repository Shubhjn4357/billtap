// @ts-nocheck
import { View, Text, FlatList, Pressable, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { cashBankApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../constants/theme';
import type { Account } from '../../../types/domain';

export default function CashBankScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['cash-bank-balances'],
        queryFn: () => cashBankApi.getBalances(),
        staleTime: 30_000,
    });

    const accounts = (data?.data ?? []) as Account[];
    const totalBalance = accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Back</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>Cash & Bank</Text>
                <View style={{ width: 48 }} />
            </View>

            {/* Total balance */}
            <View style={[s.totalCard, { backgroundColor: colors.primary }]}>
                <Text style={s.totalLabel}>TOTAL BALANCE</Text>
                <Text style={s.totalVal}>₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>

            {/* Quick actions */}
            <View style={s.actionsRow}>
                {[
                    { label: '+ Deposit', route: '/(main)/accounts/cash-bank/deposit', color: colors.success },
                    { label: '- Withdraw', route: '/(main)/accounts/cash-bank/withdraw', color: colors.error },
                    { label: '↔ Transfer', route: '/(main)/accounts/cash-bank/transfer', color: colors.primary },
                    { label: '+ Account', route: '/(main)/accounts/cash-bank/add', color: colors.primaryVariant },
                ].map((a) => (
                    <Pressable key={a.label} style={[s.actionBtn, { backgroundColor: a.color + '22' }]} onPress={() => router.push(a.route as Parameters<typeof router.push>[0])}>
                        <Text style={[s.actionBtnText, { color: a.color }]}>{a.label}</Text>
                    </Pressable>
                ))}
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : accounts.length === 0 ? (
                <View style={s.centered}>
                    <Text style={{ color: colors.textSecondary, marginBottom: Spacing.md }}>No accounts set up yet.</Text>
                    <Pressable style={[s.addAccBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(main)/accounts/cash-bank/add' as Parameters<typeof router.push>[0])}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Cash/Bank Account</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={accounts}
                    keyExtractor={(a) => a.id}
                    renderItem={({ item: acc }) => <AccountCard account={acc} colors={colors} />}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}
        </SafeAreaView>
    );
}

function AccountCard({ account, colors }: { account: Account; colors: ColorPalette }) {
    const isPositive = (account.balance ?? 0) >= 0;
    return (
        <Pressable
            style={[cardS.card, { backgroundColor: colors.card }]}
            onPress={() => router.push(`/(main)/accounts/cash-bank/${account.id}` as Parameters<typeof router.push>[0])}
        >
            <View style={[cardS.iconBox, { backgroundColor: colors.primary + '22' }]}>
                <Text>{account.type === 'CASH' ? '💵' : account.type === 'BANK' ? '🏦' : '📱'}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[cardS.name, { color: colors.text }]}>{account.name}</Text>
                {account.bankName && <Text style={[cardS.sub, { color: colors.textSecondary }]}>{account.bankName}</Text>}
                {account.accountNumber && <Text style={[cardS.sub, { color: colors.textSecondary }]}>••••{account.accountNumber.slice(-4)}</Text>}
            </View>
            <Text style={[cardS.bal, { color: isPositive ? colors.success : colors.error }]}>
                ₹{(account.balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
        </Pressable>
    );
}

const cardS = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.card, gap: Spacing.md },
    iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    name: { fontWeight: '600', fontSize: 15 },
    sub: { fontSize: 11, marginTop: 2 },
    bal: { fontWeight: '700', fontSize: 16 },
});

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
    totalCard: { margin: Spacing.lg, borderRadius: Radius.card, padding: Spacing.xl, alignItems: 'center' },
    totalLabel: { color: '#ffffffbb', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    totalVal: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 4 },
    actionsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, flexWrap: 'wrap' },
    actionBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    actionBtnText: { fontWeight: '700', fontSize: 13 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    addAccBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
});


