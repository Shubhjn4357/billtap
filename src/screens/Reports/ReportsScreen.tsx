import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StoredBill } from '../../api/billService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { Config } from '../../constants/Config';
import { COMMON_TEXT, REPORTS_TEXT } from '../../constants/staticText';
import { useAuth } from '../../hooks/useAuth';
import { useBills } from '../../hooks/useBills';
import { reportingService } from '../../api/reportingService';
import { useSettingsStore } from '../../store';
import { toDateSafe } from '../../utils/date';
import { formatCurrency, formatDate, normalizeCurrencyCode } from '../../utils/formatters';
import { shareBillPDF, shareSalesReportPDF } from '../../utils/pdfGenerator';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';

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
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const { canViewReports, canAccessSettings } = useOrganizationAccess();
    const { bills, loading, error, fetchBills } = useBills(canViewReports);
    const [range, setRange] = useState<RangePreset>('7d');
    const [refreshing, setRefreshing] = useState(false);
    const bottomSpacing = getTabAwareBottomSpacing(insets.bottom, 24);

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
            if (!canViewReports) return;
            void fetchBills();
        }, [canViewReports, fetchBills])
    );

    const onRefresh = useCallback(async () => {
        if (!canViewReports) return;
        setRefreshing(true);
        try {
            await fetchBills(true);
        } finally {
            setRefreshing(false);
        }
    }, [canViewReports, fetchBills]);

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

    const handleExportJson = useCallback(async () => {
        try {
            const start = getRangeStart(range);
            const exportPayload = await reportingService.exportTransactions('json', {
                type: 'SALE',
                start: start ? start.toISOString() : undefined,
            });

            await Share.share({
                title: 'BillTap Transactions JSON Export',
                message: JSON.stringify(exportPayload, null, 2),
            });
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to export JSON.');
        }
    }, [range]);

    const handleExportExcel = useCallback(async () => {
        try {
            const start = getRangeStart(range);
            const csvText = await reportingService.exportTransactions('csv', {
                type: 'SALE',
                start: start ? start.toISOString() : undefined,
            });

            await Share.share({
                title: 'BillTap Transactions CSV Export',
                message: typeof csvText === 'string' ? csvText : JSON.stringify(csvText),
            });
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to export CSV.');
        }
    }, [range]);

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
            {!canViewReports ? (
                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        Reports access is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Ask owner/admin to enable reports permission for your account.
                    </Text>
                </AppCard>
            ) : (
            <>
            <AppCard style={{ backgroundColor: theme.colors.primaryContainer }}>
                <Text variant="headlineSmall" style={{ fontWeight: '800', color: theme.colors.onPrimaryContainer }}>
                    {REPORTS_TEXT.title}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                    {REPORTS_TEXT.subtitle}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>
                    {REPORTS_TEXT.activeRangePrefix} {RANGE_LABELS[range]}
                </Text>
            </AppCard>

            <SegmentedButtons
                value={range}
                onValueChange={(value) => setRange(value as RangePreset)}
                buttons={[
                    { value: 'today', label: REPORTS_TEXT.rangeButtons.today },
                    { value: '7d', label: REPORTS_TEXT.rangeButtons['7d'] },
                    { value: '30d', label: REPORTS_TEXT.rangeButtons['30d'] },
                    { value: 'all', label: REPORTS_TEXT.rangeButtons.all },
                ]}
                style={styles.rangeSelector}
            />

            <View style={styles.metricRow}>
                <AppCard style={[styles.metricCard, styles.metricCardLeft]}>
                    <Text variant="labelMedium" style={{ color: theme.colors.outline }}>{REPORTS_TEXT.metrics.revenue}</Text>
                    <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>
                        {formatCurrency(summary.totalRevenue, activeCurrency)}
                    </Text>
                </AppCard>
                <AppCard style={styles.metricCard}>
                    <Text variant="labelMedium" style={{ color: theme.colors.outline }}>{REPORTS_TEXT.metrics.orders}</Text>
                    <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>{summary.totalOrders}</Text>
                </AppCard>
            </View>

            <AppCard>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                            Accounting Suite
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            Trial balance, GST summary and journal entries.
                        </Text>
                    </View>
                    <AppButton
                        mode="contained-tonal"
                        onPress={() => router.push('/accounting' as never)}
                        disabled={!canAccessSettings}
                    >
                        Open
                    </AppButton>
                </View>
            </AppCard>

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
                                <View key={`${entry.name}-${index}`} style={styles.topItemRow}>
                                    <Text variant="bodySmall" style={styles.topItemRank}>
                                        #{index + 1}
                                    </Text>
                                    <Text variant="bodySmall" style={styles.topItemText}>
                                        {entry.name} | {entry.qty} qty | {formatCurrency(entry.revenue, activeCurrency)}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>
                    <AppButton mode="outlined" onPress={() => { void handleShareSummary(); }} compact icon="file-pdf-box">
                        {COMMON_TEXT.actions.share}
                    </AppButton>
                </View>
                <View style={styles.exportRow}>
                    <AppButton
                        mode="contained-tonal"
                        compact
                        icon="code-json"
                        onPress={() => { void handleExportJson(); }}
                        style={styles.exportButton}
                    >
                        Export JSON
                    </AppButton>
                    <AppButton mode="contained-tonal" compact icon="microsoft-excel" onPress={() => { void handleExportExcel(); }}>
                        Export Excel
                    </AppButton>
                </View>
            </AppCard>

            {error && (
                <Text style={{ color: theme.colors.error, marginBottom: 8 }}>
                    {error}
                </Text>
            )}

            <Text variant="titleMedium" style={styles.recentBillHeading}>
                Recent Bills
            </Text>

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
                    contentContainerStyle={{ paddingBottom: bottomSpacing }}
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
            </>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    rangeSelector: {
        marginBottom: 12,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metricCard: {
        flex: 1,
    },
    metricCardLeft: {
        marginRight: 8,
    },
    topItemRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    topItemRank: {
        width: 24,
        fontWeight: '700',
    },
    topItemText: {
        flex: 1,
    },
    exportRow: {
        flexDirection: 'column',
        marginTop: 10,
    },
    exportButton: {
        marginBottom: 8,
    },
    recentBillHeading: {
        marginTop: 2,
        marginBottom: 10,
        fontWeight: '700',
    },
});
