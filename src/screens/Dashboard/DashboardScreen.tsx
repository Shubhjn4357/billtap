import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StoredBill } from '../../api/billService';
import { analyticsService } from '../../api/analyticsService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppSkeleton } from '../../components/common/AppSkeleton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { Config } from '../../constants/Config';
import { DesignSystem } from '../../constants/DesignSystem';
import { useAuth } from '../../hooks/useAuth';
import { useBills } from '../../hooks/useBills';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { useOffers } from '../../hooks/useOffers';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useStock } from '../../hooks/useStock';
import { useSettingsStore } from '../../store';
import { formatCurrency, formatDate, normalizeCurrencyCode } from '../../utils/formatters';
import { isLowStock } from '../../utils/stockStatus';

const billStatusLabel = (bill: StoredBill): 'PAID' | 'PARTIAL' | 'PENDING' => {
    const raw = bill as unknown as { paymentStatus?: string; paidAmount?: number };
    const paymentStatus = raw.paymentStatus?.toUpperCase();
    if (paymentStatus === 'PAID' || paymentStatus === 'PARTIAL' || paymentStatus === 'PENDING') {
        return paymentStatus;
    }
    const paidAmount = Number(raw.paidAmount ?? 0);
    if (paidAmount >= bill.total) return 'PAID';
    if (paidAmount > 0) return 'PARTIAL';
    return 'PENDING';
};

const getStatusColors = (
    status: ReturnType<typeof billStatusLabel>,
    colors: { primaryContainer: string; onPrimaryContainer: string; secondaryContainer: string; onSecondaryContainer: string; errorContainer: string; onErrorContainer: string }
) => {
    if (status === 'PAID') return { bg: colors.primaryContainer, fg: colors.onPrimaryContainer };
    if (status === 'PARTIAL') return { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer };
    return { bg: colors.errorContainer, fg: colors.onErrorContainer };
};

export const DashboardScreen = () => {
    const { user } = useAuth();
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { currencySymbol } = useSettingsStore();
    const {
        canViewDashboard,
        canOpenBilling,
        canCreateSale,
        canCreatePurchase,
        canManageInventory,
        canViewReports,
    } = useOrganizationAccess();
    const { bills, stats, loading: billsLoading, fetchBills } = useBills(canViewReports, { limit: 300 });
    const { primaryOffer, fetchOffers } = useOffers();
    const { items, loading: stockLoading, fetchItems } = useStock();

    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);
    const isTablet = width >= 900;
    const isDesktop = width >= 1180;
    const bottomSpacing = getTabAwareBottomSpacing(insets.bottom, 20);

    const lowStockCount = useMemo(() => items.filter((entry) => isLowStock(entry)).length, [items]);
    const recentBills = useMemo(
        () => [...bills]
            .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
            .slice(0, 8),
        [bills]
    );

    const refreshDashboardData = useCallback(async () => {
        if (!canViewDashboard) return;
        await Promise.allSettled([
            canViewReports ? fetchBills() : Promise.resolve(),
            canManageInventory ? fetchItems() : Promise.resolve(),
            fetchOffers(),
        ]);
    }, [canManageInventory, canViewDashboard, canViewReports, fetchBills, fetchItems, fetchOffers]);

    useFocusRefresh(refreshDashboardData, {
        enabled: canViewDashboard,
        minIntervalMs: 8_000,
        delayMs: 120,
    });

    React.useEffect(() => {
        if (!user || !primaryOffer) return;
        void analyticsService.logEvent({
            userId: user.uid,
            eventType: 'offer_impression',
            source: 'dashboard_banner',
            offerId: primaryOffer.id,
        });
    }, [primaryOffer, user]);

    const showSkeleton = billsLoading && bills.length === 0;

    if (!canViewDashboard) {
        return (
            <ScreenWrapper>
                <View style={styles.centeredWrap}>
                    <AppCard>
                        <Text variant="titleMedium" style={styles.blockedTitle}>
                            Dashboard access is disabled
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Ask owner/admin to enable dashboard permission for your account.
                        </Text>
                    </AppCard>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.contentInner, isDesktop && styles.contentInnerDesktop]}>
                    <PageHeaderCard
                        title="Dashboard"
                        subtitle="Revenue, activity and quick actions"
                        right={(
                            <AppButton mode="outlined" compact onPress={() => { void refreshDashboardData(); }}>
                                Refresh
                            </AppButton>
                        )}
                    />

                    <View style={[styles.kpiGrid, isTablet && styles.kpiGridTablet]}>
                        {showSkeleton ? (
                            Array.from({ length: 4 }).map((_, index) => (
                                <AppCard key={`kpi-skeleton-${index}`} style={[styles.kpiCard, isTablet && styles.kpiCardTablet]}>
                                    <AppSkeleton width="56%" height={12} />
                                    <AppSkeleton width="80%" height={26} style={{ marginTop: 10 }} />
                                    <AppSkeleton width="46%" height={11} style={{ marginTop: 10 }} />
                                </AppCard>
                            ))
                        ) : (
                            <>
                                <AppCard style={[styles.kpiCard, isTablet && styles.kpiCardTablet]}>
                                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Today Sales</Text>
                                    <Text variant="headlineSmall" style={styles.kpiValue}>
                                        {formatCurrency(stats.todaySales, activeCurrency)}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {stats.todayOrders} orders today
                                    </Text>
                                </AppCard>
                                <AppCard style={[styles.kpiCard, isTablet && styles.kpiCardTablet]}>
                                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Last 7 Days</Text>
                                    <Text variant="headlineSmall" style={styles.kpiValue}>
                                        {formatCurrency(stats.weeklySales, activeCurrency)}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        Revenue this week
                                    </Text>
                                </AppCard>
                                <AppCard style={[styles.kpiCard, isTablet && styles.kpiCardTablet]}>
                                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Avg Order</Text>
                                    <Text variant="headlineSmall" style={styles.kpiValue}>
                                        {formatCurrency(stats.averageOrderValue, activeCurrency)}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        Per invoice value
                                    </Text>
                                </AppCard>
                                <AppCard style={[styles.kpiCard, isTablet && styles.kpiCardTablet]}>
                                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Total Revenue</Text>
                                    <Text variant="headlineSmall" style={styles.kpiValue}>
                                        {formatCurrency(stats.totalRevenue, activeCurrency)}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {stats.totalOrders} total invoices
                                    </Text>
                                </AppCard>
                            </>
                        )}
                    </View>

                    <View style={[styles.mainGrid, isDesktop && styles.mainGridDesktop]}>
                        <View style={styles.mainLeft}>
                            <AppCard>
                                <Text variant="titleSmall" style={styles.sectionTitle}>Quick Actions</Text>
                                <View style={styles.actionsGrid}>
                                    {(canOpenBilling && (canCreateSale || canCreatePurchase)) && (
                                        <AppButton mode="contained" compact style={styles.actionButton} onPress={() => router.push('/(main)/(tabs)/billing')}>
                                            New Bill
                                        </AppButton>
                                    )}
                                    {canManageInventory && (
                                        <AppButton mode="contained-tonal" compact style={styles.actionButton} onPress={() => router.push('/(main)/(tabs)/stock')}>
                                            Inventory
                                        </AppButton>
                                    )}
                                    {canViewReports && (
                                        <AppButton mode="outlined" compact style={styles.actionButton} onPress={() => router.push('/(main)/(tabs)/reports')}>
                                            Reports
                                        </AppButton>
                                    )}
                                    <AppButton mode="outlined" compact style={styles.actionButton} onPress={() => router.push('/transaction/settlements' as never)}>
                                        Settlements
                                    </AppButton>
                                </View>
                            </AppCard>

                            {lowStockCount > 0 && (
                                <AppCard>
                                    <Text variant="titleSmall" style={styles.sectionTitle}>Inventory Alert</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {lowStockCount} items are low in stock.
                                    </Text>
                                    <AppButton
                                        mode="contained-tonal"
                                        compact
                                        style={{ marginTop: 10, alignSelf: 'flex-start' }}
                                        onPress={() => router.push('/(main)/(tabs)/stock')}
                                        disabled={stockLoading}
                                    >
                                        Open Inventory
                                    </AppButton>
                                </AppCard>
                            )}

                            {primaryOffer && (
                                <AppCard>
                                    <Text variant="titleSmall" style={styles.sectionTitle}>{primaryOffer.title}</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {primaryOffer.message}
                                    </Text>
                                    {primaryOffer.ctaText ? (
                                        <AppButton
                                            mode="contained"
                                            compact
                                            style={{ marginTop: 10, alignSelf: 'flex-start' }}
                                            onPress={() => {
                                                if (user) {
                                                    void analyticsService.logEvent({
                                                        userId: user.uid,
                                                        eventType: 'offer_click',
                                                        source: 'dashboard_banner',
                                                        offerId: primaryOffer.id,
                                                    });
                                                }
                                                router.push((primaryOffer.ctaRoute || '/subscription') as never);
                                            }}
                                        >
                                            {primaryOffer.ctaText}
                                        </AppButton>
                                    ) : null}
                                </AppCard>
                            )}
                        </View>

                        <View style={styles.mainRight}>
                            <AppCard>
                                <View style={styles.sectionHeaderRow}>
                                    <Text variant="titleSmall" style={styles.sectionTitle}>Recent Bills</Text>
                                    <Chip compact>{recentBills.length}</Chip>
                                </View>

                                {showSkeleton ? (
                                    Array.from({ length: 6 }).map((_, index) => (
                                        <View key={`bill-skeleton-${index}`} style={styles.billSkeletonRow}>
                                            <View style={{ flex: 1 }}>
                                                <AppSkeleton width="44%" height={12} />
                                                <AppSkeleton width="74%" height={10} style={{ marginTop: 8 }} />
                                            </View>
                                            <AppSkeleton width={84} height={26} borderRadius={DesignSystem.radius.pill} />
                                        </View>
                                    ))
                                ) : recentBills.length === 0 ? (
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        No invoices available yet.
                                    </Text>
                                ) : (
                                    recentBills.map((bill) => {
                                        const status = billStatusLabel(bill);
                                        const statusColors = getStatusColors(status, theme.colors);
                                        return (
                                            <Pressable
                                                key={bill.id}
                                                style={[
                                                    styles.billRow,
                                                    { backgroundColor: theme.colors.surfaceVariant },
                                                ]}
                                                onPress={() => router.push('/transaction/settlements' as never)}
                                            >
                                                <View style={{ flex: 1, marginRight: 10 }}>
                                                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                                                        Bill #{bill.billNumber?.trim() || bill.id.slice(0, 8).toUpperCase()}
                                                    </Text>
                                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                        {bill.customerName || 'Walk-in customer'} | {formatDate(bill.createdAt)}
                                                    </Text>
                                                    <Text variant="labelMedium" style={{ marginTop: 4 }}>
                                                        {formatCurrency(bill.total, bill.currency || activeCurrency)}
                                                    </Text>
                                                </View>
                                                <Chip
                                                    compact
                                                    style={{ backgroundColor: statusColors.bg }}
                                                    textStyle={{ color: statusColors.fg, fontWeight: '700' }}
                                                >
                                                    {status}
                                                </Chip>
                                            </Pressable>
                                        );
                                    })
                                )}
                            </AppCard>
                        </View>
                    </View>
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
    contentInnerDesktop: {
        maxWidth: DesignSystem.layout.dashboardMaxWidth,
    },
    kpiGrid: {
        flexDirection: 'column',
        gap: 10,
    },
    kpiGridTablet: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    kpiCard: {
        marginBottom: 0,
    },
    kpiCardTablet: {
        width: '49%',
    },
    kpiValue: {
        fontWeight: '800',
        marginTop: 4,
    },
    mainGrid: {
        gap: 10,
    },
    mainGridDesktop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    mainLeft: {
        flex: 1,
    },
    mainRight: {
        flex: 1.1,
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
    actionsGrid: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    actionButton: {
        minWidth: 120,
    },
    billRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: DesignSystem.radius.sm,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginBottom: 8,
    },
    billSkeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 10,
    },
});
