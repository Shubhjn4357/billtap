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

interface ProfitLossData {
    income: { accountId: string; code: string; name: string; net: number }[];
    expenses: { accountId: string; code: string; name: string; net: number }[];
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
}

export const ProfitLossScreen = () => {
    const theme = useTheme();
    const dialog = useAppDialog();
    const { startKey, endKey } = useAccountingRange();

    const profitLossQuery = useQuery({
        queryKey: ['accounting-profit-loss', startKey ?? 'any', endKey ?? 'any'] as const,
        queryFn: async (): Promise<ProfitLossData> => {
            const response = await accountingService.getProfitLoss(startKey, endKey);
            return {
                income: response.income,
                expenses: response.expenses,
                totalIncome: response.totalIncome,
                totalExpenses: response.totalExpenses,
                netProfit: response.netProfit,
            };
        },
        staleTime: 45_000,
    });

    const data = profitLossQuery.data ?? null;
    const error = profitLossQuery.error && !isNetworkLikeError(profitLossQuery.error)
        ? (profitLossQuery.error instanceof Error ? profitLossQuery.error.message : 'Failed to load Profit & Loss.')
        : null;

    const handleExport = useCallback(async (format: 'csv' | 'json') => {
        if (!data) return;
        try {
            if (format === 'csv') {
                const rows = [
                    ...data.income.map((row) => ['Income', row.code, row.name, row.net]),
                    ...data.expenses.map((row) => ['Expense', row.code, row.name, row.net]),
                ];
                const csv = buildCsv(['Section', 'Code', 'Account', 'Net'], rows);
                await shareExportContent({
                    title: 'Profit and Loss',
                    format: 'csv',
                    payload: csv,
                });
                return;
            }

            await shareExportContent({
                title: 'Profit and Loss',
                format: 'json',
                payload: {
                    income: data.income,
                    expenses: data.expenses,
                    totalIncome: data.totalIncome,
                    totalExpenses: data.totalExpenses,
                    netProfit: data.netProfit,
                },
            });
        } catch (exportError: unknown) {
            dialog.alert('Export', exportError instanceof Error ? exportError.message : 'Failed to export profit and loss.');
        }
    }, [data, dialog]);

    return (
        <AccountingWorkspaceShell
            title="Profit & Loss"
            subtitle="Connected date range across income and expense ledgers."
            activeSegment="profit"
            refreshing={profitLossQuery.isFetching}
            onRefresh={() => { void profitLossQuery.refetch(); }}
        >
            {error ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                    {error}
                </Text>
            ) : null}

            <View style={styles.summaryRow}>
                <SummaryCard label="Income" value={formatCurrency(data?.totalIncome ?? 0, 'INR')} tone="positive" />
                <SummaryCard label="Expenses" value={formatCurrency(data?.totalExpenses ?? 0, 'INR')} tone="warning" />
                <SummaryCard
                    label="Net Profit"
                    value={formatCurrency(data?.netProfit ?? 0, 'INR')}
                    tone={(data?.netProfit ?? 0) >= 0 ? 'positive' : 'negative'}
                />
            </View>

            <AppAccordion title={`Income Accounts (${data?.income.length ?? 0})`} icon="cash-plus" defaultExpanded>
                {(data?.income ?? []).map((row) => (
                    <View key={row.accountId} style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.primaryLine}>{row.code} - {row.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Net: {formatCurrency(row.net, 'INR')}
                        </Text>
                    </View>
                ))}
            </AppAccordion>

            <AppAccordion title={`Expense Accounts (${data?.expenses.length ?? 0})`} icon="cash-minus" defaultExpanded>
                {(data?.expenses ?? []).map((row) => (
                    <View key={row.accountId} style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.primaryLine}>{row.code} - {row.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Net: {formatCurrency(row.net, 'INR')}
                        </Text>
                    </View>
                ))}
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
