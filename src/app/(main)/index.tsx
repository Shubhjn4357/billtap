import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { canAccessModule, canUsePos } from '../../utils/accessControl';
import { HOME_QUICK_ACTIONS } from '../../constants/navigationOptions';
import { DESIGN_SPACING, getInsetPanelStyle, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../constants/theme';
import { AppTopBar } from '../../components/ui/AppTopBar';
import { HubActionCard, HubMetricCard } from '../../components/ui/HubBlocks';
import { useAppColors } from '../../hooks/useAppColors';
import { useAppRuntime } from '../../components/providers/AppRuntimeProvider';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import { useInvoices, formatInvoiceDate } from '../../hooks/useInvoices';
import { useParties } from '../../hooks/useParties';
import { useReportSummary } from '../../hooks/useReports';
import { useActiveOffers } from '../../hooks/useOffers';
import { useSyncStatus } from '../../hooks/useSyncStatus';

export default function HomeScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const { user, business, tierLabel, subscription, role, refresh } = useCurrentBusiness();
    const { syncStats, refreshSyncState } = useAppRuntime();
    const syncStatus = useSyncStatus();
    const [upgradePromptShown, setUpgradePromptShown] = useState(false);

    const today = new Date();
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
    const prevMonthStart = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
    const prevMonthEnd = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');

    useEffect(() => { void refresh(); }, [refresh]);

    const {
        summary,
        isLoading: summaryLoading,
        isRefetching: summaryRefetching,
        refetch: refetchSummary,
    } = useReportSummary({ from: monthStart, to: monthEnd }, { staleTime: 5 * 60_000 });

    const { summary: prevSummary } = useReportSummary(
        { from: prevMonthStart, to: prevMonthEnd },
        { staleTime: 20 * 60_000 }
    );

    const {
        invoices,
        summary: invoiceSummary,
        isLoading: invoicesLoading,
        isRefetching: invoicesRefetching,
        refetch: refetchInvoices,
    } = useInvoices({
        dateRange: 'month',
        limit: 6,
    });

    const {
        stats: customerStats,
        isRefetching: customerRefetching,
        refetch: refetchCustomers,
    } = useParties({ type: 'CUSTOMER' });
    const {
        stats: supplierStats,
        isRefetching: supplierRefetching,
        refetch: refetchSuppliers,
    } = useParties({ type: 'SUPPLIER' });

    const { offers } = useActiveOffers({ staleTime: 60_000 });

    const blockedCount = syncStats.blockedCount;
    const pendingCount = syncStatus.pendingCount;
    const isLoading = summaryLoading || invoicesLoading;
    const isRefetching =
        summaryRefetching
        || invoicesRefetching
        || customerRefetching
        || supplierRefetching;

    useEffect(() => {
        if (upgradePromptShown || blockedCount <= 0) return;
        setUpgradePromptShown(true);
    }, [blockedCount, upgradePromptShown]);

    const quickActions = useMemo(() => (
        HOME_QUICK_ACTIONS.filter((action) => {
            if (action.requiresPos && !canUsePos(subscription)) return false;
            if (!action.module) return true;
            return canAccessModule(role, action.module, subscription, business);
        }).slice(0, 4)
    ), [business, role, subscription]);

    const recentInvoices = useMemo(
        () => [...invoices].sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : -1)).slice(0, 4),
        [invoices]
    );

    const overviewCards = useMemo(() => {
        const syncLabel = blockedCount > 0
            ? `${blockedCount} blocked`
            : pendingCount > 0
                ? `${pendingCount} queued`
                : syncStatus.isOnline
                    ? 'Healthy'
                    : 'Offline';
        const syncTone = blockedCount > 0
            ? 'warning'
            : pendingCount > 0 || !syncStatus.isOnline
                ? 'info'
                : 'success';
        return [
            {
                label: 'Revenue',
                value: `Rs ${Math.round(summary?.totalSales ?? 0).toLocaleString('en-IN')}`,
                meta: percentageMeta(summary?.totalSales, prevSummary?.totalSales),
                tone: 'success' as const,
            },
            {
                label: 'Outstanding',
                value: `Rs ${Math.round(invoiceSummary.outstanding ?? 0).toLocaleString('en-IN')}`,
                meta: `${invoiceSummary.overdue} overdue`,
                tone: invoiceSummary.overdue > 0 ? 'warning' as const : 'info' as const,
            },
            {
                label: 'Sync',
                value: syncLabel,
                meta: syncStatus.error ? 'Needs attention' : 'Cloud status',
                tone: syncTone,
            },
            {
                label: 'Plan',
                value: tierLabel,
                meta: subscription?.cloudSyncAllowed ? 'Cloud enabled' : 'Offline-first',
                tone: 'info' as const,
            },
        ] as const;
    }, [
        blockedCount,
        invoiceSummary.outstanding,
        invoiceSummary.overdue,
        pendingCount,
        prevSummary?.totalSales,
        summary?.totalSales,
        subscription?.cloudSyncAllowed,
        syncStatus.error,
        syncStatus.isOnline,
        tierLabel,
    ]);

    const doRefresh = () => {
        void Promise.all([
            refetchSummary(),
            refetchInvoices(),
            refetchCustomers(),
            refetchSuppliers(),
            refreshSyncState(),
        ]);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={business?.name ?? 'Dashboard'}
                subtitle={`Hello ${user?.name?.split(' ')[0] ?? 'there'}`}
                rightAction={(
                    <Pressable
                        style={s.tierBadge}
                        onPress={() => router.push('/(main)/more/subscription' as Parameters<typeof router.push>[0])}
                    >
                        <Text style={[s.tierText, { color: colors.primary }]}>{tierLabel}</Text>
                    </Pressable>
                )}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.content}
                refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={doRefresh} tintColor={colors.primary} />}
            >
                <View style={s.heroCard}>
                    <View style={s.heroRow}>
                        <View style={s.heroCopy}>
                            <Text style={[s.eyebrow, { color: colors.primary }]}>Overview</Text>
                            <Text style={[s.heroTitle, { color: colors.text }]}>Simple daily control for billing and operations.</Text>
                            <Text style={[s.heroSubtitle, { color: colors.textSecondary }]}>
                                Revenue, outstanding balances, sync state, and the next actions are all in one place.
                            </Text>
                        </View>
                        <View style={s.heroBadge}>
                            <MaterialCommunityIcons name="chart-box-outline" size={20} color={colors.primary} />
                        </View>
                    </View>
                    <View style={s.heroMetaRow}>
                        <MetaPill label={`${customerStats?.totalCustomers ?? 0} customers`} colors={colors} />
                        <MetaPill label={`${supplierStats?.totalSuppliers ?? 0} suppliers`} colors={colors} />
                        <MetaPill label={`${invoiceSummary.total} monthly invoices`} colors={colors} />
                    </View>
                    {blockedCount > 0 ? (
                        <Pressable
                            style={s.syncAlert}
                            onPress={() => router.push('/(main)/more/subscription' as Parameters<typeof router.push>[0])}
                        >
                            <MaterialCommunityIcons name="cloud-alert-outline" size={16} color={colors.warning} />
                            <Text style={[s.syncAlertText, { color: colors.warning }]}>
                                {blockedCount} local change(s) are waiting for a sync-capable plan.
                            </Text>
                        </Pressable>
                    ) : null}
                </View>

                <View style={s.section}>
                    <SectionHeading title="At A Glance" meta="Revenue, sync, plan" />
                    <View style={s.metricGrid}>
                        {overviewCards.map((entry) => (
                            <HubMetricCard
                                key={entry.label}
                                label={entry.label}
                                value={entry.value}
                                meta={entry.meta}
                                tone={entry.tone}
                            />
                        ))}
                    </View>
                </View>

                <View style={s.section}>
                    <SectionHeading title="Quick Workflows" meta="Most-used routes" />
                    <View style={s.quickGrid}>
                        {quickActions.map((action) => (
                            <HubActionCard
                                key={action.key}
                                title={action.label}
                                subtitle={action.description ?? 'Open workflow'}
                                icon={action.icon}
                                tone="info"
                                onPress={() => router.push(action.route as Parameters<typeof router.push>[0])}
                            />
                        ))}
                    </View>
                </View>

                <View style={s.section}>
                    <SectionHeading title="Recent Invoices" meta={recentInvoices.length > 0 ? `${recentInvoices.length} recent` : 'No recent activity'} />
                    <View style={s.listCard}>
                        {recentInvoices.length === 0 ? (
                            <View style={s.emptyCard}>
                                <MaterialCommunityIcons name="file-document-outline" size={24} color={colors.textSecondary} />
                                <Text style={[s.emptyTitle, { color: colors.text }]}>No invoices this month</Text>
                                <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>
                                    Create your first sale, purchase, or estimate from the quick workflows above.
                                </Text>
                            </View>
                        ) : recentInvoices.map((invoice, index) => (
                            <Pressable
                                key={invoice.id}
                                style={[
                                    s.invoiceRow,
                                    index < recentInvoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: withAlpha(colors.border, '88') },
                                ]}
                                onPress={() => router.push(`/(main)/billing/${invoice.id}` as Parameters<typeof router.push>[0])}
                            >
                                <View style={s.invoiceLeft}>
                                    <Text style={[s.invoiceNumber, { color: colors.text }]}>{invoice.invoiceNumber}</Text>
                                    <Text style={[s.invoiceParty, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {invoice.partySnapshot?.name ?? invoice.party?.name ?? 'Walk-in'} · {formatInvoiceDate(invoice.invoiceDate)}
                                    </Text>
                                </View>
                                <View style={s.invoiceRight}>
                                    <Text style={[s.invoiceAmount, { color: colors.text }]}>
                                        Rs {Math.round(invoice.totalInvoiceValue).toLocaleString('en-IN')}
                                    </Text>
                                    <Text
                                        style={[
                                            s.invoiceStatus,
                                            {
                                                color: invoice.paymentStatus === 'PAID'
                                                    ? colors.success
                                                    : invoice.paymentStatus === 'OVERDUE'
                                                        ? colors.error
                                                        : colors.warning,
                                            },
                                        ]}
                                    >
                                        {invoice.paymentStatus}
                                    </Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View style={s.section}>
                    <SectionHeading title="Pending Actions" meta="Items to clear next" />
                    <View style={s.quickGrid}>
                        <HubActionCard
                            title="Outstanding receivables"
                            subtitle={`Rs ${Math.round(customerStats?.totalReceivable ?? 0).toLocaleString('en-IN')} still open`}
                            icon="account-cash-outline"
                            tone={customerStats?.totalReceivable ? 'warning' as const : 'success' as const}
                            onPress={() => router.push('/(main)/parties?tab=customer' as Parameters<typeof router.push>[0])}
                        />
                        <HubActionCard
                            title="Payables to settle"
                            subtitle={`Rs ${Math.round(supplierStats?.totalPayable ?? 0).toLocaleString('en-IN')} vendor liability`}
                            icon="briefcase-outline"
                            tone={supplierStats?.totalPayable ? 'danger' as const : 'info' as const}
                            onPress={() => router.push('/(main)/parties?tab=supplier' as Parameters<typeof router.push>[0])}
                        />
                        <HubActionCard
                            title="Sync queue"
                            subtitle={blockedCount > 0 ? `${blockedCount} blocked change(s)` : `${pendingCount} queued for cloud`}
                            icon="cloud-sync-outline"
                            tone={blockedCount > 0 ? 'warning' as const : pendingCount > 0 ? 'info' as const : 'success' as const}
                            onPress={() => router.push('/(main)/more/sync' as Parameters<typeof router.push>[0])}
                        />
                        <HubActionCard
                            title="Offers & plans"
                            subtitle={offers[0]?.title ?? 'See plans, offers, and sync upgrades'}
                            icon="ticket-percent-outline"
                            tone="info"
                            onPress={() => router.push('/(main)/more/subscription' as Parameters<typeof router.push>[0])}
                        />
                    </View>
                </View>

                <Pressable
                    style={s.directoryCard}
                    onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}
                >
                    <View style={s.directoryIcon}>
                        <MaterialCommunityIcons name="compass-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={s.directoryCopy}>
                        <Text style={[s.directoryTitle, { color: colors.text }]}>Open screen directory</Text>
                        <Text style={[s.directorySubtitle, { color: colors.textSecondary }]}>
                            Jump directly into billing, inventory, reports, settings, and legal routes.
                        </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

function percentageMeta(current?: number, previous?: number) {
    if (!previous || previous === 0 || current === undefined) {
        return 'Compared with last month';
    }
    const delta = ((current - previous) / previous) * 100;
    const sign = delta >= 0 ? '+' : '-';
    return `${sign}${Math.abs(delta).toFixed(1)}% vs last month`;
}

function SectionHeading({ title, meta }: { title: string; meta?: string }) {
    const colors = useAppColors();

    return (
        <View style={sectionStyles.row}>
            <Text style={[sectionStyles.title, { color: colors.text }]}>{title}</Text>
            {meta ? <Text style={[sectionStyles.meta, { color: colors.textSecondary }]}>{meta}</Text> : null}
        </View>
    );
}

function MetaPill({ label, colors }: { label: string; colors: ColorPalette }) {
    return (
        <View style={[metaStyles.pill, getInsetPanelStyle(colors)]}>
            <Text style={[metaStyles.label, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingHorizontal: DESIGN_SPACING.screenX,
        paddingBottom: 120,
        gap: DESIGN_SPACING.sectionGap,
    },
    tierBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        ...getInsetPanelStyle(colors, colors.primary),
    },
    tierText: {
        fontSize: 11,
        fontWeight: '800',
    },
    heroCard: {
        borderRadius: Radius.card,
        padding: Spacing.lg,
        gap: Spacing.md,
        ...getSurfaceStyle(colors, { accent: colors.primary }),
    },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
    },
    heroCopy: {
        flex: 1,
        gap: 4,
    },
    eyebrow: {
        fontSize: Typography.caption.size,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    heroTitle: {
        fontSize: Typography.headline.size,
        fontWeight: '700',
        lineHeight: 30,
    },
    heroSubtitle: {
        fontSize: Typography.body.size,
        lineHeight: 22,
    },
    heroBadge: {
        width: 44,
        height: 44,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(colors.primary, '12'),
    },
    heroMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    syncAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: withAlpha(colors.warning, '12'),
        borderWidth: 1,
        borderColor: withAlpha(colors.warning, '24'),
    },
    syncAlertText: {
        flex: 1,
        fontSize: Typography.caption.size,
        fontWeight: '700',
        lineHeight: 18,
    },
    section: {
        gap: Spacing.sm,
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    quickGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    listCard: {
        borderRadius: Radius.card,
        overflow: 'hidden',
        ...getSurfaceStyle(colors),
    },
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xl,
        gap: Spacing.sm,
    },
    emptyTitle: {
        fontSize: Typography.title.size,
        fontWeight: '700',
    },
    emptySubtitle: {
        fontSize: Typography.body.size,
        lineHeight: 20,
        textAlign: 'center',
    },
    invoiceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    invoiceLeft: {
        flex: 1,
        gap: 2,
    },
    invoiceRight: {
        alignItems: 'flex-end',
        gap: 2,
    },
    invoiceNumber: {
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    invoiceParty: {
        fontSize: Typography.caption.size,
    },
    invoiceAmount: {
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    invoiceStatus: {
        fontSize: 11,
        fontWeight: '800',
    },
    directoryCard: {
        borderRadius: Radius.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        ...getSurfaceStyle(colors),
    },
    directoryIcon: {
        width: 40,
        height: 40,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(colors.primary, '12'),
    },
    directoryCopy: {
        flex: 1,
        gap: 2,
    },
    directoryTitle: {
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    directorySubtitle: {
        fontSize: Typography.caption.size,
        lineHeight: 18,
    },
});

const sectionStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    title: {
        fontSize: Typography.title.size,
        fontWeight: '700',
    },
    meta: {
        fontSize: Typography.caption.size,
        fontWeight: '600',
    },
});

const metaStyles = StyleSheet.create({
    pill: {
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
    },
    label: {
        fontSize: Typography.caption.size,
        fontWeight: '700',
    },
});
