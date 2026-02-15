
import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator, Divider } from 'react-native-paper';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { reportingService } from '../../api/reportingService';
// import { useUserStore } from '../../store';
// import { COMMON_TEXT } from '../../constants/staticText';
// import axios from 'axios'; 
// import { Config } from '../../constants/Config';

// We'll use simple cards for now instead of complex charts to keep it robust
// If charts are needed, 'react-native-chart-kit' is standard but requires setup

export const ReportScreen = () => {
    const theme = useTheme();
    // const { user } = useUserStore();
    const [loading, setLoading] = useState(false);
    const [pnl, setPnl] = useState<{ totalSales: number; totalPurchases: number; netProfit: number } | null>(null);
    const [balanceSheet, setBalanceSheet] = useState<any>(null);

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        try {
            const [pnlData, balanceData] = await Promise.all([
                reportingService.getPnL(),
                reportingService.getBalanceSheet()
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
                    <Text style={{ marginTop: 10 }}>Generating Reports...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text variant="headlineSmall" style={{ marginBottom: 20 }}>Reporting & Analytics</Text>

                {pnl && (
                    <Card style={{ marginBottom: 20 }}>
                        <Card.Title title="Profit & Loss" />
                        <Card.Content>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                <Text>Total Sales</Text>
                                <Text variant="bodyLarge" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                                    ₹{pnl.totalSales.toLocaleString()}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                <Text>Total Purchases</Text>
                                <Text variant="bodyLarge" style={{ color: theme.colors.error, fontWeight: 'bold' }}>
                                    ₹{pnl.totalPurchases.toLocaleString()}
                                </Text>
                            </View>
                            <Divider style={{ marginVertical: 8 }} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text variant="titleMedium">Net Profit</Text>
                                <Text variant="titleMedium" style={{ color: pnl.netProfit >= 0 ? 'green' : 'red', fontWeight: 'bold' }}>
                                    ₹{pnl.netProfit.toLocaleString()}
                                </Text>
                            </View>
                        </Card.Content>
                    </Card>
                )}

                {balanceSheet && (
                    <Card style={{ marginBottom: 20 }}>
                        <Card.Title title="Balance Sheet (Snapshot)" />
                        <Card.Content>
                            <Text variant="titleSmall" style={{ marginTop: 10, color: theme.colors.primary }}>Assets</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                <Text>Stock Value</Text>
                                <Text>₹{balanceSheet.assets.stockValue?.toLocaleString() || 0}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                <Text>Cash (Est.)</Text>
                                <Text>₹{balanceSheet.assets.cashEquivalent?.toLocaleString() || 0}</Text>
                            </View>

                            <Text variant="titleSmall" style={{ marginTop: 15, color: theme.colors.error }}>Liabilities</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                <Text>Accounts Payable</Text>
                                <Text>₹{balanceSheet.liabilities.totalLiabilities?.toLocaleString() || 0}</Text>
                            </View>

                            <Divider style={{ marginVertical: 10 }} />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text variant="titleMedium">Total Equity</Text>
                                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                                    ₹{((balanceSheet.assets.totalAssets || 0) - (balanceSheet.liabilities.totalLiabilities || 0)).toLocaleString()}
                                </Text>
                            </View>
                        </Card.Content>
                    </Card>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};
