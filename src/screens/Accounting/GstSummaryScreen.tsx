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

interface GstSummaryResponse {
    taxableTurnover: number;
    outputTax: number;
    inputTax: number;
    netGstPayable: number;
    byHsn: {
        hsn: string;
        taxableValue: number;
        gstAmount: number;
        quantity: number;
    }[];
}

export const GstSummaryScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const start = startDate ? startDate.toISOString().slice(0, 10) : '';
    const end = endDate ? endDate.toISOString().slice(0, 10) : '';
    const gstSummaryQuery = useQuery({
        queryKey: ['accounting-gst-summary', start, end] as const,
        queryFn: async (): Promise<GstSummaryResponse> => {
            const response = await accountingService.getGstSummary(start || undefined, end || undefined);
            return {
                taxableTurnover: response.taxableTurnover,
                outputTax: response.outputTax,
                inputTax: response.inputTax,
                netGstPayable: response.netGstPayable,
                byHsn: response.byHsn,
            };
        },
        enabled: false,
        staleTime: 45_000,
    });
    const { refetch: refetchGstSummary } = gstSummaryQuery;

    const data = gstSummaryQuery.data ?? null;
    const error = gstSummaryQuery.error && !isNetworkLikeError(gstSummaryQuery.error)
        ? (gstSummaryQuery.error instanceof Error ? gstSummaryQuery.error.message : 'Failed to load GST summary.')
        : null;

    const loadData = useCallback(async () => {
        await refetchGstSummary();
    }, [refetchGstSummary]);

    useFocusRefresh(loadData, {
        enabled: gstSummaryQuery.isFetched,
        minIntervalMs: 10_000,
    });

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="GST Summary"
                        subtitle="HSN-wise taxable value and GST position."
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
                        <AppButton mode="contained" onPress={() => { void loadData(); }} loading={gstSummaryQuery.isFetching}>
                            Refresh GST Summary
                        </AppButton>
                    </AppCard>

                    {error ? (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {error}
                        </Text>
                    ) : null}

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Totals</Text>
                        <Text variant="bodySmall">Taxable Turnover: {formatCurrency(data?.taxableTurnover ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall">Output Tax: {formatCurrency(data?.outputTax ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall">Input Tax: {formatCurrency(data?.inputTax ?? 0, 'INR')}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                            Net GST Payable: {formatCurrency(data?.netGstPayable ?? 0, 'INR')}
                        </Text>
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitleWithGap}>
                            HSN Breakdown ({data?.byHsn.length ?? 0})
                        </Text>
                        {(data?.byHsn ?? []).map((row) => (
                            <ScrollView key={row.hsn} horizontal showsHorizontalScrollIndicator={false} style={styles.hsnRow}>
                                <Text variant="bodySmall">
                                    HSN {row.hsn} | Taxable {formatCurrency(row.taxableValue, 'INR')} | GST {formatCurrency(row.gstAmount, 'INR')} | Qty {row.quantity}
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
    hsnRow: {
        marginBottom: DesignSystem.spacing.xs + 2,
    },
});
