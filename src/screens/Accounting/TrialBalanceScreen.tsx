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

interface TrialBalanceResponse {
    rows: {
        accountId: string;
        code: string;
        name: string;
        type: string;
        debit: number;
        credit: number;
        balance: number;
    }[];
    summary: {
        totalDebit: number;
        totalCredit: number;
        isBalanced: boolean;
    };
}

export const TrialBalanceScreen = () => {
    const theme = useTheme();
    const dialog = useAppDialog();
    const { startKey, endKey } = useAccountingRange();

    const trialBalanceQuery = useQuery({
        queryKey: ['accounting-trial-balance', startKey ?? 'any', endKey ?? 'any'] as const,
        queryFn: async (): Promise<TrialBalanceResponse> => {
            const response = await accountingService.getTrialBalance(startKey, endKey);
            return {
                rows: response.rows,
                summary: response.summary,
            };
        },
        staleTime: 45_000,
    });

    const data = trialBalanceQuery.data ?? null;
    const error = trialBalanceQuery.error && !isNetworkLikeError(trialBalanceQuery.error)
        ? (trialBalanceQuery.error instanceof Error ? trialBalanceQuery.error.message : 'Failed to load trial balance.')
        : null;

    const handleExport = useCallback(async (format: 'csv' | 'json') => {
        if (!data) return;
        try {
            if (format === 'csv') {
                const csv = buildCsv(
                    ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Balance'],
                    data.rows.map((row) => [row.code, row.name, row.type, row.debit, row.credit, row.balance])
                );
                await shareExportContent({
                    title: 'Trial Balance',
                    format: 'csv',
                    payload: csv,
                });
                return;
            }

            await shareExportContent({
                title: 'Trial Balance',
                format: 'json',
                payload: {
                    summary: data.summary,
                    rows: data.rows,
                },
            });
        } catch (exportError: unknown) {
            dialog.alert('Export', exportError instanceof Error ? exportError.message : 'Failed to export trial balance.');
        }
    }, [data, dialog]);

    return (
        <AccountingWorkspaceShell
            title="Trial Balance"
            subtitle="Single range applied across all ledger balances."
            activeSegment="trial"
            refreshing={trialBalanceQuery.isFetching}
            onRefresh={() => { void trialBalanceQuery.refetch(); }}
        >
            {error ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                    {error}
                </Text>
            ) : null}

            <View style={styles.summaryRow}>
                <SummaryCard label="Debit" value={formatCurrency(data?.summary.totalDebit ?? 0, 'INR')} tone="neutral" />
                <SummaryCard label="Credit" value={formatCurrency(data?.summary.totalCredit ?? 0, 'INR')} tone="neutral" />
                <SummaryCard label="Status" value={data?.summary.isBalanced ? 'Balanced' : 'Mismatch'} tone={data?.summary.isBalanced ? 'positive' : 'negative'} />
            </View>

            <AppAccordion title={`Accounts (${data?.rows.length ?? 0})`} icon="format-list-numbered" defaultExpanded>
                {(data?.rows ?? []).map((row) => (
                    <View key={row.accountId} style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.primaryLine}>{row.code} - {row.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {row.type} • Dr {formatCurrency(row.debit, 'INR')} • Cr {formatCurrency(row.credit, 'INR')}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Balance: {formatCurrency(row.balance, 'INR')}
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
