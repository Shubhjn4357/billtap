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

interface GstSummaryResponse {
    taxableTurnover: number;
    outputTax: number;
    inputTax: number;
    netGstPayable: number;
    byHsn: {
        hsn: string;
        taxableValue: number;
        gstAmount: number;
        quantity: number;
    }[];
}

export const GstSummaryScreen = () => {
    const theme = useTheme();
    const dialog = useAppDialog();
    const { startKey, endKey } = useAccountingRange();

    const gstSummaryQuery = useQuery({
        queryKey: ['accounting-gst-summary', startKey ?? 'any', endKey ?? 'any'] as const,
        queryFn: async (): Promise<GstSummaryResponse> => {
            const response = await accountingService.getGstSummary(startKey, endKey);
            return {
                taxableTurnover: response.taxableTurnover,
                outputTax: response.outputTax,
                inputTax: response.inputTax,
                netGstPayable: response.netGstPayable,
                byHsn: response.byHsn,
            };
        },
        staleTime: 45_000,
    });

    const data = gstSummaryQuery.data ?? null;
    const error = gstSummaryQuery.error && !isNetworkLikeError(gstSummaryQuery.error)
        ? (gstSummaryQuery.error instanceof Error ? gstSummaryQuery.error.message : 'Failed to load GST summary.')
        : null;

    const handleExport = useCallback(async (format: 'csv' | 'json') => {
        if (!data) return;
        try {
            if (format === 'csv') {
                const csv = buildCsv(
                    ['HSN', 'Taxable Value', 'GST Amount', 'Quantity'],
                    data.byHsn.map((row) => [row.hsn, row.taxableValue, row.gstAmount, row.quantity])
                );
                await shareExportContent({
                    title: 'GST Summary',
                    format: 'csv',
                    payload: csv,
                });
                return;
            }

            await shareExportContent({
                title: 'GST Summary',
                format: 'json',
                payload: {
                    taxableTurnover: data.taxableTurnover,
                    outputTax: data.outputTax,
                    inputTax: data.inputTax,
                    netGstPayable: data.netGstPayable,
                    byHsn: data.byHsn,
                },
            });
        } catch (exportError: unknown) {
            dialog.alert('Export', exportError instanceof Error ? exportError.message : 'Failed to export GST summary.');
        }
    }, [data, dialog]);

    return (
        <AccountingWorkspaceShell
            title="GST Summary"
            subtitle="HSN-wise GST view with shared date range."
            activeSegment="gst"
            refreshing={gstSummaryQuery.isFetching}
            onRefresh={() => { void gstSummaryQuery.refetch(); }}
        >
            {error ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                    {error}
                </Text>
            ) : null}

            <View style={styles.summaryRow}>
                <SummaryCard label="Taxable" value={formatCurrency(data?.taxableTurnover ?? 0, 'INR')} tone="neutral" />
                <SummaryCard label="Output Tax" value={formatCurrency(data?.outputTax ?? 0, 'INR')} tone="warning" />
                <SummaryCard label="Net Payable" value={formatCurrency(data?.netGstPayable ?? 0, 'INR')} tone="positive" />
            </View>

            <AppAccordion title={`HSN Breakdown (${data?.byHsn.length ?? 0})`} icon="barcode-scan" defaultExpanded>
                {(data?.byHsn ?? []).map((row) => (
                    <View key={row.hsn} style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.primaryLine}>HSN {row.hsn}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Taxable: {formatCurrency(row.taxableValue, 'INR')}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            GST: {formatCurrency(row.gstAmount, 'INR')} • Qty: {row.quantity}
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
