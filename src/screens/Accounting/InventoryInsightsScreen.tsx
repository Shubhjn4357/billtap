import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import { accountingService } from '../../api/accountingService';
import { AppAccordion } from '../../components/common/AppAccordion';
import { SummaryCard } from '../../components/common/SummaryCard';
import { DesignSystem } from '../../constants/DesignSystem';
import { formatCurrency } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { AccountingWorkspaceShell } from './components/AccountingWorkspaceShell';
import { useAccountingRange } from './context/AccountingRangeContext';

interface InventoryInsightsData {
    valuation: {
        totalCostValue: number;
        totalRetailValue: number;
        potentialGrossMargin: number;
        lowStockCount: number;
    };
    reorder: {
        count: number;
        suggestions: {
            itemId: string;
            name: string;
            stock: number;
            minimumStock: number;
            suggestedOrderQty: number;
            estimatedCost: number;
        }[];
    };
    aging: {
        summary: { bucket: string; itemCount: number; quantity: number; costValue: number }[];
        rows: { itemId: string; name: string; ageDays: number; bucket: string; stock: number; unit: string }[];
    };
}

export const InventoryInsightsScreen = () => {
    const theme = useTheme();
    const { startKey, endKey } = useAccountingRange();

    const insightsQuery = useQuery({
        queryKey: ['accounting-inventory-insights', startKey ?? 'any', endKey ?? 'any'] as const,
        queryFn: async (): Promise<InventoryInsightsData> => {
            const [valuation, reorder, aging] = await Promise.all([
                accountingService.getInventoryValuation(),
                accountingService.getReorderSuggestions(),
                accountingService.getStockAging(),
            ]);

            return {
                valuation: {
                    totalCostValue: valuation.totalCostValue,
                    totalRetailValue: valuation.totalRetailValue,
                    potentialGrossMargin: valuation.potentialGrossMargin,
                    lowStockCount: valuation.lowStockCount,
                },
                reorder: {
                    count: reorder.count,
                    suggestions: reorder.suggestions.slice(0, 20),
                },
                aging: {
                    summary: aging.summary,
                    rows: aging.rows.slice(0, 20).map((row) => ({
                        itemId: row.itemId,
                        name: row.name,
                        ageDays: row.ageDays,
                        bucket: row.bucket,
                        stock: row.stock,
                        unit: row.unit,
                    })),
                },
            };
        },
        staleTime: 45_000,
    });

    const data = insightsQuery.data ?? null;
    const error = insightsQuery.error && !isNetworkLikeError(insightsQuery.error)
        ? (insightsQuery.error instanceof Error ? insightsQuery.error.message : 'Failed to load inventory insights.')
        : null;

    return (
        <AccountingWorkspaceShell
            title="Inventory Insights"
            subtitle="Stock value, reorder alerts and aging in one compact view."
            activeSegment="inventory"
            refreshing={insightsQuery.isFetching}
            onRefresh={() => { void insightsQuery.refetch(); }}
        >
            {error ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                    {error}
                </Text>
            ) : null}

            <View style={styles.summaryRow}>
                <SummaryCard label="Cost Value" value={formatCurrency(data?.valuation.totalCostValue ?? 0, 'INR')} tone="neutral" />
                <SummaryCard label="Retail Value" value={formatCurrency(data?.valuation.totalRetailValue ?? 0, 'INR')} tone="positive" />
                <SummaryCard label="Low Stock" value={String(data?.valuation.lowStockCount ?? 0)} tone="warning" />
            </View>

            <AppAccordion title={`Reorder Suggestions (${data?.reorder.count ?? 0})`} icon="truck-fast-outline" defaultExpanded>
                {(data?.reorder.suggestions ?? []).map((row) => (
                    <View key={row.itemId} style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.primaryLine}>{row.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Stock {row.stock}/{row.minimumStock} • Order {row.suggestedOrderQty}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Est. Cost {formatCurrency(row.estimatedCost, 'INR')}
                        </Text>
                    </View>
                ))}
            </AppAccordion>

            <AppAccordion title="Aging Buckets" icon="clock-time-eight-outline" defaultExpanded>
                {(data?.aging.summary ?? []).map((row) => (
                    <View key={row.bucket} style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.primaryLine}>{row.bucket} days</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Items {row.itemCount} • Qty {row.quantity}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Cost {formatCurrency(row.costValue, 'INR')}
                        </Text>
                    </View>
                ))}
            </AppAccordion>

            <AppAccordion title={`Oldest Stock (${data?.aging.rows.length ?? 0})`} icon="calendar-clock-outline">
                {(data?.aging.rows ?? []).map((row) => (
                    <View key={row.itemId} style={[styles.listRow, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodyMedium" style={styles.primaryLine}>{row.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {row.ageDays} days • {row.stock} {row.unit}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Bucket {row.bucket}
                        </Text>
                    </View>
                ))}
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
});
