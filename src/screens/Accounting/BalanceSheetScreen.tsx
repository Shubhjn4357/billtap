import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { accountingService } from '../../api/accountingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { formatCurrency } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';

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
    const [asOf, setAsOf] = useState('');
    const balanceSheetQuery = useQuery({
        queryKey: ['accounting-balance-sheet', asOf.trim()] as const,
        queryFn: async (): Promise<BalanceSheetData> => {
            return await accountingService.getBalanceSheet(asOf || undefined);
        },
        enabled: false,
        staleTime: 30_000,
    });

    const data = balanceSheetQuery.data ?? null;
    const error = balanceSheetQuery.error && !isNetworkLikeError(balanceSheetQuery.error)
        ? (balanceSheetQuery.error instanceof Error ? balanceSheetQuery.error.message : 'Failed to load balance sheet.')
        : null;

    const loadData = useCallback(async () => {
        await balanceSheetQuery.refetch();
    }, [balanceSheetQuery]);

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [loadData])
    );

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}>
                <PageHeaderCard
                    title="Balance Sheet"
                    subtitle="Assets, liabilities and equity as of a selected date."
                />

                <AppCard>
                    <AppInput label="As Of Date (YYYY-MM-DD)" value={asOf} onChangeText={setAsOf} />
                    <AppButton mode="contained" onPress={() => { void loadData(); }} loading={balanceSheetQuery.isFetching}>
                        Refresh Balance Sheet
                    </AppButton>
                </AppCard>

                {error ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
                        {error}
                    </Text>
                ) : null}

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Summary</Text>
                    <Text variant="bodySmall">Total Assets: {formatCurrency(data?.assets.totalAssets ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall">Total Liabilities: {formatCurrency(data?.liabilities.totalLiabilities ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall">Total Equity: {formatCurrency(data?.equity.totalEquity ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall">Retained Earnings: {formatCurrency(data?.equity.retainedEarnings ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall" style={{ color: data?.isBalanced ? theme.colors.primary : theme.colors.error }}>
                        {data?.isBalanced ? 'Equation Balanced' : `Equation Delta: ${formatCurrency(data?.equationDelta ?? 0, 'INR')}`}
                    </Text>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        Assets ({data?.assets.rows.length ?? 0})
                    </Text>
                    {(data?.assets.rows ?? []).map((row) => (
                        <Text key={row.accountId} variant="bodySmall" style={{ marginBottom: 6 }}>
                            {row.code} | {row.name} | {formatCurrency(row.balance, 'INR')}
                        </Text>
                    ))}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        Liabilities ({data?.liabilities.rows.length ?? 0})
                    </Text>
                    {(data?.liabilities.rows ?? []).map((row) => (
                        <Text key={row.accountId} variant="bodySmall" style={{ marginBottom: 6 }}>
                            {row.code} | {row.name} | {formatCurrency(row.balance, 'INR')}
                        </Text>
                    ))}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        Equity ({data?.equity.rows.length ?? 0})
                    </Text>
                    {(data?.equity.rows ?? []).map((row) => (
                        <Text key={row.accountId} variant="bodySmall" style={{ marginBottom: 6 }}>
                            {row.code} | {row.name} | {formatCurrency(row.balance, 'INR')}
                        </Text>
                    ))}
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};
