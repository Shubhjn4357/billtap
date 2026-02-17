import { useCallback } from 'react';
import { ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../api/accountingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { formatCurrency } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';

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
    const insightsQuery = useQuery({
        queryKey: ['accounting-inventory-insights'] as const,
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
        staleTime: 30_000,
    });

    const data = insightsQuery.data ?? null;
    const error = insightsQuery.error && !isNetworkLikeError(insightsQuery.error)
        ? (insightsQuery.error instanceof Error ? insightsQuery.error.message : 'Failed to load inventory insights.')
        : null;

    const loadData = useCallback(async () => {
        await insightsQuery.refetch();
    }, [insightsQuery]);

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [loadData])
    );

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}>
                <PageHeaderCard
                    title="Inventory Insights"
                    subtitle="Valuation, reorder signals and stock-aging view."
                />

                <AppCard>
                    <AppButton mode="contained" onPress={() => { void loadData(); }} loading={insightsQuery.isFetching}>
                        Refresh Inventory Insights
                    </AppButton>
                </AppCard>

                {error ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
                        {error}
                    </Text>
                ) : null}

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Valuation</Text>
                    <Text variant="bodySmall">Cost Value: {formatCurrency(data?.valuation.totalCostValue ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall">Retail Value: {formatCurrency(data?.valuation.totalRetailValue ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall">Potential Gross Margin: {formatCurrency(data?.valuation.potentialGrossMargin ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall">Low Stock Items: {data?.valuation.lowStockCount ?? 0}</Text>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        Reorder Suggestions ({data?.reorder.count ?? 0})
                    </Text>
                    {(data?.reorder.suggestions ?? []).map((row) => (
                        <Text key={row.itemId} variant="bodySmall" style={{ marginBottom: 6 }}>
                            {row.name} | Stock {row.stock}/{row.minimumStock} | Order {row.suggestedOrderQty} | Cost {formatCurrency(row.estimatedCost, 'INR')}
                        </Text>
                    ))}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        Stock Aging Buckets
                    </Text>
                    {(data?.aging.summary ?? []).map((row) => (
                        <Text key={row.bucket} variant="bodySmall" style={{ marginBottom: 6 }}>
                            {row.bucket} days | Items {row.itemCount} | Qty {row.quantity} | Cost {formatCurrency(row.costValue, 'INR')}
                        </Text>
                    ))}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        Oldest Moving Stock ({data?.aging.rows.length ?? 0})
                    </Text>
                    {(data?.aging.rows ?? []).map((row) => (
                        <Text key={row.itemId} variant="bodySmall" style={{ marginBottom: 6 }}>
                            {row.name} | {row.ageDays} days | {row.stock} {row.unit} | Bucket {row.bucket}
                        </Text>
                    ))}
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};
