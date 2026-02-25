import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import { accountingService } from '../../api/accountingService';
import { AppAccordion } from '../../components/common/AppAccordion';
import { AppButton } from '../../components/common/AppButton';
import { SummaryCard } from '../../components/common/SummaryCard';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { DesignSystem } from '../../constants/DesignSystem';
import { buildCsv, shareExportContent } from '../../utils/accountingExport';
import { formatCurrency } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { AccountingWorkspaceShell } from './components/AccountingWorkspaceShell';
import { useAccountingRange } from './context/AccountingRangeContext';

interface BalanceSheetData {
    assets: {
        rows: { accountId: string; code: string; name: string; balance: number }[];
        totalAssets: number;
    };
    liabilities: {
        rows: { accountId: string; code: string; name: string; balance: number }[];
        totalLiabilities: number;
    };
    equity: {
        rows: { accountId: string; code: string; name: string; balance: number }[];
        retainedEarnings: number;
        totalEquity: number;
    };
    equationDelta: number;
    isBalanced: boolean;
}

export const BalanceSheetScreen = () => {
    const theme = useTheme();
    const dialog = useAppDialog();
    const { startKey, endKey } = useAccountingRange();
    const asOf = endKey ?? startKey;

    const balanceSheetQuery = useQuery({
        queryKey: ['accounting-balance-sheet', asOf ?? 'any'] as const,
        queryFn: async (): Promise<BalanceSheetData> => accountingService.getBalanceSheet(asOf || undefined),
        staleTime: 45_000,
    });

    const data = balanceSheetQuery.data ?? null;
    const error = balanceSheetQuery.error && !isNetworkLikeError(balanceSheetQuery.error)
        ? (balanceSheetQuery.error instanceof Error ? balanceSheetQuery.error.message : 'Failed to load balance sheet.')
        : null;

    const handleExport = useCallback(async (format: 'csv' | 'json') => {
        if (!data) return;
        try {
            if (format === 'csv') {
                const rows = [
                    ...data.assets.rows.map((row) => ['Asset', row.code, row.name, row.balance]),
                    ...data.liabilities.rows.map((row) => ['Liability', row.code, row.name, row.balance]),
                    ...data.equity.rows.map((row) => ['Equity', row.code, row.name, row.balance]),
                    ['Equity', 'RETAINED', 'Retained Earnings', data.equity.retainedEarnings],
                ];
                const csv = buildCsv(['Section', 'Code', 'Account', 'Balance'], rows);
                await shareExportContent({
                    title: 'Balance Sheet',
                    format: 'csv',
                    payload: csv,
                });
                return;
            }

            await shareExportContent({
                title: 'Balance Sheet',
                format: 'json',
                payload: {
                    assets: data.assets,
                    liabilities: data.liabilities,
                    equity: data.equity,
                    equationDelta: data.equationDelta,
                    isBalanced: data.isBalanced,
                },
            });
        } catch (exportError: unknown) {
            dialog.alert('Export', exportError instanceof Error ? exportError.message : 'Failed to export balance sheet.');
        }
    }, [data, dialog]);

    return (
        <AccountingWorkspaceShell
            title="Balance Sheet"
            subtitle="Assets, liabilities, and equity under one shared range."
            activeSegment="balance"
            refreshing={balanceSheetQuery.isFetching}
            onRefresh={() => { void balanceSheetQuery.refetch(); }}
        >
            {error ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                    {error}
                </Text>
            ) : null}

            <View style={styles.summaryRow}>
                <SummaryCard label="Assets" value={formatCurrency(data?.assets.totalAssets ?? 0, 'INR')} tone="positive" />
                <SummaryCard label="Liabilities" value={formatCurrency(data?.liabilities.totalLiabilities ?? 0, 'INR')} tone="warning" />
                <SummaryCard
                    label="Equation"
                    value={data?.isBalanced ? 'Balanced' : 'Mismatch'}
                    tone={data?.isBalanced ? 'positive' : 'negative'}
                />
            </View>

            <AppAccordion title={`Assets (${data?.assets.rows.length ?? 0})`} icon="bank-outline" defaultExpanded>
                {(data?.assets.rows ?? []).map((row) => (
                    <View key={row.accountId} style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.primaryLine}>{row.code} - {row.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {formatCurrency(row.balance, 'INR')}
                        </Text>
                    </View>
                ))}
            </AppAccordion>

            <AppAccordion title={`Liabilities (${data?.liabilities.rows.length ?? 0})`} icon="credit-card-outline" defaultExpanded>
                {(data?.liabilities.rows ?? []).map((row) => (
                    <View key={row.accountId} style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.primaryLine}>{row.code} - {row.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {formatCurrency(row.balance, 'INR')}
                        </Text>
                    </View>
                ))}
            </AppAccordion>

            <AppAccordion title={`Equity (${data?.equity.rows.length ?? 0})`} icon="chart-arc" defaultExpanded>
                <View style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                    <Text variant="bodySmall">Retained Earnings</Text>
                    <Text variant="bodySmall">{formatCurrency(data?.equity.retainedEarnings ?? 0, 'INR')}</Text>
                </View>
                {(data?.equity.rows ?? []).map((row) => (
                    <View key={row.accountId} style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.primaryLine}>{row.code} - {row.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {formatCurrency(row.balance, 'INR')}
                        </Text>
                    </View>
                ))}
                {!data?.isBalanced ? (
                    <Text variant="labelSmall" style={{ color: theme.colors.error, marginTop: 8 }}>
                        Delta: {formatCurrency(data?.equationDelta ?? 0, 'INR')}
                    </Text>
                ) : null}
            </AppAccordion>

            <AppAccordion title="Export" icon="file-export-outline" defaultExpanded={false}>
                <View style={styles.exportRow}>
                    <AppButton mode="contained-tonal" compact onPress={() => { void handleExport('csv'); }}>
                        Export CSV
                    </AppButton>
                    <AppButton mode="outlined" compact onPress={() => { void handleExport('json'); }}>
                        Export JSON
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
    listRow: {
        marginTop: 8,
        borderWidth: 1,
        borderRadius: DesignSystem.radius.sm,
        padding: DesignSystem.spacing.sm,
    },
    primaryLine: {
        fontWeight: '700',
    },
    exportRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
});
