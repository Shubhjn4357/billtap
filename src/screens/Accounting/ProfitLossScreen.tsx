import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../api/accountingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppDateField } from '../../components/common/AppDateField';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import { formatCurrency } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { AppRefreshControl } from '../../components/common/AppRefreshControl';

interface ProfitLossData {
    income: { accountId: string; code: string; name: string; net: number }[];
    expenses: { accountId: string; code: string; name: string; net: number }[];
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
}

export const ProfitLossScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const start = startDate ? startDate.toISOString().slice(0, 10) : '';
    const end = endDate ? endDate.toISOString().slice(0, 10) : '';
    const profitLossQuery = useQuery({
        queryKey: ['accounting-profit-loss', start, end] as const,
        queryFn: async (): Promise<ProfitLossData> => {
            const response = await accountingService.getProfitLoss(start || undefined, end || undefined);
            return {
                income: response.income,
                expenses: response.expenses,
                totalIncome: response.totalIncome,
                totalExpenses: response.totalExpenses,
                netProfit: response.netProfit,
            };
        },
        enabled: false,
        staleTime: 45_000,
    });
    const { refetch: refetchProfitLoss } = profitLossQuery;

    const data = profitLossQuery.data ?? null;
    const error = profitLossQuery.error && !isNetworkLikeError(profitLossQuery.error)
        ? (profitLossQuery.error instanceof Error ? profitLossQuery.error.message : 'Failed to load Profit & Loss.')
        : null;

    const loadData = useCallback(async () => {
        await refetchProfitLoss();
    }, [refetchProfitLoss]);

    useFocusRefresh(loadData, {
        enabled: profitLossQuery.isFetched,
        minIntervalMs: 10_000,
    });

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<AppRefreshControl refreshing={profitLossQuery.isFetching} onRefresh={() => { void loadData(); }} />}
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Profit & Loss"
                        subtitle="Income versus expense from posted ledgers."
                    />

                    <AppCard>
                        <AppDateField
                            label="Start Date"
                            value={startDate}
                            onChange={setStartDate}
                            placeholder="Select start date"
                        />
                        <AppDateField
                            label="End Date"
                            value={endDate}
                            onChange={setEndDate}
                            placeholder="Select end date"
                        />
                        <AppButton mode="contained" onPress={() => { void loadData(); }} loading={profitLossQuery.isFetching}>
                            Refresh Profit & Loss
                        </AppButton>
                    </AppCard>

                    {error ? (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {error}
                        </Text>
                    ) : null}

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Summary</Text>
                        <Text variant="bodySmall">Total Income: {formatCurrency(data?.totalIncome ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall">Total Expenses: {formatCurrency(data?.totalExpenses ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall" style={{ color: (data?.netProfit ?? 0) >= 0 ? theme.colors.primary : theme.colors.error }}>
                            Net Profit: {formatCurrency(data?.netProfit ?? 0, 'INR')}
                        </Text>
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            Income Accounts ({data?.income.length ?? 0})
                        </Text>
                        {(data?.income ?? []).map((row) => (
                            <Text key={row.accountId} variant="bodySmall" style={styles.listRow}>
                                {row.code} | {row.name} | {formatCurrency(row.net, 'INR')}
                            </Text>
                        ))}
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            Expense Accounts ({data?.expenses.length ?? 0})
                        </Text>
                        {(data?.expenses ?? []).map((row) => (
                            <Text key={row.accountId} variant="bodySmall" style={styles.listRow}>
                                {row.code} | {row.name} | {formatCurrency(row.net, 'INR')}
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
