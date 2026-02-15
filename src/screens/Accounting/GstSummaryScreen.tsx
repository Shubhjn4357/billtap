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
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<GstSummaryResponse | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await accountingService.getGstSummary(start || undefined, end || undefined);
            setData({
                taxableTurnover: response.taxableTurnover,
                outputTax: response.outputTax,
                inputTax: response.inputTax,
                netGstPayable: response.netGstPayable,
                byHsn: response.byHsn,
            });
        } catch (loadError: unknown) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load GST summary.');
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
                    title="GST Summary"
                    subtitle="HSN-wise taxable value and GST position."
                />

                <AppCard>
                    <AppInput label="Start Date (YYYY-MM-DD)" value={start} onChangeText={setStart} />
                    <AppInput label="End Date (YYYY-MM-DD)" value={end} onChangeText={setEnd} />
                    <AppButton mode="contained" onPress={() => { void loadData(); }} loading={loading}>
                        Refresh GST Summary
                    </AppButton>
                </AppCard>

                {error ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
                        {error}
                    </Text>
                ) : null}

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Totals</Text>
                    <Text variant="bodySmall">Taxable Turnover: {formatCurrency(data?.taxableTurnover ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall">Output Tax: {formatCurrency(data?.outputTax ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall">Input Tax: {formatCurrency(data?.inputTax ?? 0, 'INR')}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                        Net GST Payable: {formatCurrency(data?.netGstPayable ?? 0, 'INR')}
                    </Text>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 8 }}>
                        HSN Breakdown ({data?.byHsn.length ?? 0})
                    </Text>
                    {(data?.byHsn ?? []).map((row) => (
                        <ScrollView key={row.hsn} horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                            <Text variant="bodySmall">
                                HSN {row.hsn} | Taxable {formatCurrency(row.taxableValue, 'INR')} | GST {formatCurrency(row.gstAmount, 'INR')} | Qty {row.quantity}
                            </Text>
                        </ScrollView>
                    ))}
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};
