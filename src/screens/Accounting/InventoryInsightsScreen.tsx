import { useCallback } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../api/accountingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import { formatCurrency } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { AppRefreshControl } from '../../components/common/AppRefreshControl';

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
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
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
        staleTime: 45_000,
    });
    const { refetch: refetchInventoryInsights } = insightsQuery;

    const data = insightsQuery.data ?? null;
    const error = insightsQuery.error && !isNetworkLikeError(insightsQuery.error)
        ? (insightsQuery.error instanceof Error ? insightsQuery.error.message : 'Failed to load inventory insights.')
        : null;

    const loadData = useCallback(async () => {
        await refetchInventoryInsights();
    }, [refetchInventoryInsights]);

    useFocusRefresh(loadData, { minIntervalMs: 10_000 });

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<AppRefreshControl refreshing={insightsQuery.isFetching} onRefresh={() => { void loadData(); }} />}
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
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
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {error}
                        </Text>
                    ) : null}

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Valuation</Text>
                        <Text variant="bodySmall">Cost Value: {formatCurrency(data?.valuation.totalCostValue ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall">Retail Value: {formatCurrency(data?.valuation.totalRetailValue ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall">Potential Gross Margin: {formatCurrency(data?.valuation.potentialGrossMargin ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall">Low Stock Items: {data?.valuation.lowStockCount ?? 0}</Text>
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            Reorder Suggestions ({data?.reorder.count ?? 0})
                        </Text>
                        {(data?.reorder.suggestions ?? []).map((row) => (
                            <Text key={row.itemId} variant="bodySmall" style={styles.listRow}>
                                {row.name} | Stock {row.stock}/{row.minimumStock} | Order {row.suggestedOrderQty} | Cost {formatCurrency(row.estimatedCost, 'INR')}
                            </Text>
                        ))}
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            Stock Aging Buckets
                        </Text>
                        {(data?.aging.summary ?? []).map((row) => (
                            <Text key={row.bucket} variant="bodySmall" style={styles.listRow}>
                                {row.bucket} days | Items {row.itemCount} | Qty {row.quantity} | Cost {formatCurrency(row.costValue, 'INR')}
                            </Text>
                        ))}
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            Oldest Moving Stock ({data?.aging.rows.length ?? 0})
                        </Text>
                        {(data?.aging.rows ?? []).map((row) => (
                            <Text key={row.itemId} variant="bodySmall" style={styles.listRow}>
                                {row.name} | {row.ageDays} days | {row.stock} {row.unit} | Bucket {row.bucket}
                            </Text>
                        ))}
                    </AppCard>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        gap: DesignSystem.layout.sectionGap,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    errorText: {
        marginBottom: DesignSystem.spacing.sm,
    },
    sectionTitle: {
        fontWeight: '700',
    },
    sectionTitleWithGap: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.xs,
    },
    listRow: {
        marginBottom: DesignSystem.spacing.xs,
    },
});
