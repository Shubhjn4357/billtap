import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Divider, Text, useTheme } from 'react-native-paper';
import { reportingService } from '../../api/reportingService';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { formatCurrency } from '../../utils/formatters';

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
    const [loading, setLoading] = useState(false);
    const [pnl, setPnl] = useState<PnlSnapshot | null>(null);
    const [balanceSheet, setBalanceSheet] = useState<BalanceSnapshot | null>(null);

    useEffect(() => {
        void loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        try {
            const [pnlData, balanceData] = await Promise.all([
                reportingService.getPnL(),
                reportingService.getBalanceSheet(),
            ]);

            setPnl(pnlData);
            setBalanceSheet(balanceData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

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
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}>
                <PageHeaderCard
                    title="Reporting & Analytics"
                    subtitle="Snapshot of profitability and balance position."
                />

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
        </ScreenWrapper>
    );
};
