import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import { accountingService } from '../../api/accountingService';
import { AppAccordion } from '../../components/common/AppAccordion';
import { AppButton } from '../../components/common/AppButton';
import { SummaryCard } from '../../components/common/SummaryCard';
import { DesignSystem } from '../../constants/DesignSystem';
import { formatCurrency } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { AccountingWorkspaceShell } from './components/AccountingWorkspaceShell';
import { useAccountingRange } from './context/AccountingRangeContext';

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
    const { startKey, endKey } = useAccountingRange();

    const snapshotQuery = useQuery({
        queryKey: ['accounting-home-snapshot', startKey ?? 'any', endKey ?? 'any'] as const,
        queryFn: async (): Promise<AccountingSnapshot> => {
            const [trialBalance, pnl, gstSummary, inventoryValuation] = await Promise.all([
                accountingService.getTrialBalance(startKey, endKey),
                accountingService.getProfitLoss(startKey, endKey),
                accountingService.getGstSummary(startKey, endKey),
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
        staleTime: 45_000,
    });

    const snapshot = snapshotQuery.data ?? null;
    const error = useMemo(() => {
        if (!snapshotQuery.error || isNetworkLikeError(snapshotQuery.error)) {
            return null;
        }
        return snapshotQuery.error instanceof Error ? snapshotQuery.error.message : 'Failed to load accounting summary.';
    }, [snapshotQuery.error]);

    return (
        <AccountingWorkspaceShell
            title="Accounting Suite"
            subtitle="Minimal accounting overview with one-tap navigation."
            activeSegment="home"
            refreshing={snapshotQuery.isFetching}
            onRefresh={() => { void snapshotQuery.refetch(); }}
        >
            {error ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                    {error}
                </Text>
            ) : null}

            <View style={styles.summaryRow}>
                <SummaryCard
                    label="Net Profit"
                    value={formatCurrency(snapshot?.netProfit ?? 0, 'INR')}
                    tone={(snapshot?.netProfit ?? 0) >= 0 ? 'positive' : 'negative'}
                />
                <SummaryCard
                    label="GST Payable"
                    value={formatCurrency(snapshot?.netGstPayable ?? 0, 'INR')}
                    tone="warning"
                />
                <SummaryCard
                    label="Stock Cost"
                    value={formatCurrency(snapshot?.stockCostValue ?? 0, 'INR')}
                    tone="neutral"
                />
            </View>

            <AppAccordion title="Core Health" icon="heart-pulse" defaultExpanded>
                <View style={styles.metricRow}>
                    <Text variant="bodySmall">Total Debit</Text>
                    <Text variant="bodySmall">{formatCurrency(snapshot?.totalDebit ?? 0, 'INR')}</Text>
                </View>
                <View style={styles.metricRow}>
                    <Text variant="bodySmall">Total Credit</Text>
                    <Text variant="bodySmall">{formatCurrency(snapshot?.totalCredit ?? 0, 'INR')}</Text>
                </View>
                <View style={styles.metricRow}>
                    <Text variant="bodySmall">Low Stock Items</Text>
                    <Text variant="bodySmall">{snapshot?.lowStockCount ?? 0}</Text>
                </View>
                <Text
                    variant="labelMedium"
                    style={{
                        color: snapshot?.isBalanced ? theme.colors.primary : theme.colors.error,
                        marginTop: 6,
                    }}
                >
                    {snapshot?.isBalanced ? 'Balanced Trial' : 'Unbalanced Trial'}
                </Text>
            </AppAccordion>

            <AppAccordion title="Quick Actions" icon="lightning-bolt-outline" defaultExpanded>
                <View style={styles.actionRow}>
                    <AppButton mode="contained" style={styles.actionButton} onPress={() => router.push('/accounting/accounts' as never)}>
                        Accounts
                    </AppButton>
                    <AppButton mode="contained-tonal" style={styles.actionButton} onPress={() => router.push('/accounting/journal' as never)}>
                        Journal
                    </AppButton>
                    <AppButton mode="outlined" style={styles.actionButton} onPress={() => router.push('/accounting/trial-balance' as never)}>
                        Trial
                    </AppButton>
                    <AppButton mode="outlined" style={styles.actionButton} onPress={() => router.push('/accounting/profit-loss' as never)}>
                        P&L
                    </AppButton>
                    <AppButton mode="outlined" style={styles.actionButton} onPress={() => router.push('/accounting/balance-sheet' as never)}>
                        Balance
                    </AppButton>
                    <AppButton mode="outlined" style={styles.actionButton} onPress={() => router.push('/accounting/gst' as never)}>
                        GST
                    </AppButton>
                    <AppButton mode="outlined" style={styles.actionButton} onPress={() => router.push('/accounting/inventory' as never)}>
                        Inventory
                    </AppButton>
                </View>
            </AppAccordion>
        </AccountingWorkspaceShell>
    );
};

const styles = StyleSheet.create({
    errorText: {
        marginTop: 2,
    },
    summaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: DesignSystem.spacing.xs,
    },
    actionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    actionButton: {
        borderRadius: DesignSystem.radius.pill,
    },
});
