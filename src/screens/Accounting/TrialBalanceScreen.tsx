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
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const start = startDate ? startDate.toISOString().slice(0, 10) : '';
    const end = endDate ? endDate.toISOString().slice(0, 10) : '';
    const trialBalanceQuery = useQuery({
        queryKey: ['accounting-trial-balance', start, end] as const,
        queryFn: async (): Promise<TrialBalanceResponse> => {
            const response = await accountingService.getTrialBalance(start || undefined, end || undefined);
            return {
                rows: response.rows,
                summary: response.summary,
            };
        },
        enabled: false,
        staleTime: 45_000,
    });
    const { refetch: refetchTrialBalance } = trialBalanceQuery;

    const data = trialBalanceQuery.data ?? null;
    const error = trialBalanceQuery.error && !isNetworkLikeError(trialBalanceQuery.error)
        ? (trialBalanceQuery.error instanceof Error ? trialBalanceQuery.error.message : 'Failed to load trial balance.')
        : null;

    const loadData = useCallback(async () => {
        await refetchTrialBalance();
    }, [refetchTrialBalance]);

    useFocusRefresh(loadData, {
        enabled: trialBalanceQuery.isFetched,
        minIntervalMs: 10_000,
    });

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<AppRefreshControl refreshing={trialBalanceQuery.isFetching} onRefresh={() => { void loadData(); }} />}
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Trial Balance"
                        subtitle="Verify books are balanced across accounts."
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
                        <AppButton mode="contained" onPress={() => { void loadData(); }} loading={trialBalanceQuery.isFetching}>
                            Refresh Trial Balance
                        </AppButton>
                    </AppCard>

                    {error ? (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {error}
                        </Text>
                    ) : null}

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Summary</Text>
                        <Text variant="bodySmall">Total Debit: {formatCurrency(data?.summary.totalDebit ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall">Total Credit: {formatCurrency(data?.summary.totalCredit ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall" style={{ color: data?.summary.isBalanced ? theme.colors.primary : theme.colors.error }}>
                            {data?.summary.isBalanced ? 'Balanced' : 'Not Balanced'}
                        </Text>
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            Accounts ({data?.rows.length ?? 0})
                        </Text>
                        {(data?.rows ?? []).map((row) => (
                            <ScrollView key={row.accountId} horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
                                <Text variant="bodySmall">
                                    {row.code} | {row.name} | {row.type} | Dr {formatCurrency(row.debit, 'INR')} | Cr {formatCurrency(row.credit, 'INR')} | Bal {formatCurrency(row.balance, 'INR')}
                                </Text>
                            </ScrollView>
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
    rowScroll: {
        marginBottom: DesignSystem.spacing.xs + 2,
    },
});
