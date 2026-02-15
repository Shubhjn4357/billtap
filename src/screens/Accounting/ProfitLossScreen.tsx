import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Text, useTheme } from 'react-native-paper';
import { accountingService } from '../../api/accountingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { formatCurrency } from '../../utils/formatters';

interface ProfitLossData {
    income: { accountId: string; code: string; name: string; net: number }[];
    expenses: { accountId: string; code: string; name: string; net: number }[];
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
}

export const ProfitLossScreen = () => {
    const theme = useTheme();
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ProfitLossData | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await accountingService.getProfitLoss(start || undefined, end || undefined);
            setData({
                income: response.income,
                expenses: response.expenses,
                totalIncome: response.totalIncome,
                totalExpenses: response.totalExpenses,
                netProfit: response.netProfit,
            });
        } catch (loadError: unknown) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load Profit & Loss.');
        } finally {
            setLoading(false);
        }
    }, [end, start]);

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [loadData])
    );

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}>
                <PageHeaderCard
                    title="Profit & Loss"
                    subtitle="Income versus expense from posted ledgers."
                />

                <AppCard>
                    <AppInput label="Start Date (YYYY-MM-DD)" value={start} onChangeText={setStart} />
                    <AppInput label="End Date (YYYY-MM-DD)" value={end} onChangeText={setEnd} />
                    <AppButton mode="contained" onPress={() => { void loadData(); }} loading={loading}>
                        Refresh Profit & Loss
                    </AppButton>
                </AppCard>

                {error ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
                        {error}
                    </Text>
                ) : null}

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Summary</Text>
                    <Text variant="bodySmall">Total Income: {formatCurrency(data?.totalIncome ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall">Total Expenses: {formatCurrency(data?.totalExpenses ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall" style={{ color: (data?.netProfit ?? 0) >= 0 ? theme.colors.primary : theme.colors.error }}>
                        Net Profit: {formatCurrency(data?.netProfit ?? 0, 'INR')}
                    </Text>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        Income Accounts ({data?.income.length ?? 0})
                    </Text>
                    {(data?.income ?? []).map((row) => (
                        <Text key={row.accountId} variant="bodySmall" style={{ marginBottom: 6 }}>
                            {row.code} | {row.name} | {formatCurrency(row.net, 'INR')}
                        </Text>
                    ))}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        Expense Accounts ({data?.expenses.length ?? 0})
                    </Text>
                    {(data?.expenses ?? []).map((row) => (
                        <Text key={row.accountId} variant="bodySmall" style={{ marginBottom: 6 }}>
                            {row.code} | {row.name} | {formatCurrency(row.net, 'INR')}
                        </Text>
                    ))}
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};
