import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import type { StoredBill } from '../../api/billService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Config } from '../../constants/Config';
import { COMMON_TEXT, REPORTS_TEXT } from '../../constants/staticText';
import { useAuth } from '../../hooks/useAuth';
import { useBills } from '../../hooks/useBills';
import { useSettingsStore } from '../../store';
import { toDateSafe } from '../../utils/date';
import { formatCurrency, formatDate, normalizeCurrencyCode } from '../../utils/formatters';
import { shareBillPDF, shareSalesReportPDF } from '../../utils/pdfGenerator';

type RangePreset = 'today' | '7d' | '30d' | 'all';

const RANGE_LABELS: Record<RangePreset, string> = {
    today: REPORTS_TEXT.ranges.today,
    '7d': REPORTS_TEXT.ranges['7d'],
    '30d': REPORTS_TEXT.ranges['30d'],
    all: REPORTS_TEXT.ranges.all,
};

const getRangeStart = (range: RangePreset): Date | null => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (range === 'today') return today;

    if (range === '7d') {
        const sevenDays = new Date(today);
        sevenDays.setDate(today.getDate() - 6);
        return sevenDays;
    }

    if (range === '30d') {
        const thirtyDays = new Date(today);
        thirtyDays.setDate(today.getDate() - 29);
        return thirtyDays;
    }

    return null;
};

const buildTopItems = (bills: StoredBill[]) => {
    const counts = new Map<string, { name: string; qty: number; revenue: number }>();

    for (const bill of bills) {
        for (const line of bill.items) {
            const current = counts.get(line.id) ?? { name: line.name, qty: 0, revenue: 0 };
            current.qty += line.quantity;
            current.revenue += line.quantity * line.price;
            counts.set(line.id, current);
        }
    }

    return [...counts.values()].sort((a, b) => b.revenue - a.revenue);
};

export const ReportsScreen = () => {
    const theme = useTheme();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const { bills, loading, error, fetchBills } = useBills();
    const [range, setRange] = useState<RangePreset>('7d');
    const [refreshing, setRefreshing] = useState(false);

    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);

    const filteredBills = useMemo(() => {
        const start = getRangeStart(range);
        if (!start) return bills;

        return bills.filter((bill) => {
            const createdAt = toDateSafe(bill.createdAt);
            return createdAt ? createdAt >= start : false;
        });
    }, [bills, range]);

    const summary = useMemo(() => {
        const totalRevenue = filteredBills.reduce((sum, bill) => sum + bill.total, 0);
        const totalOrders = filteredBills.length;
        return {
            totalRevenue,
            totalOrders,
            topItems: buildTopItems(filteredBills).slice(0, 5),
        };
    }, [filteredBills]);

    useFocusEffect(
        useCallback(() => {
            void fetchBills();
        }, [fetchBills])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await fetchBills(true);
        } finally {
            setRefreshing(false);
        }
    }, [fetchBills]);

    const handleShareSummary = useCallback(async () => {
        if (filteredBills.length === 0) {
            Alert.alert(COMMON_TEXT.alerts.noData, REPORTS_TEXT.noDataBody);
            return;
        }

        try {
            await shareSalesReportPDF({
                bills: filteredBills,
                rangeLabel: RANGE_LABELS[range],
                totalOrders: summary.totalOrders,
                totalRevenue: summary.totalRevenue,
                currency: activeCurrency,
                topItems: summary.topItems,
            });
        } catch (shareError: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, shareError instanceof Error ? shareError.message : REPORTS_TEXT.shareSummaryFailed);
        }
    }, [activeCurrency, filteredBills, range, summary.topItems, summary.totalOrders, summary.totalRevenue]);

    const handleShareBill = useCallback(async (bill: StoredBill) => {
        try {
            await shareBillPDF({ ...bill, currency: bill.currency ?? activeCurrency });
        } catch (shareError: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, shareError instanceof Error ? shareError.message : REPORTS_TEXT.shareBillFailed);
        }
    }, [activeCurrency]);

    const renderBill = useCallback(({ item }: { item: StoredBill }) => (
        <AppCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
                        Bill #{item.id.slice(0, 8).toUpperCase()}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        {formatDate(item.createdAt)} | {item.items.length} {REPORTS_TEXT.lineItemSuffix}
                    </Text>
                    <Text variant="titleMedium" style={{ marginTop: 8 }}>
                        {formatCurrency(item.total, item.currency ?? activeCurrency)}
                    </Text>
                </View>
                <AppButton
                    mode="text"
                    icon="share-variant"
                    compact
                    onPress={() => { void handleShareBill(item); }}
                >
                    {COMMON_TEXT.actions.share}
                </AppButton>
            </View>
        </AppCard>
    ), [activeCurrency, handleShareBill, theme.colors.outline]);

    return (
        <ScreenWrapper>
            <View style={{ paddingTop: 20, paddingBottom: 10 }}>
                <Text variant="headlineMedium" style={{ fontWeight: 'bold' }}>{REPORTS_TEXT.title}</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
                    {REPORTS_TEXT.subtitle}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                    {REPORTS_TEXT.activeRangePrefix} {RANGE_LABELS[range]}
                </Text>
            </View>

            <SegmentedButtons
                value={range}
                onValueChange={(value) => setRange(value as RangePreset)}
                buttons={[
                    { value: 'today', label: REPORTS_TEXT.rangeButtons.today },
                    { value: '7d', label: REPORTS_TEXT.rangeButtons['7d'] },
                    { value: '30d', label: REPORTS_TEXT.rangeButtons['30d'] },
                    { value: 'all', label: REPORTS_TEXT.rangeButtons.all },
                ]}
                style={{ marginBottom: 12 }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppCard style={{ flex: 1, marginRight: 8 }}>
                    <Text variant="labelMedium" style={{ color: theme.colors.outline }}>{REPORTS_TEXT.metrics.revenue}</Text>
                    <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>
                        {formatCurrency(summary.totalRevenue, activeCurrency)}
                    </Text>
                </AppCard>
                <AppCard style={{ flex: 1, marginLeft: 8 }}>
                    <Text variant="labelMedium" style={{ color: theme.colors.outline }}>{REPORTS_TEXT.metrics.orders}</Text>
                    <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>{summary.totalOrders}</Text>
                </AppCard>
            </View>

            <AppCard>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        <Text variant="labelMedium" style={{ color: theme.colors.outline }}>{REPORTS_TEXT.metrics.topProducts}</Text>
                        {summary.topItems.length === 0 ? (
                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                {REPORTS_TEXT.noProductSales}
                            </Text>
                        ) : (
                            summary.topItems.slice(0, 3).map((entry, index) => (
                                <Text key={`${entry.name}-${index}`} variant="bodySmall">
                                    {entry.name} | {entry.qty} qty | {formatCurrency(entry.revenue, activeCurrency)}
                                </Text>
                            ))
                        )}
                    </View>
                    <AppButton mode="outlined" onPress={() => { void handleShareSummary(); }} compact icon="file-pdf-box">
                        {COMMON_TEXT.actions.share}
                    </AppButton>
                </View>
            </AppCard>

            {error && (
                <Text style={{ color: theme.colors.error, marginBottom: 8 }}>
                    {error}
                </Text>
            )}

            {loading && filteredBills.length === 0 ? (
                <View style={{ marginTop: 24 }}>
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    data={filteredBills}
                    keyExtractor={(item) => item.id}
                    renderItem={renderBill}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} />
                    }
                    contentContainerStyle={{ paddingBottom: 100 }}
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    windowSize={7}
                    removeClippedSubviews
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={(
                        <Text style={{ textAlign: 'center', marginTop: 32 }}>
                            {REPORTS_TEXT.noBillsInRange}
                        </Text>
                    )}
                />
            )}
        </ScreenWrapper>
    );
};
