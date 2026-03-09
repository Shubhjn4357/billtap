import { useMemo } from 'react';
import {
    ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import type { Account } from '../../../../types/domain';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { HubMetricCard } from '../../../../components/ui/HubBlocks';
import { UtilityEmptyState, UtilityHero, UtilitySection } from '../../../../components/ui/UtilityBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useCashBankAccounts } from '../../../../hooks/useCashBankAccounts';
import { useCashBankLedger } from '../../../../hooks/useCashBankLedger';
import { useAccountingAccountMutations } from '../../../../hooks/useAccountingMutations';

const formatDate = (value: unknown) => {
    if (!value) return '-';
    const asDate = new Date(String(value));
    return Number.isNaN(asDate.getTime()) ? String(value) : asDate.toLocaleDateString('en-IN');
};

const formatAmount = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return `Rs ${parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function CashBankAccountDetailScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/accounts');
    const { id } = useLocalSearchParams<{ id: string }>();

    const { accounts, isLoading: balancesLoading, isRefetching: balancesRefetching, refetch: refetchBalances } = useCashBankAccounts();
    const {
        entries,
        currentBalance: ledgerBalance,
        isLoading: ledgerLoading,
        isRefetching: ledgerRefetching,
        refetch: refetchLedger,
    } = useCashBankLedger(id);

    const account = useMemo(() => {
        return accounts.find((entry) => entry.id === id) ?? null;
    }, [accounts, id]);

    const currentBalance = Number(ledgerBalance ?? account?.balance ?? 0);
    const { deactivateAccount, isDeactivatingAccount: deactivating } = useAccountingAccountMutations();

    const isLoading = balancesLoading || ledgerLoading;
    const isRefreshing = balancesRefetching || ledgerRefetching;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={account?.name ?? 'Account'}
                subtitle="Cash and bank ledger"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable
                        style={[s.iconBtn, { borderColor: colors.border }]}
                        onPress={() => router.push({ pathname: '/(main)/accounts/cash-bank/add', params: { id } })}
                    >
                        <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
                    </Pressable>
                )}
            />

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item, index) => String(item.id ?? `${index}`)}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefreshing}
                            onRefresh={() => {
                                void Promise.all([refetchBalances(), refetchLedger()]);
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <>
                            <View style={s.heroWrap}>
                                <UtilityHero
                                    title={account?.name ?? 'Account'}
                                    subtitle={account?.code ? `Code ${account.code}` : 'Cash and bank ledger'}
                                    icon="bank-outline"
                                    tone="info"
                                />
                            </View>

                            <View style={s.statsRow}>
                                <HubMetricCard label="Current Balance" value={formatAmount(currentBalance)} meta="Live ledger balance" tone={currentBalance >= 0 ? 'success' : 'danger'} />
                                <HubMetricCard label="Entries" value={String(entries.length)} meta="Visible ledger rows" tone="info" />
                            </View>

                            <UtilitySection title="Quick Actions" count={4}>
                                <View style={s.sectionWrap}>
                                    <View style={s.actionRow}>
                                        <Pressable
                                            style={[s.actionBtn, getSurfaceStyle(colors, { accent: colors.success, elevated: true, muted: true })]}
                                            onPress={() => router.push({ pathname: '/(main)/accounts/cash-bank/deposit', params: { accountId: id } })}
                                        >
                                            <Text style={[s.actionBtnText, { color: colors.success }]}>Deposit</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[s.actionBtn, getSurfaceStyle(colors, { accent: colors.error, elevated: true, muted: true })]}
                                            onPress={() => router.push({ pathname: '/(main)/accounts/cash-bank/withdraw', params: { accountId: id } })}
                                        >
                                            <Text style={[s.actionBtnText, { color: colors.error }]}>Withdraw</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[s.actionBtn, getSurfaceStyle(colors, { accent: colors.primaryVariant, elevated: true, muted: true })]}
                                            onPress={() => router.push({ pathname: '/(main)/accounts/cash-bank/transfer', params: { fromAccountId: id } })}
                                        >
                                            <Text style={[s.actionBtnText, { color: colors.primaryVariant }]}>Transfer</Text>
                                        </Pressable>
                                    </View>

                                    <View style={s.actionRow}>
                                        <Pressable
                                            style={[s.actionBtn, getSurfaceStyle(colors, { accent: colors.error, elevated: true, muted: true })]}
                                            onPress={() => dialog.alert('Deactivate account', 'Hide this account from active balances?', [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Deactivate',
                                                    style: 'destructive',
                                                    onPress: async () => {
                                                        try {
                                                            await deactivateAccount(id);
                                                            dialog.alert('Deactivated', 'Account moved to inactive state.', [
                                                                { text: 'OK', onPress: () => router.back() },
                                                            ]);
                                                        } catch (error) {
                                                            dialog.alert('Deactivate failed', error instanceof Error ? error.message : 'Unable to deactivate account.');
                                                        }
                                                    },
                                                },
                                            ])}
                                            disabled={deactivating || Boolean((account as Account & { isDefault?: boolean })?.isDefault)}
                                        >
                                            <Text style={[s.actionBtnText, { color: colors.error }]}>{deactivating ? '...' : 'Deactivate'}</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </UtilitySection>
                        </>
                    }
                    ListEmptyComponent={
                        <View style={s.emptyWrap}>
                            <UtilityEmptyState icon="book-open-variant" title="No entries yet" description="Deposits, withdrawals, transfers, and linked vouchers will appear here." />
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={s.sectionWrap}>
                            <View style={[s.row, getSurfaceStyle(colors, { elevated: true })]}>
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
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]}>Bal {formatAmount(item.runningBalance)}</Text>
                                </View>
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
        iconBtn: {
            ...getPillStyle(colors),
            width: 34,
            height: 34,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceVariant,
        },
        centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
        heroWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.sm },
        statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: DESIGN_SPACING.screenX, gap: Spacing.sm, marginBottom: Spacing.md },
        sectionWrap: { paddingHorizontal: DESIGN_SPACING.screenX },
        emptyWrap: { paddingHorizontal: DESIGN_SPACING.screenX, paddingVertical: Spacing.xl },
        actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
        actionBtn: { flex: 1, borderRadius: Radius.card, alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm },
        actionBtnText: { fontSize: 12, fontWeight: '700' },
        row: {
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
