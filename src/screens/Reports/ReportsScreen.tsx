import React, { useCallback, useMemo, useState, useTransition } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StoredBill } from '../../api/billService';
import { reportingService } from '../../api/reportingService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppSkeleton } from '../../components/common/AppSkeleton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { Config } from '../../constants/Config';
import { DesignSystem } from '../../constants/DesignSystem';
import { COMMON_TEXT, REPORTS_TEXT } from '../../constants/staticText';
import { useAuth } from '../../hooks/useAuth';
import { useBills } from '../../hooks/useBills';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useSettingsStore } from '../../store';
import { toDateSafe } from '../../utils/date';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { formatCurrency, formatDate, normalizeCurrencyCode } from '../../utils/formatters';
import { shareBillPDF, shareSalesReportPDF } from '../../utils/pdfGenerator';

type RangePreset = 'today' | '7d' | '30d' | 'all';
type StatusPreset = 'all' | 'paid' | 'partial' | 'unpaid';

const RANGE_LABELS: Record<RangePreset, string> = {
    today: REPORTS_TEXT.ranges.today,
    '7d': REPORTS_TEXT.ranges['7d'],
    '30d': REPORTS_TEXT.ranges['30d'],
    all: REPORTS_TEXT.ranges.all,
};

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const getRangeStart = (range: RangePreset): Date | null => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === 'today') return today;
    if (range === '7d') {
        const date = new Date(today);
        date.setDate(today.getDate() - 6);
        return date;
    }
    if (range === '30d') {
        const date = new Date(today);
        date.setDate(today.getDate() - 29);
        return date;
    }
    return null;
};

const getBillStatus = (bill: StoredBill): 'Paid' | 'Partial' | 'Unpaid' => {
    const raw = asRecord(bill);
    const paymentStatus = typeof raw.paymentStatus === 'string' ? raw.paymentStatus.toUpperCase() : '';
    if (paymentStatus === 'PAID') return 'Paid';
    if (paymentStatus === 'PARTIAL') return 'Partial';

    const paidAmount = typeof raw.paidAmount === 'number' ? raw.paidAmount : 0;
    if (paidAmount >= bill.total) return 'Paid';
    if (paidAmount > 0) return 'Partial';
    return 'Unpaid';
};

const matchesStatus = (status: ReturnType<typeof getBillStatus>, statusPreset: StatusPreset) => {
    if (statusPreset === 'all') return true;
    if (statusPreset === 'paid') return status === 'Paid';
    if (statusPreset === 'partial') return status === 'Partial';
    return status === 'Unpaid';
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
    const dialog = useAppDialog();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const { canViewReports, canAccessAccounting } = useOrganizationAccess();
    const { bills, loading, error, fetchBills } = useBills(canViewReports, { limit: 400 });
    const [range, setRange] = useState<RangePreset>('7d');
    const [statusFilter, setStatusFilter] = useState<StatusPreset>('all');
    const [rangePending, startRangeTransition] = useTransition();
    const [refreshing, setRefreshing] = useState(false);

    const isWide = width >= 1080;
    const bottomSpacing = getTabAwareBottomSpacing(insets.bottom, 20);
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);

    const rangeFilteredBills = useMemo(() => {
        const start = getRangeStart(range);
        if (!start) return bills;
        return bills.filter((entry) => {
            const createdAt = toDateSafe(entry.createdAt);
            return createdAt ? createdAt >= start : false;
        });
    }, [bills, range]);

    const filteredBills = useMemo(() => {
        if (statusFilter === 'all') return rangeFilteredBills;
        return rangeFilteredBills.filter((entry) => matchesStatus(getBillStatus(entry), statusFilter));
    }, [rangeFilteredBills, statusFilter]);

    const summary = useMemo(() => {
        const totalRevenue = filteredBills.reduce((sum, bill) => sum + bill.total, 0);
        const totalOrders = filteredBills.length;
        return {
            totalRevenue,
            totalOrders,
            topItems: buildTopItems(filteredBills).slice(0, 5),
        };
    }, [filteredBills]);

    const billStatusSummary = useMemo(() => {
        let paid = 0;
        let partial = 0;
        let unpaid = 0;
        for (const bill of rangeFilteredBills) {
            const status = getBillStatus(bill);
            if (status === 'Paid') paid += 1;
            else if (status === 'Partial') partial += 1;
            else unpaid += 1;
        }
        return { paid, partial, unpaid };
    }, [rangeFilteredBills]);

    const recentBills = useMemo(
        () => [...filteredBills]
            .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
            .slice(0, 24),
        [filteredBills]
    );

    useFocusRefresh(fetchBills, {
        enabled: canViewReports,
        minIntervalMs: 9_000,
    });

    const onRefresh = useCallback(async () => {
        if (!canViewReports) return;
        setRefreshing(true);
        try {
            await fetchBills();
        } finally {
            setRefreshing(false);
        }
    }, [canViewReports, fetchBills]);

    const handleShareSummary = useCallback(async () => {
        if (filteredBills.length === 0) {
            dialog.alert(COMMON_TEXT.alerts.noData, REPORTS_TEXT.noDataBody);
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
            if (!isNetworkLikeError(shareError)) {
                dialog.alert(COMMON_TEXT.alerts.error, shareError instanceof Error ? shareError.message : REPORTS_TEXT.shareSummaryFailed);
            }
        }
    }, [activeCurrency, dialog, filteredBills, range, summary.topItems, summary.totalOrders, summary.totalRevenue]);

    const handleShareBill = useCallback(async (bill: StoredBill) => {
        try {
            await shareBillPDF({ ...bill, currency: bill.currency ?? activeCurrency });
        } catch (shareError: unknown) {
            if (!isNetworkLikeError(shareError)) {
                dialog.alert(COMMON_TEXT.alerts.error, shareError instanceof Error ? shareError.message : REPORTS_TEXT.shareBillFailed);
            }
        }
    }, [activeCurrency, dialog]);

    const handleExport = useCallback(async (mode: 'json' | 'csv') => {
        try {
            const start = getRangeStart(range);
            const exported = await reportingService.exportTransactions(mode, {
                type: 'SALE',
                start: start ? start.toISOString() : undefined,
            });
            await Share.share({
                title: mode === 'json' ? 'BillTap Transactions JSON Export' : 'BillTap Transactions CSV Export',
                message: typeof exported === 'string' ? exported : JSON.stringify(exported, null, 2),
            });
        } catch (exportError: unknown) {
            if (!isNetworkLikeError(exportError)) {
                dialog.alert(
                    COMMON_TEXT.alerts.error,
                    exportError instanceof Error ? exportError.message : (mode === 'json' ? 'Failed to export JSON.' : 'Failed to export CSV.')
                );
            }
        }
    }, [dialog, range]);

    if (!canViewReports) {
        return (
            <ScreenWrapper>
                <View style={styles.centeredWrap}>
                    <AppCard>
                        <Text variant="titleMedium" style={styles.blockedTitle}>Reports access is disabled</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Ask owner/admin to enable reports permission for your account.
                        </Text>
                    </AppCard>
                </View>
            </ScreenWrapper>
        );
    }

    const showSkeleton = loading && bills.length === 0;

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} />}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title={REPORTS_TEXT.title}
                        subtitle={`${RANGE_LABELS[range]} range`}
                        right={(
                            <AppButton mode="contained-tonal" compact onPress={() => { void handleShareSummary(); }}>
                                Share
                            </AppButton>
                        )}
                    />

                    <AppCard>
                        <SegmentedButtons
                            value={range}
                            onValueChange={(value) => {
                                startRangeTransition(() => setRange(value as RangePreset));
                            }}
                            buttons={[
                                { value: 'today', label: REPORTS_TEXT.rangeButtons.today },
                                { value: '7d', label: REPORTS_TEXT.rangeButtons['7d'] },
                                { value: '30d', label: REPORTS_TEXT.rangeButtons['30d'] },
                                { value: 'all', label: REPORTS_TEXT.rangeButtons.all },
                            ]}
                        />
                        {rangePending ? (
                            <Text variant="labelSmall" style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>
                                Updating range...
                            </Text>
                        ) : null}
                    </AppCard>

                    <AppCard>
                        <SegmentedButtons
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value as StatusPreset)}
                            buttons={[
                                { value: 'all', label: 'All' },
                                { value: 'paid', label: `Paid (${billStatusSummary.paid})` },
                                { value: 'partial', label: `Partial (${billStatusSummary.partial})` },
                                { value: 'unpaid', label: `Unpaid (${billStatusSummary.unpaid})` },
                            ]}
                        />
                    </AppCard>

                    <View style={[styles.metricRow, isWide && styles.metricRowWide]}>
                        <AppCard style={[styles.metricCard, isWide && styles.metricCardWide]}>
                            {showSkeleton ? (
                                <>
                                    <AppSkeleton width="40%" height={12} />
                                    <AppSkeleton width="72%" height={28} style={{ marginTop: 10 }} />
                                </>
                            ) : (
                                <>
                                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Revenue</Text>
                                    <Text variant="headlineSmall" style={styles.metricValue}>
                                        {formatCurrency(summary.totalRevenue, activeCurrency)}
                                    </Text>
                                </>
                            )}
                        </AppCard>
                        <AppCard style={[styles.metricCard, isWide && styles.metricCardWide]}>
                            {showSkeleton ? (
                                <>
                                    <AppSkeleton width="38%" height={12} />
                                    <AppSkeleton width={88} height={28} style={{ marginTop: 10 }} />
                                </>
                            ) : (
                                <>
                                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Orders</Text>
                                    <Text variant="headlineSmall" style={styles.metricValue}>{summary.totalOrders}</Text>
                                </>
                            )}
                        </AppCard>
                    </View>

                    <View style={[styles.mainGrid, isWide && styles.mainGridWide]}>
                        <View style={styles.mainColumn}>
                            <AppCard>
                                <View style={styles.sectionHeaderRow}>
                                    <Text variant="titleSmall" style={styles.sectionTitle}>Top Products</Text>
                                    <AppButton mode="outlined" compact icon="file-pdf-box" onPress={() => { void handleShareSummary(); }}>
                                        Share PDF
                                    </AppButton>
                                </View>
                                {showSkeleton ? (
                                    Array.from({ length: 4 }).map((_, index) => (
                                        <View key={`product-skeleton-${index}`} style={styles.topItemRow}>
                                            <AppSkeleton width={24} height={10} />
                                            <AppSkeleton width="74%" height={10} />
                                        </View>
                                    ))
                                ) : summary.topItems.length === 0 ? (
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {REPORTS_TEXT.noProductSales}
                                    </Text>
                                ) : (
                                    summary.topItems.slice(0, 5).map((entry, index) => (
                                        <View key={`${entry.name}-${index}`} style={styles.topItemRow}>
                                            <Text variant="bodySmall" style={styles.topItemRank}>#{index + 1}</Text>
                                            <Text variant="bodySmall" style={styles.topItemText}>
                                                {entry.name} | {entry.qty} qty | {formatCurrency(entry.revenue, activeCurrency)}
                                            </Text>
                                        </View>
                                    ))
                                )}
                                <View style={styles.exportRow}>
                                    <AppButton mode="contained-tonal" compact icon="code-json" onPress={() => { void handleExport('json'); }}>
                                        Export JSON
                                    </AppButton>
                                    <AppButton mode="contained-tonal" compact icon="microsoft-excel" onPress={() => { void handleExport('csv'); }}>
                                        Export CSV
                                    </AppButton>
                                </View>
                            </AppCard>

                            <AppCard>
                                <View style={styles.sectionHeaderRow}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text variant="titleSmall" style={styles.sectionTitle}>Accounting Suite</Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            Trial balance, GST summary and journals.
                                        </Text>
                                    </View>
                                    <AppButton
                                        mode="contained-tonal"
                                        compact
                                        onPress={() => router.push('/accounting' as never)}
                                        disabled={!canAccessAccounting}
                                    >
                                        Open
                                    </AppButton>
                                </View>
                            </AppCard>
                        </View>

                        <View style={styles.mainColumn}>
                            <AppCard>
                                <Text variant="titleSmall" style={styles.sectionTitle}>
                                    Recent Bills ({recentBills.length})
                                </Text>

                                {showSkeleton ? (
                                    Array.from({ length: 8 }).map((_, index) => (
                                        <View key={`bill-skeleton-${index}`} style={styles.billRow}>
                                            <View style={{ flex: 1 }}>
                                                <AppSkeleton width="42%" height={12} />
                                                <AppSkeleton width="60%" height={10} style={{ marginTop: 8 }} />
                                                <AppSkeleton width={120} height={10} style={{ marginTop: 8 }} />
                                            </View>
                                            <AppSkeleton width={72} height={28} borderRadius={DesignSystem.radius.pill} />
                                        </View>
                                    ))
                                ) : recentBills.length === 0 ? (
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                                        {REPORTS_TEXT.noBillsInRange}
                                    </Text>
                                ) : (
                                    recentBills.map((item) => {
                                        const status = getBillStatus(item);
                                        const statusColor = status === 'Paid'
                                            ? theme.colors.primaryContainer
                                            : status === 'Partial'
                                                ? theme.colors.secondaryContainer
                                                : theme.colors.errorContainer;
                                        const statusText = status === 'Paid'
                                            ? theme.colors.onPrimaryContainer
                                            : status === 'Partial'
                                                ? theme.colors.onSecondaryContainer
                                                : theme.colors.onErrorContainer;

                                        return (
                                            <View
                                                key={item.id}
                                                style={[
                                                    styles.billRow,
                                                    { backgroundColor: theme.colors.surfaceVariant },
                                                ]}
                                            >
                                                <View style={{ flex: 1, marginRight: 8 }}>
                                                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                                                        Bill #{item.billNumber?.trim() || item.id.slice(0, 8).toUpperCase()}
                                                    </Text>
                                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                        {formatDate(item.createdAt)} | {item.items.length} {REPORTS_TEXT.lineItemSuffix}
                                                    </Text>
                                                    <Text variant="labelMedium" style={{ marginTop: 4 }}>
                                                        {formatCurrency(item.total, item.currency ?? activeCurrency)}
                                                    </Text>
                                                </View>
                                                <View style={styles.billActions}>
                                                    <Chip compact style={{ backgroundColor: statusColor }} textStyle={{ color: statusText }}>
                                                        {status}
                                                    </Chip>
                                                    <AppButton
                                                        mode="text"
                                                        compact
                                                        icon="pencil"
                                                        onPress={() => router.push({ pathname: '/transaction', params: { id: item.id } } as any)}
                                                    >
                                                        Edit
                                                    </AppButton>
                                                    <AppButton
                                                        mode="text"
                                                        compact
                                                        icon="share-variant"
                                                        onPress={() => { void handleShareBill(item); }}
                                                    >
                                                        {COMMON_TEXT.actions.share}
                                                    </AppButton>
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </AppCard>
                        </View>
                    </View>
                    {error && !isNetworkLikeError(error) ? (
                        <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                            {error}
                        </Text>
                    ) : null}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    centeredWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    blockedTitle: {
        fontWeight: '700',
        marginBottom: 8,
    },
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        gap: 10,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.dashboardMaxWidth,
    },
    metricRow: {
        flexDirection: 'column',
        gap: 10,
    },
    metricRowWide: {
        flexDirection: 'row',
    },
    metricCard: {
        marginBottom: 0,
    },
    metricCardWide: {
        width: '49%',
    },
    metricValue: {
        marginTop: 4,
        fontWeight: '800',
    },
    mainGrid: {
        gap: 10,
    },
    mainGridWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    mainColumn: {
        flex: 1,
    },
    sectionTitle: {
        fontWeight: '700',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    topItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
    },
    topItemRank: {
        width: 24,
        fontWeight: '700',
    },
    topItemText: {
        flex: 1,
    },
    exportRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    billRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: DesignSystem.radius.sm,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginBottom: 8,
    },
    billActions: {
        alignItems: 'flex-end',
        gap: 6,
    },
});
