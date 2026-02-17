import { useCallback, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../api/accountingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { formatCurrency } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';

interface AccountingSnapshot {
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
    netProfit: number;
    outputTax: number;
    inputTax: number;
    netGstPayable: number;
    stockCostValue: number;
    lowStockCount: number;
}

export const AccountingHomeScreen = () => {
    const router = useRouter();
    const theme = useTheme();
    const snapshotQuery = useQuery({
        queryKey: ['accounting-home-snapshot'] as const,
        queryFn: async (): Promise<AccountingSnapshot> => {
            const [trialBalance, pnl, gstSummary, inventoryValuation] = await Promise.all([
                accountingService.getTrialBalance(),
                accountingService.getProfitLoss(),
                accountingService.getGstSummary(),
                accountingService.getInventoryValuation(),
            ]);

            return {
                totalDebit: trialBalance.summary.totalDebit,
                totalCredit: trialBalance.summary.totalCredit,
                isBalanced: trialBalance.summary.isBalanced,
                netProfit: pnl.netProfit,
                outputTax: gstSummary.outputTax,
                inputTax: gstSummary.inputTax,
                netGstPayable: gstSummary.netGstPayable,
                stockCostValue: inventoryValuation.totalCostValue,
                lowStockCount: inventoryValuation.lowStockCount,
            };
        },
        staleTime: 30_000,
    });

    const snapshot = snapshotQuery.data ?? null;
    const loading = snapshotQuery.isFetching && !snapshot;
    const error = useMemo(() => {
        if (!snapshotQuery.error || isNetworkLikeError(snapshotQuery.error)) {
            return null;
        }
        return snapshotQuery.error instanceof Error ? snapshotQuery.error.message : 'Failed to load accounting summary.';
    }, [snapshotQuery.error]);

    useFocusEffect(
        useCallback(() => {
            void snapshotQuery.refetch();
        }, [snapshotQuery])
    );

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}>
                <PageHeaderCard
                    title="Accounting Suite"
                    subtitle="Ledger, GST and financial controls in one place."
                />

                {error ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 12 }}>
                        {error}
                    </Text>
                ) : null}

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Trial Balance Health</Text>
                    <View style={{ marginTop: 8 }}>
                        <Text variant="bodySmall">
                            Total Debit: {snapshot ? formatCurrency(snapshot.totalDebit, 'INR') : '-'}
                        </Text>
                        <Text variant="bodySmall">
                            Total Credit: {snapshot ? formatCurrency(snapshot.totalCredit, 'INR') : '-'}
                        </Text>
                        <Text variant="bodySmall" style={{ color: snapshot?.isBalanced ? theme.colors.primary : theme.colors.error }}>
                            {snapshot ? (snapshot.isBalanced ? 'Balanced' : 'Not Balanced') : '-'}
                        </Text>
                    </View>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>P&L Snapshot</Text>
                    <Text variant="headlineSmall" style={{ marginTop: 8, color: theme.colors.primary }}>
                        {snapshot ? formatCurrency(snapshot.netProfit, 'INR') : '-'}
                    </Text>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Inventory Snapshot</Text>
                    <View style={{ marginTop: 8 }}>
                        <Text variant="bodySmall">
                            Cost Value: {snapshot ? formatCurrency(snapshot.stockCostValue, 'INR') : '-'}
                        </Text>
                        <Text variant="bodySmall">
                            Low Stock Items: {snapshot ? snapshot.lowStockCount : '-'}
                        </Text>
                    </View>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>GST Snapshot</Text>
                    <View style={{ marginTop: 8 }}>
                        <Text variant="bodySmall">Output Tax: {snapshot ? formatCurrency(snapshot.outputTax, 'INR') : '-'}</Text>
                        <Text variant="bodySmall">Input Tax: {snapshot ? formatCurrency(snapshot.inputTax, 'INR') : '-'}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                            Net GST Payable: {snapshot ? formatCurrency(snapshot.netGstPayable, 'INR') : '-'}
                        </Text>
                    </View>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>Actions</Text>
                    <AppButton mode="contained" onPress={() => router.push('/accounting/accounts' as never)}>
                        Manage Accounts
                    </AppButton>
                    <AppButton mode="contained-tonal" onPress={() => router.push('/accounting/journal' as never)}>
                        Post Journal Entry
                    </AppButton>
                    <AppButton mode="outlined" onPress={() => router.push('/accounting/trial-balance' as never)}>
                        View Trial Balance
                    </AppButton>
                    <AppButton mode="outlined" onPress={() => router.push('/accounting/profit-loss' as never)}>
                        View Profit & Loss
                    </AppButton>
                    <AppButton mode="outlined" onPress={() => router.push('/accounting/balance-sheet' as never)}>
                        View Balance Sheet
                    </AppButton>
                    <AppButton mode="outlined" onPress={() => router.push('/accounting/gst' as never)}>
                        View GST Summary
                    </AppButton>
                    <AppButton mode="outlined" onPress={() => router.push('/accounting/inventory' as never)}>
                        Inventory Insights
                    </AppButton>
                    <AppButton mode="text" onPress={() => { void snapshotQuery.refetch(); }} loading={loading}>
                        Refresh
                    </AppButton>
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};
