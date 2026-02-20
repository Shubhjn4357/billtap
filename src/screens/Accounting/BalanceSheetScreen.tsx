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

interface BalanceSheetData {
    assets: {
        rows: { accountId: string; code: string; name: string; balance: number }[];
        totalAssets: number;
    };
    liabilities: {
        rows: { accountId: string; code: string; name: string; balance: number }[];
        totalLiabilities: number;
    };
    equity: {
        rows: { accountId: string; code: string; name: string; balance: number }[];
        retainedEarnings: number;
        totalEquity: number;
    };
    equationDelta: number;
    isBalanced: boolean;
}

export const BalanceSheetScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const [asOfDate, setAsOfDate] = useState<Date | undefined>(undefined);
    const asOf = asOfDate ? asOfDate.toISOString().slice(0, 10) : '';
    const balanceSheetQuery = useQuery({
        queryKey: ['accounting-balance-sheet', asOf] as const,
        queryFn: async (): Promise<BalanceSheetData> => {
            return await accountingService.getBalanceSheet(asOf || undefined);
        },
        enabled: false,
        staleTime: 45_000,
    });
    const { refetch: refetchBalanceSheet } = balanceSheetQuery;

    const data = balanceSheetQuery.data ?? null;
    const error = balanceSheetQuery.error && !isNetworkLikeError(balanceSheetQuery.error)
        ? (balanceSheetQuery.error instanceof Error ? balanceSheetQuery.error.message : 'Failed to load balance sheet.')
        : null;

    const loadData = useCallback(async () => {
        await refetchBalanceSheet();
    }, [refetchBalanceSheet]);

    useFocusRefresh(loadData, {
        enabled: balanceSheetQuery.isFetched,
        minIntervalMs: 10_000,
    });

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<AppRefreshControl refreshing={balanceSheetQuery.isFetching} onRefresh={() => { void loadData(); }} />}
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Balance Sheet"
                        subtitle="Assets, liabilities and equity as of a selected date."
                    />

                    <AppCard>
                        <AppDateField
                            label="As Of Date"
                            value={asOfDate}
                            onChange={setAsOfDate}
                            placeholder="Today"
                        />
                        <AppButton mode="contained" onPress={() => { void loadData(); }} loading={balanceSheetQuery.isFetching}>
                            Refresh Balance Sheet
                        </AppButton>
                    </AppCard>

                    {error ? (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {error}
                        </Text>
                    ) : null}

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Summary</Text>
                        <Text variant="bodySmall">Total Assets: {formatCurrency(data?.assets.totalAssets ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall">Total Liabilities: {formatCurrency(data?.liabilities.totalLiabilities ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall">Total Equity: {formatCurrency(data?.equity.totalEquity ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall">Retained Earnings: {formatCurrency(data?.equity.retainedEarnings ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall" style={{ color: data?.isBalanced ? theme.colors.primary : theme.colors.error }}>
                            {data?.isBalanced ? 'Equation Balanced' : `Equation Delta: ${formatCurrency(data?.equationDelta ?? 0, 'INR')}`}
                        </Text>
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            Assets ({data?.assets.rows.length ?? 0})
                        </Text>
                        {(data?.assets.rows ?? []).map((row) => (
                            <Text key={row.accountId} variant="bodySmall" style={styles.listRow}>
                                {row.code} | {row.name} | {formatCurrency(row.balance, 'INR')}
                            </Text>
                        ))}
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            Liabilities ({data?.liabilities.rows.length ?? 0})
                        </Text>
                        {(data?.liabilities.rows ?? []).map((row) => (
                            <Text key={row.accountId} variant="bodySmall" style={styles.listRow}>
                                {row.code} | {row.name} | {formatCurrency(row.balance, 'INR')}
                            </Text>
                        ))}
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            Equity ({data?.equity.rows.length ?? 0})
                        </Text>
                        {(data?.equity.rows ?? []).map((row) => (
                            <Text key={row.accountId} variant="bodySmall" style={styles.listRow}>
                                {row.code} | {row.name} | {formatCurrency(row.balance, 'INR')}
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
