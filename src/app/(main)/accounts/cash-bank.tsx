import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { CASH_BANK_QUICK_ACTIONS } from '../../../constants/navigationOptions';
import { Radius, Spacing, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { HubActionCard, HubMetricCard } from '../../../components/ui/HubBlocks';
import { UtilityEmptyState, UtilityHero, UtilitySection } from '../../../components/ui/UtilityBlocks';
import { getCashBankKindLabel, useCashBankAccounts } from '../../../hooks/useCashBankAccounts';

const toUtilityTone = (tone: 'primary' | 'primaryVariant' | 'success' | 'error') => {
    if (tone === 'success') return 'success' as const;
    if (tone === 'error') return 'danger' as const;
    return 'info' as const;
};

export default function CashBankScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');

    const { accounts, totalBalance, stats: accountStats, isLoading, isRefetching, refetch } = useCashBankAccounts();

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Cash and Bank"
                subtitle="Accounts and movements"
                onBackPress={smartBack}
            />

            <View style={s.heroWrap}>
                <UtilityHero
                    title="Cash and Bank Hub"
                    subtitle="Monitor balances, manage ledgers, and move money between cash, bank, and cheque accounts."
                    icon="bank-transfer"
                    tone="info"
                />
            </View>

            <View style={s.statsRow}>
                <HubMetricCard
                    label="Total Balance"
                    value={`Rs ${totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    meta="Across active accounts"
                    tone="info"
                />
                <HubMetricCard label="Accounts" value={String(accountStats.total)} meta="Cash, bank, cheque" tone="default" />
                <HubMetricCard label="Cash" value={String(accountStats.cash)} meta="Cash ledgers" tone="success" />
                <HubMetricCard label="Bank" value={String(accountStats.bank)} meta="Bank ledgers" tone="warning" />
            </View>

            <UtilitySection title="Quick Actions" count={CASH_BANK_QUICK_ACTIONS.length}>
                <View style={s.sectionWrap}>
                    <View style={s.actionsGrid}>
                        {CASH_BANK_QUICK_ACTIONS.map((entry) => (
                            <HubActionCard
                                key={entry.key}
                                title={entry.label}
                                subtitle="Open flow"
                                icon={entry.icon}
                                tone={toUtilityTone(entry.tone)}
                                onPress={() => router.push(entry.route as Parameters<typeof router.push>[0])}
                            />
                        ))}
                    </View>
                </View>
            </UtilitySection>

            <UtilitySection title="Accounts" count={accounts.length}>
                <View style={s.sectionWrap}>
                    {isLoading ? (
                        <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
                    ) : accounts.length === 0 ? (
                        <View style={s.emptyWrap}>
                            <UtilityEmptyState
                                icon="bank-off-outline"
                                title="No accounts yet"
                                description="Add a cash, bank, or cheque account to start recording movement."
                            />
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
                                            name={getCashBankKindLabel(account) === 'BANK' ? 'bank' : getCashBankKindLabel(account) === 'CHEQUE' ? 'checkbook' : 'cash'}
                                            size={18}
                                            color={colors.primary}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.accountName, { color: colors.text }]}>{account.name}</Text>
                                        <Text style={[s.accountMeta, { color: colors.textSecondary }]}>{getCashBankKindLabel(account)}</Text>
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
                </View>
            </UtilitySection>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        heroWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        statsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
        },
        sectionWrap: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
        },
        actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        emptyWrap: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
        addAccBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
        accountCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: Spacing.md,
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
