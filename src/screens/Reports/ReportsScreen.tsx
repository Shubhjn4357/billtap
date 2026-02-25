import React, { useCallback, useMemo, useState, useTransition } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Chip, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CachedBill, StoredBill } from '../../api/billService';
import { reportingService } from '../../api/reportingService';
import { AppAccordion } from '../../components/common/AppAccordion';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppPullToRefresh } from '../../components/common/AppPullToRefresh';
import { AppSkeleton } from '../../components/common/AppSkeleton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { SummaryCard } from '../../components/common/SummaryCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { Config } from '../../constants/Config';
import { DesignSystem } from '../../constants/DesignSystem';
import { COMMON_TEXT, REPORTS_TEXT } from '../../constants/staticText';
import { useAuth } from '../../hooks/useAuth';
import { useBills } from '../../hooks/useBills';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useOrganizationStore, useSettingsStore } from '../../store';
import { toDateSafe } from '../../utils/date';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { formatCurrency, formatDate, normalizeCurrencyCode } from '../../utils/formatters';
import { shareBillPDF, shareSalesReportPDF } from '../../utils/pdfGenerator';
import { sanitizeUpiId } from '../../utils/upi';

type RangePreset = 'today' | '7d' | '30d' | 'all';
type StatusPreset = 'all' | 'paid' | 'partial' | 'unpaid';

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

const getBillStatus = (bill: CachedBill): 'Paid' | 'Partial' | 'Unpaid' => {
    if (bill.paymentStatus === 'PAID') return 'Paid';
    if (bill.paymentStatus === 'PARTIAL') return 'Partial';
    const paid = bill.paidAmount ?? 0;
    if (paid > 0) return paid >= bill.total ? 'Paid' : 'Partial';
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

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

export const ReportsScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const dialog = useAppDialog();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const organizationSettings = useOrganizationStore((state) => state.context.settings);
    const { canViewReports, canAccessAccounting } = useOrganizationAccess();
    const { bills: rawBills, loading, error, fetchBills } = useBills(canViewReports, { limit: 400 });
    const bills = rawBills as CachedBill[];

    const [range, setRange] = useState<RangePreset>('7d');
    const [statusFilter, setStatusFilter] = useState<StatusPreset>('all');
    const [rangePending, startRangeTransition] = useTransition();
    const [refreshing, setRefreshing] = useState(false);

    const isWide = width >= 1024;
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
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        return {
            totalRevenue,
            totalOrders,
            avgOrderValue,
            topItems: buildTopItems(filteredBills).slice(0, 8),
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
            .slice(0, 20),
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
            const settings = asRecord(organizationSettings);
            const customization = asRecord(settings.customization);
            const payment = asRecord(settings.payment);
            const print = asRecord(settings.print);
            const paperSizeCandidate = typeof print.paperSize === 'string' ? print.paperSize.toUpperCase() : 'A4';
            const paperSize: 'A4' | 'A5' | '2INCH' | '3INCH' = (
                paperSizeCandidate === 'A5'
                || paperSizeCandidate === '2INCH'
                || paperSizeCandidate === '3INCH'
            ) ? paperSizeCandidate : 'A4';

            await shareBillPDF({
                ...bill,
                currency: bill.currency ?? activeCurrency,
                businessName: bill.businessName ?? user?.businessName ?? user?.displayName ?? undefined,
                businessAddress: bill.businessAddress ?? user?.address ?? undefined,
                gstNumber: bill.gstNumber ?? user?.gstNumber ?? undefined,
                printerType: print.printerType === 'THERMAL' ? 'THERMAL' : 'STANDARD',
                paperSize,
                acknowledgmentText: typeof customization.acknowledgmentText === 'string' ? customization.acknowledgmentText : undefined,
                footerText: typeof customization.footerText === 'string' ? customization.footerText : undefined,
                upiId: sanitizeUpiId(typeof payment.upiId === 'string' ? payment.upiId : '') || undefined,
                signatureImageUrl: typeof settings.signatureImageUrl === 'string'
                    ? settings.signatureImageUrl
                    : (typeof customization.signatureImageUrl === 'string' ? customization.signatureImageUrl : undefined),
            });
        } catch (shareError: unknown) {
            if (!isNetworkLikeError(shareError)) {
                dialog.alert(COMMON_TEXT.alerts.error, shareError instanceof Error ? shareError.message : REPORTS_TEXT.shareBillFailed);
            }
        }
    }, [activeCurrency, dialog, organizationSettings, user?.address, user?.businessName, user?.displayName, user?.gstNumber]);

    const handleExport = useCallback(async (mode: 'json' | 'csv') => {
        try {
            const start = getRangeStart(range);
            const exported = await reportingService.exportTransactions(mode, {
                type: 'SALE',
                start: start ? start.toISOString() : undefined,
            });
            await Share.share({
                title: mode === 'json' ? 'Vahi Transactions JSON Export' : 'Vahi Transactions CSV Export',
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
                            Ask your organization owner to enable reports permission for your account.
                        </Text>
                    </AppCard>
                </View>
            </ScreenWrapper>
        );
    }

    const showSkeleton = loading && bills.length === 0;

    return (
        <ScreenWrapper>
            <AppPullToRefresh refreshing={refreshing} onRefresh={() => { void onRefresh(); }}>
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title={REPORTS_TEXT.title}
                            subtitle={`${RANGE_LABELS[range]} • ${filteredBills.length} bills`}
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
                            <View style={styles.filterRow}>
                                <Chip compact selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')}>
                                    All ({rangeFilteredBills.length})
                                </Chip>
                                <Chip compact selected={statusFilter === 'paid'} onPress={() => setStatusFilter('paid')}>
                                    Paid ({billStatusSummary.paid})
                                </Chip>
                                <Chip compact selected={statusFilter === 'partial'} onPress={() => setStatusFilter('partial')}>
                                    Partial ({billStatusSummary.partial})
                                </Chip>
                                <Chip compact selected={statusFilter === 'unpaid'} onPress={() => setStatusFilter('unpaid')}>
                                    Unpaid ({billStatusSummary.unpaid})
                                </Chip>
                            </View>
                            {rangePending ? (
                                <Text variant="labelSmall" style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>
                                    Updating range...
                                </Text>
                            ) : null}
                        </AppCard>

                        <View style={[styles.summaryRow, isWide && styles.summaryRowWide]}>
                            <SummaryCard
                                label="Revenue"
                                value={showSkeleton ? '--' : formatCurrency(summary.totalRevenue, activeCurrency)}
                                tone="positive"
                            />
                            <SummaryCard
                                label="Bills"
                                value={showSkeleton ? '--' : String(summary.totalOrders)}
                                tone="neutral"
                            />
                            <SummaryCard
                                label="Avg Bill"
                                value={showSkeleton ? '--' : formatCurrency(summary.avgOrderValue, activeCurrency)}
                                tone="warning"
                            />
                        </View>

                        <AppAccordion
                            title={`Recent Bills (${recentBills.length})`}
                            icon="receipt-text-outline"
                            defaultExpanded
                        >
                            {showSkeleton ? (
                                Array.from({ length: 6 }).map((_, index) => (
                                    <View key={`bill-skeleton-${index}`} style={styles.billRowSkeleton}>
                                        <View style={{ flex: 1 }}>
                                            <AppSkeleton width="42%" height={12} />
                                            <AppSkeleton width="65%" height={10} style={{ marginTop: 8 }} />
                                        </View>
                                        <AppSkeleton width={80} height={26} borderRadius={DesignSystem.radius.pill} />
                                    </View>
                                ))
                            ) : recentBills.length === 0 ? (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    {REPORTS_TEXT.noBillsInRange}
                                </Text>
                            ) : (
                                recentBills.map((item) => {
                                    const status = getBillStatus(item);
                                    const statusBg = status === 'Paid'
                                        ? theme.colors.primaryContainer
                                        : status === 'Partial'
                                            ? theme.colors.secondaryContainer
                                            : theme.colors.errorContainer;
                                    const statusColor = status === 'Paid'
                                        ? theme.colors.onPrimaryContainer
                                        : status === 'Partial'
                                            ? theme.colors.onSecondaryContainer
                                            : theme.colors.onErrorContainer;

                                    return (
                                        <View key={item.id} style={[styles.billRow, { borderColor: theme.colors.outlineVariant }]}>
                                            <Pressable
                                                style={styles.billRowMain}
                                                onPress={() => router.push({ pathname: '/bill/[id]', params: { id: item.id } } as never)}
                                            >
                                                <Text variant="titleSmall" style={styles.billId}>
                                                    #{item.billNumber?.trim() || item.id.slice(0, 8).toUpperCase()}
                                                </Text>
                                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                    {formatDate(item.createdAt)} • {item.items.length} {REPORTS_TEXT.lineItemSuffix}
                                                </Text>
                                                <Text variant="labelLarge" style={styles.billAmount}>
                                                    {formatCurrency(item.total, item.currency ?? activeCurrency)}
                                                </Text>
                                            </Pressable>
                                            <View style={styles.billRowActions}>
                                                <Chip compact style={{ backgroundColor: statusBg }} textStyle={{ color: statusColor }}>
                                                    {status}
                                                </Chip>
                                                <View style={styles.billActionButtons}>
                                                    <AppButton
                                                        mode="text"
                                                        compact
                                                        icon="pencil"
                                                        onPress={() => router.push({ pathname: '/transaction', params: { id: item.id } })}
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
                                        </View>
                                    );
                                })
                            )}
                        </AppAccordion>

                        <AppAccordion
                            title={`Top Products (${summary.topItems.length})`}
                            icon="chart-line"
                            defaultExpanded={!isWide}
                        >
                            {summary.topItems.length === 0 ? (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    {REPORTS_TEXT.noProductSales}
                                </Text>
                            ) : (
                                summary.topItems.map((entry, index) => (
                                    <View key={`${entry.name}-${index}`} style={styles.topItemRow}>
                                        <Text variant="labelMedium" style={styles.topItemRank}>
                                            #{index + 1}
                                        </Text>
                                        <View style={{ flex: 1 }}>
                                            <Text variant="bodyMedium" numberOfLines={1}>{entry.name}</Text>
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                {entry.qty} qty • {formatCurrency(entry.revenue, activeCurrency)}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </AppAccordion>

                        <AppAccordion
                            title="Export & Tools"
                            icon="toolbox-outline"
                            defaultExpanded={false}
                        >
                            <View style={styles.toolsRow}>
                                <AppButton mode="contained-tonal" compact icon="file-pdf-box" onPress={() => { void handleShareSummary(); }}>
                                    Share PDF
                                </AppButton>
                                <AppButton mode="contained-tonal" compact icon="code-json" onPress={() => { void handleExport('json'); }}>
                                    Export JSON
                                </AppButton>
                                <AppButton mode="contained-tonal" compact icon="microsoft-excel" onPress={() => { void handleExport('csv'); }}>
                                    Export CSV
                                </AppButton>
                                <AppButton
                                    mode="outlined"
                                    compact
                                    icon="calculator-variant-outline"
                                    onPress={() => router.push('/accounting' as never)}
                                    disabled={!canAccessAccounting}
                                >
                                    Accounting
                                </AppButton>
                            </View>
                        </AppAccordion>

                        {error && !isNetworkLikeError(error) ? (
                            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                                {error}
                            </Text>
                        ) : null}
                    </View>
                </ScrollView>
            </AppPullToRefresh>
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
        gap: DesignSystem.layout.sectionGap,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.dashboardMaxWidth,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    summaryRow: {
        flexDirection: 'column',
        gap: 10,
    },
    summaryRowWide: {
        flexDirection: 'row',
    },
    billRowSkeleton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
    },
    billRow: {
        borderWidth: 1,
        borderRadius: DesignSystem.radius.sm,
        padding: DesignSystem.spacing.sm,
        marginTop: 8,
    },
    billRowMain: {
        marginBottom: 8,
    },
    billId: {
        fontWeight: '700',
    },
    billAmount: {
        marginTop: 4,
        fontWeight: '700',
    },
    billRowActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    billActionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
    },
    topItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
    },
    topItemRank: {
        width: 28,
        fontWeight: '700',
    },
    toolsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
});
