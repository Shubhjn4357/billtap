import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useQuery } from '@tanstack/react-query';
import { cashBankApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import type { Account } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';

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
    const smartBack = useSmartBack('/(main)/accounts');

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['cash-bank-balances'],
        queryFn: () => cashBankApi.getBalances(),
        staleTime: 30_000,
    });

    const accounts = (data?.data ?? []) as CashBankAccount[];
    const totalBalance = accounts.reduce((sum, account) => sum + (account.balance ?? 0), 0);
    const accountStats = {
        total: accounts.length,
        cash: accounts.filter((entry) => getKindLabel(entry) === 'CASH').length,
        bank: accounts.filter((entry) => getKindLabel(entry) === 'BANK').length,
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Cash and Bank"
                subtitle="Accounts and movements"
                onBackPress={smartBack}
            />

            <View style={[s.totalCard, { backgroundColor: colors.primary }]}>
                <Text style={s.totalLabel}>TOTAL BALANCE</Text>
                <Text style={s.totalVal}>Rs {totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>

            <View style={s.statsRow}>
                <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.statLabel, { color: colors.textSecondary }]}>Accounts</Text>
                    <Text style={[s.statValue, { color: colors.text }]}>{accountStats.total}</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.statLabel, { color: colors.textSecondary }]}>Cash</Text>
                    <Text style={[s.statValue, { color: colors.success }]}>{accountStats.cash}</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.statLabel, { color: colors.textSecondary }]}>Bank</Text>
                    <Text style={[s.statValue, { color: colors.primary }]}>{accountStats.bank}</Text>
                </View>
            </View>

            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Quick Actions</Text>
            <View style={[s.actionsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {[
                    { label: 'Deposit', route: '/(main)/accounts/cash-bank/deposit', color: colors.success, icon: 'bank-transfer-in' },
                    { label: 'Withdraw', route: '/(main)/accounts/cash-bank/withdraw', color: colors.error, icon: 'bank-transfer-out' },
                    { label: 'Transfer', route: '/(main)/accounts/cash-bank/transfer', color: colors.primary, icon: 'swap-horizontal' },
                    { label: 'Add Account', route: '/(main)/accounts/cash-bank/add', color: colors.primaryVariant, icon: 'bank-plus' },
                ].map((entry) => (
                    <Pressable
                        key={entry.label}
                        style={[s.actionBtn, { backgroundColor: withAlpha(entry.color, '16'), borderColor: withAlpha(entry.color, '38') }]}
                        onPress={() => router.push(entry.route as Parameters<typeof router.push>[0])}
                    >
                        <View style={s.actionBtnRow}>
                            <MaterialCommunityIcons name={entry.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={16} color={entry.color} />
                            <Text style={[s.actionBtnText, { color: entry.color }]}>{entry.label}</Text>
                        </View>
                    </Pressable>
                ))}
            </View>

            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Accounts</Text>
            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : accounts.length === 0 ? (
                <View style={s.centered}>
                    <Text style={{ color: colors.textSecondary, marginBottom: Spacing.md }}>No accounts set up yet.</Text>
                    <Pressable style={[s.addAccBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(main)/accounts/cash-bank/add' as Parameters<typeof router.push>[0])}>
                        <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Add Cash or Bank Account</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={accounts}
                    keyExtractor={(account) => account.id}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                refetch();
                            }}
                        />
                    )}
                    renderItem={({ item: account }) => (
                        <Pressable
                            style={[s.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => router.push(`/(main)/accounts/cash-bank/${account.id}` as Parameters<typeof router.push>[0])}
                        >
                            <View style={[s.accountIcon, { backgroundColor: withAlpha(colors.primary, '22') }]}>
                                <MaterialCommunityIcons
                                    name={getKindLabel(account) === 'BANK' ? 'bank' : getKindLabel(account) === 'CHEQUE' ? 'checkbook' : 'cash'}
                                    size={18}
                                    color={colors.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.accountName, { color: colors.text }]}>{account.name}</Text>
                                <Text style={[s.accountMeta, { color: colors.textSecondary }]}>{getKindLabel(account)}</Text>
                            </View>
                            <Text style={[s.accountBalance, { color: (account.balance ?? 0) >= 0 ? colors.success : colors.error }]}>
                                Rs {(account.balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
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
        totalCard: { margin: Spacing.lg, borderRadius: Radius.card, padding: Spacing.xl, alignItems: 'center' },
        totalLabel: { color: withAlpha(colors.onPrimary, 'bb'), fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
        totalVal: { color: colors.onPrimary, fontSize: 30, fontWeight: '800', marginTop: 4 },
        statsRow: {
            flexDirection: 'row',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
        },
        statCard: {
            flex: 1,
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.sm,
        },
        statLabel: { fontSize: Typography.caption.size, fontWeight: '600' },
        statValue: { marginTop: 2, fontSize: Typography.title.size, fontWeight: '800' },
        sectionLabel: {
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.xs,
            fontSize: Typography.caption.size,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
        },
        actionsRow: {
            flexDirection: 'row',
            gap: Spacing.sm,
            padding: Spacing.sm,
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
            flexWrap: 'wrap',
            borderWidth: 1,
            borderRadius: Radius.card,
        },
        actionBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            borderWidth: 1,
        },
        actionBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
            borderWidth: 1,
            gap: Spacing.md,
        },
        accountIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
        accountName: { fontWeight: '700', fontSize: 14 },
        accountMeta: { fontSize: 11, marginTop: 2 },
        accountBalance: { fontWeight: '700', fontSize: 14 },
    });
