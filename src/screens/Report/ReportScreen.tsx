import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Divider, Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { reportingService } from '../../api/reportingService';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { formatCurrency } from '../../utils/formatters';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { isNetworkLikeError } from '../../utils/errorGuards';

type PnlSnapshot = {
    totalSales: number;
    totalPurchases: number;
    netProfit: number;
};

type BalanceSnapshot = {
    assets?: {
        stockValue?: number;
        cashEquivalent?: number;
        totalAssets?: number;
    };
    liabilities?: {
        totalLiabilities?: number;
    };
};

export const ReportScreen = () => {
    const theme = useTheme();
    const { canViewReports } = useOrganizationAccess();
    const reportsQuery = useQuery({
        queryKey: ['reporting-snapshot'] as const,
        queryFn: async (): Promise<{ pnl: PnlSnapshot; balanceSheet: BalanceSnapshot }> => {
            const [pnlData, balanceData] = await Promise.all([
                reportingService.getPnL(),
                reportingService.getBalanceSheet(),
            ]);
            return {
                pnl: {
                    totalSales: pnlData.totalSales,
                    totalPurchases: pnlData.totalPurchases,
                    netProfit: pnlData.netProfit,
                },
                balanceSheet: {
                    assets: {
                        stockValue: balanceData.assets?.stockValue,
                        cashEquivalent: balanceData.assets?.cashEquivalent,
                        totalAssets: balanceData.assets?.totalAssets,
                    },
                    liabilities: {
                        totalLiabilities: balanceData.liabilities?.totalLiabilities,
                    },
                },
            };
        },
        enabled: canViewReports,
        staleTime: 30_000,
    });

    const loading = reportsQuery.isFetching && !reportsQuery.data;
    const pnl = reportsQuery.data?.pnl ?? null;
    const balanceSheet = reportsQuery.data?.balanceSheet ?? null;
    const queryError = useMemo(() => {
        if (!reportsQuery.error || isNetworkLikeError(reportsQuery.error)) {
            return null;
        }
        return reportsQuery.error instanceof Error ? reportsQuery.error.message : 'Failed to load reports.';
    }, [reportsQuery.error]);

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" />
                    <Text style={{ marginTop: 10 }}>Generating reports...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    const totalAssets = balanceSheet?.assets?.totalAssets ?? 0;
    const totalLiabilities = balanceSheet?.liabilities?.totalLiabilities ?? 0;
    const equity = totalAssets - totalLiabilities;

    return (
        <ScreenWrapper>
            {!canViewReports ? (
                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        Reports access is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Ask owner/admin to enable reports permission.
                    </Text>
                </AppCard>
            ) : (
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}>
                <PageHeaderCard
                    title="Reporting & Analytics"
                    subtitle="Snapshot of profitability and balance position."
                />
                {queryError ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
                        {queryError}
                    </Text>
                ) : null}

                {pnl && (
                    <AppCard>
                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                            Profit & Loss
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                            <Text>Total Sales</Text>
                            <Text variant="bodyLarge" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                                {formatCurrency(pnl.totalSales, 'INR')}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                            <Text>Total Purchases</Text>
                            <Text variant="bodyLarge" style={{ color: theme.colors.error, fontWeight: 'bold' }}>
                                {formatCurrency(pnl.totalPurchases, 'INR')}
                            </Text>
                        </View>
                        <Divider style={{ marginVertical: 10 }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text variant="titleMedium">Net Profit</Text>
                            <Text
                                variant="titleMedium"
                                style={{
                                    color: pnl.netProfit >= 0 ? theme.colors.primary : theme.colors.error,
                                    fontWeight: 'bold',
                                }}
                            >
                                {formatCurrency(pnl.netProfit, 'INR')}
                            </Text>
                        </View>
                    </AppCard>
                )}

                {balanceSheet && (
                    <AppCard>
                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                            Balance Sheet (Snapshot)
                        </Text>
                        <Text variant="titleSmall" style={{ marginTop: 12, color: theme.colors.primary }}>
                            Assets
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text>Stock Value</Text>
                            <Text>{formatCurrency(balanceSheet.assets?.stockValue ?? 0, 'INR')}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text>Cash (Est.)</Text>
                            <Text>{formatCurrency(balanceSheet.assets?.cashEquivalent ?? 0, 'INR')}</Text>
                        </View>

                        <Text variant="titleSmall" style={{ marginTop: 15, color: theme.colors.error }}>
                            Liabilities
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text>Accounts Payable</Text>
                            <Text>{formatCurrency(totalLiabilities, 'INR')}</Text>
                        </View>

                        <Divider style={{ marginVertical: 10 }} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text variant="titleMedium">Total Equity</Text>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                                {formatCurrency(equity, 'INR')}
                            </Text>
                        </View>
                    </AppCard>
                )}
            </ScrollView>
            )}
        </ScreenWrapper>
    );
};
