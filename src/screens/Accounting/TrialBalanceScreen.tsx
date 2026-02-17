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

interface TrialBalanceResponse {
    rows: {
        accountId: string;
        code: string;
        name: string;
        type: string;
        debit: number;
        credit: number;
        balance: number;
    }[];
    summary: {
        totalDebit: number;
        totalCredit: number;
        isBalanced: boolean;
    };
}

export const TrialBalanceScreen = () => {
    const theme = useTheme();
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const trialBalanceQuery = useQuery({
        queryKey: ['accounting-trial-balance', start.trim(), end.trim()] as const,
        queryFn: async (): Promise<TrialBalanceResponse> => {
            const response = await accountingService.getTrialBalance(start || undefined, end || undefined);
            return {
                rows: response.rows,
                summary: response.summary,
            };
        },
        enabled: false,
        staleTime: 30_000,
    });

    const data = trialBalanceQuery.data ?? null;
    const error = trialBalanceQuery.error && !isNetworkLikeError(trialBalanceQuery.error)
        ? (trialBalanceQuery.error instanceof Error ? trialBalanceQuery.error.message : 'Failed to load trial balance.')
        : null;

    const loadData = useCallback(async () => {
        await trialBalanceQuery.refetch();
    }, [trialBalanceQuery]);

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [loadData])
    );

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}>
                <PageHeaderCard
                    title="Trial Balance"
                    subtitle="Verify books are balanced across accounts."
                />

                <AppCard>
                    <AppInput label="Start Date (YYYY-MM-DD)" value={start} onChangeText={setStart} />
                    <AppInput label="End Date (YYYY-MM-DD)" value={end} onChangeText={setEnd} />
                    <AppButton mode="contained" onPress={() => { void loadData(); }} loading={trialBalanceQuery.isFetching}>
                        Refresh Trial Balance
                    </AppButton>
                </AppCard>

                {error ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
                        {error}
                    </Text>
                ) : null}

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Summary</Text>
                    <Text variant="bodySmall">Total Debit: {formatCurrency(data?.summary.totalDebit ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall">Total Credit: {formatCurrency(data?.summary.totalCredit ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall" style={{ color: data?.summary.isBalanced ? theme.colors.primary : theme.colors.error }}>
                        {data?.summary.isBalanced ? 'Balanced' : 'Not Balanced'}
                    </Text>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        Accounts ({data?.rows.length ?? 0})
                    </Text>
                    {(data?.rows ?? []).map((row) => (
                        <ScrollView key={row.accountId} horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                            <Text variant="bodySmall">
                                {row.code} | {row.name} | {row.type} | Dr {formatCurrency(row.debit, 'INR')} | Cr {formatCurrency(row.credit, 'INR')} | Bal {formatCurrency(row.balance, 'INR')}
                            </Text>
                        </ScrollView>
                    ))}
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};
