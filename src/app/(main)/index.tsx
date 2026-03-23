import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useAppRuntime } from '../../components/providers/AppRuntimeProvider';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import { useInvoices, formatInvoiceDate } from '../../hooks/useInvoices';
import { useParties } from '../../hooks/useParties';
import { useReportSummary } from '../../hooks/useReports';
import { useActiveOffers } from '../../hooks/useOffers';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { shareBusinessCardDocument } from '../../utils/businessCardDocument';

export default function HomeScreen() {
    const colors = useAppColors();
    const dialog = useAppDialog();
    const s = styles(colors);
    const { user, business, tierLabel, subscription, role, refresh } = useCurrentBusiness();
    const { syncStats, refreshSyncState } = useAppRuntime();
    const syncStatus = useSyncStatus();
    const [upgradePromptShown, setUpgradePromptShown] = useState(false);
    const [sharingBusinessCard, setSharingBusinessCard] = useState(false);

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

    const bannerCards = useMemo(() => ([
        {
            key: 'sales',
            eyebrow: 'Sales Mode',
            title: `${invoiceSummary.total} invoices this month`,
            subtitle: `Revenue at Rs ${Math.round(summary?.totalSales ?? 0).toLocaleString('en-IN')}`,
            icon: 'receipt-text-outline' as const,
            accent: colors.primary,
            route: '/(main)/billing',
        },
        {
            key: 'inventory',
            eyebrow: 'Inventory Pulse',
            title: `${customerStats?.totalCustomers ?? 0} customer touchpoints`,
            subtitle: 'Open items, stock updates, and supply movement from one place.',
            icon: 'archive-outline' as const,
            accent: colors.info,
            route: '/(main)/inventory',
        },
        {
            key: 'accounts',
            eyebrow: 'Collections',
            title: `Rs ${Math.round(invoiceSummary.outstanding ?? 0).toLocaleString('en-IN')} pending`,
            subtitle: blockedCount > 0 ? `${blockedCount} sync blockers need a plan update.` : 'Receivables, payables, and ledgers stay in one flow.',
            icon: 'bank-outline' as const,
            accent: colors.success,
            route: '/(main)/accounts',
        },
        {
            key: 'reports',
            eyebrow: 'Reports',
            title: 'Share balance and GST exports',
            subtitle: 'Open trial balance, balance sheet, and tax-ready summaries from one place.',
            icon: 'chart-timeline-variant' as const,
            accent: colors.warning,
            route: '/(main)/reports',
        },
    ]), [
        blockedCount,
        colors.info,
        colors.primary,
        colors.success,
        colors.warning,
        customerStats?.totalCustomers,
        invoiceSummary.outstanding,
        invoiceSummary.total,
        summary?.totalSales,
    ]);

    const businessCardMeta = useMemo(() => {
        const location = [business?.city, business?.state].filter(Boolean).join(', ');
        return {
            name: business?.name ?? 'Your Business',
            legalName: business?.legalName,
            ownerName: user?.name,
            phone: business?.phone ?? user?.phone ?? null,
            email: business?.email ?? user?.email ?? null,
            gstin: business?.gstin,
            address: business?.address,
            location,
        };
    }, [
        business?.address,
        business?.city,
        business?.email,
        business?.gstin,
        business?.legalName,
        business?.name,
        business?.phone,
        business?.state,
        user?.email,
        user?.name,
        user?.phone,
    ]);

    const quickActionAccent = useMemo<Record<string, string>>(() => ({
        'sale-invoice': colors.primary,
        'pos-sale': colors.success,
        'purchase-bill': colors.warning,
        estimate: colors.info,
        expense: colors.error,
        'add-item': colors.primaryVariant,
    }), [colors.error, colors.info, colors.primary, colors.primaryVariant, colors.success, colors.warning]);

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

    const handleShareBusinessCard = () => {
        setSharingBusinessCard(true);
        void shareBusinessCardDocument({
            businessName: businessCardMeta.name,
            legalName: businessCardMeta.legalName,
            ownerName: businessCardMeta.ownerName,
            phone: businessCardMeta.phone,
            email: businessCardMeta.email,
            gstin: businessCardMeta.gstin,
            address: businessCardMeta.address,
            city: business?.city,
            state: business?.state,
        })
            .catch((error) => {
                const message = error instanceof Error ? error.message : 'Unable to share the business card.';
                dialog.alert('Share failed', message);
            })
            .finally(() => {
                setSharingBusinessCard(false);
            });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={business?.name ?? 'Dashboard'}
                subtitle={`Hello ${user?.name?.split(' ')[0] ?? 'there'}`}
                rightAction={(
                    <Pressable
                        style={s.tierBadge}
                        onPress={() => router.push('/(main)/settings/subscription' as Parameters<typeof router.push>[0])}
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
                            <Text style={[s.eyebrow, { color: colors.primary }]}>Daily Control</Text>
                            <Text style={[s.heroTitle, { color: colors.text }]}>Billing, accounts, stock, and sync in one calmer workspace.</Text>
                            <Text style={[s.heroSubtitle, { color: colors.textSecondary }]}>
                                Grouped shortcuts, live sync health, and the next actions stay visible without turning the dashboard noisy.
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
                            onPress={() => router.push('/(main)/settings/subscription' as Parameters<typeof router.push>[0])}
                        >
                            <MaterialCommunityIcons name="cloud-alert-outline" size={16} color={colors.warning} />
                            <Text style={[s.syncAlertText, { color: colors.warning }]}>
                                {blockedCount} local change(s) are waiting for a sync-capable plan.
                            </Text>
                        </Pressable>
                    ) : null}
                </View>

                <View style={s.section}>
                    <SectionHeading title="Working Cards" meta="Swipe for pinned views" />
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.bannerRail}
                    >
                        {bannerCards.map((card) => (
                            <Pressable
                                key={card.key}
                                style={[
                                    s.bannerCard,
                                    {
                                        borderColor: withAlpha(card.accent, colors.isDark ? '42' : '24'),
                                        backgroundColor: withAlpha(card.accent, colors.isDark ? '1C' : '0F'),
                                    },
                                ]}
                                onPress={() => router.push(card.route as Parameters<typeof router.push>[0])}
                            >
                                <View style={[s.bannerOrb, { backgroundColor: withAlpha(card.accent, colors.isDark ? '3A' : '18') }]} />
                                <View style={s.bannerHead}>
                                    <Text style={[s.bannerEyebrow, { color: card.accent }]}>{card.eyebrow}</Text>
                                    <View style={[s.bannerIconWrap, { borderColor: withAlpha(card.accent, colors.isDark ? '4C' : '28'), backgroundColor: withAlpha(card.accent, colors.isDark ? '2A' : '14') }]}>
                                        <MaterialCommunityIcons name={card.icon} size={18} color={card.accent} />
                                    </View>
                                </View>
                                <Text style={[s.bannerTitle, { color: colors.text }]}>{card.title}</Text>
                                <Text style={[s.bannerSubtitle, { color: colors.textSecondary }]}>{card.subtitle}</Text>
                                <View style={s.bannerFooter}>
                                    <Text style={[s.bannerFooterText, { color: card.accent }]}>Open</Text>
                                    <MaterialCommunityIcons name="arrow-right" size={16} color={card.accent} />
                                </View>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                <View style={s.section}>
                    <SectionHeading title="Business Card" meta="Preview and share" />
                    <View style={s.businessCardSection}>
                        <View style={s.businessCardPanel}>
                            <View style={s.businessCardGlow} />
                            <View style={s.businessCardTop}>
                                <View style={s.businessCardTopCopy}>
                                    <Text style={[s.businessCardEyebrow, { color: colors.success }]}>Billing • GST • Business</Text>
                                    <Text style={[s.businessCardPanelName, { color: colors.text }]}>
                                        {businessCardMeta.name}
                                    </Text>
                                    {businessCardMeta.legalName ? (
                                        <Text style={[s.businessCardPanelLegal, { color: colors.textSecondary }]}>
                                            {businessCardMeta.legalName}
                                        </Text>
                                    ) : null}
                                    {businessCardMeta.ownerName ? (
                                        <Text style={[s.businessCardPanelOwner, { color: colors.success }]}>
                                            {businessCardMeta.ownerName}
                                        </Text>
                                    ) : null}
                                </View>
                                <View style={[s.businessCardScan, { borderColor: withAlpha(colors.success, '32') }]}>
                                    <Text style={[s.businessCardScanText, { color: colors.success }]}>SCAN</Text>
                                </View>
                            </View>

                            <View style={s.businessCardInfo}>
                                {businessCardMeta.phone ? (
                                    <Text style={[s.businessCardInfoText, { color: colors.text }]}>
                                        {businessCardMeta.phone}
                                    </Text>
                                ) : null}
                                {businessCardMeta.email ? (
                                    <Text style={[s.businessCardInfoText, { color: colors.text }]}>
                                        {businessCardMeta.email}
                                    </Text>
                                ) : null}
                                {businessCardMeta.gstin ? (
                                    <Text style={[s.businessCardInfoText, { color: colors.textSecondary }]}>
                                        GSTIN {businessCardMeta.gstin}
                                    </Text>
                                ) : null}
                                {businessCardMeta.address ? (
                                    <Text style={[s.businessCardInfoText, { color: colors.textSecondary }]}>
                                        {businessCardMeta.address}
                                    </Text>
                                ) : null}
                                {businessCardMeta.location ? (
                                    <Text style={[s.businessCardInfoText, { color: colors.textSecondary }]}>
                                        {businessCardMeta.location}
                                    </Text>
                                ) : null}
                            </View>

                            <View style={s.businessCardFooter}>
                                <Text style={[s.businessCardFooterText, { color: colors.textSecondary }]}>
                                    Share this card so customers can save your billing contact and GST identity quickly.
                                </Text>
                                <MetaPill label={tierLabel} colors={colors} />
                            </View>
                        </View>

                        <View style={s.businessCardActions}>
                            <Pressable
                                style={[s.businessActionPrimary, { backgroundColor: colors.success }]}
                                onPress={handleShareBusinessCard}
                                disabled={sharingBusinessCard}
                            >
                                {sharingBusinessCard ? (
                                    <ActivityIndicator size="small" color={colors.onPrimary} />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="share-variant-outline" size={16} color={colors.onPrimary} />
                                        <Text style={s.businessActionPrimaryText}>Share Card</Text>
                                    </>
                                )}
                            </Pressable>

                            <Pressable
                                style={[s.businessActionSecondary, { borderColor: withAlpha(colors.primary, colors.isDark ? '48' : '26') }]}
                                onPress={() => router.push('/(main)/settings/printing' as Parameters<typeof router.push>[0])}
                            >
                                <MaterialCommunityIcons name="palette-outline" size={16} color={colors.primary} />
                                <Text style={[s.businessActionSecondaryText, { color: colors.primary }]}>Customize</Text>
                            </Pressable>
                        </View>
                    </View>
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
                                accentColor={quickActionAccent[action.key] ?? colors.primary}
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
                            onPress={() => router.push('/(main)/settings/sync' as Parameters<typeof router.push>[0])}
                        />
                        <HubActionCard
                            title="Offers & plans"
                            subtitle={offers[0]?.title ?? 'See plans, offers, and sync upgrades'}
                            icon="ticket-percent-outline"
                            tone="info"
                            onPress={() => router.push('/(main)/settings/subscription' as Parameters<typeof router.push>[0])}
                        />
                    </View>
                </View>
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
    bannerRail: {
        gap: Spacing.sm,
        paddingRight: Spacing.sm,
    },
    bannerCard: {
        width: 276,
        minHeight: 172,
        borderRadius: Radius.card,
        padding: Spacing.lg,
        borderWidth: 1,
        overflow: 'hidden',
        gap: Spacing.sm,
    },
    bannerOrb: {
        position: 'absolute',
        width: 136,
        height: 136,
        borderRadius: 68,
        top: -42,
        right: -24,
    },
    bannerHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    bannerEyebrow: {
        fontSize: Typography.caption.size,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    bannerIconWrap: {
        width: 38,
        height: 38,
        borderRadius: Radius.md,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerTitle: {
        fontSize: 20,
        fontWeight: '800',
        lineHeight: 26,
        maxWidth: '88%',
    },
    bannerSubtitle: {
        fontSize: Typography.body.size,
        lineHeight: 20,
        maxWidth: '92%',
    },
    bannerFooter: {
        marginTop: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    bannerFooterText: {
        fontSize: Typography.caption.size,
        fontWeight: '800',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    section: {
        gap: Spacing.sm,
    },
    businessCardSection: {
        gap: Spacing.sm,
    },
    businessCardPanel: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: Radius.card,
        padding: Spacing.lg,
        gap: Spacing.md,
        ...getSurfaceStyle(colors, { accent: colors.success, elevated: true }),
    },
    businessCardGlow: {
        position: 'absolute',
        width: 164,
        height: 164,
        borderRadius: 82,
        top: -54,
        right: -22,
        backgroundColor: withAlpha(colors.success, colors.isDark ? '1E' : '12'),
    },
    businessCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: Spacing.md,
    },
    businessCardTopCopy: {
        flex: 1,
        gap: 4,
    },
    businessCardEyebrow: {
        fontSize: Typography.caption.size,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    businessCardPanelName: {
        fontSize: 24,
        fontWeight: '800',
        lineHeight: 30,
    },
    businessCardPanelLegal: {
        fontSize: Typography.body.size,
        fontWeight: '600',
        lineHeight: 20,
    },
    businessCardPanelOwner: {
        marginTop: 4,
        fontSize: Typography.caption.size,
        fontWeight: '800',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    businessCardScan: {
        width: 58,
        height: 58,
        borderRadius: Radius.lg,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(colors.success, colors.isDark ? '18' : '10'),
    },
    businessCardScanText: {
        fontSize: 11,
        fontWeight: '800',
    },
    businessCardInfo: {
        gap: 4,
    },
    businessCardInfoText: {
        fontSize: Typography.body.size,
        lineHeight: 20,
        fontWeight: '600',
    },
    businessCardFooter: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: Spacing.md,
    },
    businessCardFooterText: {
        flex: 1,
        fontSize: Typography.caption.size,
        lineHeight: 18,
        fontWeight: '600',
    },
    businessCardActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    businessActionPrimary: {
        flex: 1,
        minHeight: 46,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    businessActionPrimaryText: {
        color: colors.onPrimary,
        fontSize: Typography.caption.size,
        fontWeight: '800',
    },
    businessActionSecondary: {
        flex: 1,
        minHeight: 46,
        borderRadius: Radius.pill,
        borderWidth: 1,
        paddingHorizontal: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        backgroundColor: withAlpha(colors.primary, colors.isDark ? '10' : '08'),
    },
    businessActionSecondaryText: {
        fontSize: Typography.caption.size,
        fontWeight: '800',
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
