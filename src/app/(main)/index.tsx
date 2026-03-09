import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { canAccessModule, canUsePos } from '../../utils/accessControl';
import { HOME_QUICK_ACTIONS } from '../../constants/navigationOptions';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../constants/theme';
import { AppTopBar } from '../../components/ui/AppTopBar';
import { useHaptics } from '../../hooks/useHaptics';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useAppColors } from '../../hooks/useAppColors';
import { useAppRuntime } from '../../components/providers/AppRuntimeProvider';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import { useInvoices } from '../../hooks/useInvoices';
import { useParties } from '../../hooks/useParties';
import { useReportSummary } from '../../hooks/useReports';
import { useActiveOffers } from '../../hooks/useOffers';

export default function HomeScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const { user, business, tierLabel, subscription, role, refresh } = useCurrentBusiness();
    const { selection } = useHaptics();
    const dialog = useAppDialog();
    const { syncStats, refreshSyncState } = useAppRuntime();
    const [upgradePromptShown, setUpgradePromptShown] = useState(false);

    // Compute month range once per mount
    const today = new Date();
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
    const prevMonthStart = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
    const prevMonthEnd = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');

    // Refresh subscription/user on mount to prevent stale FREE-plan display
    useEffect(() => { void refresh(); }, [refresh]);

    // -- Report summary (server aggregated) --
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

    // -- Live invoice stats for this month (from hook) --
    const { summary: invoiceSummary, isLoading: invoicesLoading, refetch: refetchInvoices } = useInvoices({
        dateRange: 'month',
    });

    // -- Live party balance stats (per type) --
    const { stats: customerStats, isLoading: customerLoading, refetch: refetchCustomers } = useParties({ type: 'CUSTOMER' });
    const { stats: supplierStats, isLoading: supplierLoading, refetch: refetchSuppliers } = useParties({ type: 'SUPPLIER' });

    // -- Offers banner --
    const stats = summary;
    const prevStats = prevSummary;
    const { offers } = useActiveOffers({ staleTime: 60_000 });
    const blockedCount = syncStats.blockedCount;
    const isLoading = summaryLoading;
    const isRefetching = summaryRefetching;

    const quickActions = HOME_QUICK_ACTIONS.filter((action) => {
        if (action.requiresPos && !canUsePos(subscription)) return false;
        if (!action.module) return true;
        return canAccessModule(role, action.module, subscription);
    });

    const tierDisplay = tierLabel;
    useEffect(() => {
        if (upgradePromptShown || blockedCount <= 0) return;
        setUpgradePromptShown(true);
        dialog.alert(
            'Upgrade needed for cloud sync',
            `${blockedCount} queued change(s) are saved locally but blocked for cloud sync by current plan.`,
            [
                { text: 'Later', style: 'cancel' },
                { text: 'Upgrade', onPress: () => router.push('/(main)/more/subscription' as Parameters<typeof router.push>[0]) },
            ]
        );
    }, [blockedCount, dialog, upgradePromptShown]);

    const doRefresh = () => {
        void refetchSummary();
        void refreshSyncState();
        void refetchInvoices();
        void refetchCustomers();
        void refetchSuppliers();
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={business?.name ?? 'Dashboard'}
                subtitle={`Hello, ${user?.name?.split(' ')[0] ?? 'there'}`}
                rightAction={(
                    <Pressable style={[s.tierBadge, { backgroundColor: withAlpha(colors.primary, '22'), borderColor: colors.primary }]} onPress={() => router.push('/(main)/more')}>
                        <Text style={[s.tierText, { color: colors.primary }]}>{tierDisplay}</Text>
                    </Pressable>
                )}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={doRefresh} tintColor={colors.primary} />}
            >
                {blockedCount > 0 ? (
                    <Pressable
                        style={[s.banner, { borderColor: colors.warning, backgroundColor: withAlpha(colors.warning, '14') }]}
                        onPress={() => router.push('/(main)/more/subscription' as Parameters<typeof router.push>[0])}
                    >
                        <MaterialCommunityIcons name="cloud-alert-outline" size={15} color={colors.warning} />
                        <Text style={[s.bannerText, { color: colors.warning }]}>
                            {blockedCount} change(s) queued offline - upgrade to sync
                        </Text>
                    </Pressable>
                ) : null}
                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>THIS MONTH</Text>
                    <View style={s.statsGrid}>
                        <StatCard label="Sales" value={stats?.totalSales} prev={prevStats?.totalSales} prefix="Rs " loading={isLoading} color={colors.success} colors={colors} />
                        <StatCard label="Purchases" value={stats?.totalPurchases} prev={prevStats?.totalPurchases} prefix="Rs " loading={isLoading} color={colors.warning} colors={colors} />
                        <StatCard label="Expenses" value={stats?.totalExpenses} prev={prevStats?.totalExpenses} prefix="Rs " loading={isLoading} color={colors.error} colors={colors} />
                        <StatCard label="Net Profit" value={stats?.netProfit} prev={prevStats?.netProfit} prefix="Rs " loading={isLoading} color={colors.primary} colors={colors} />
                    </View>
                </View>
                {!invoicesLoading && invoiceSummary ? (
                    <View style={s.section}>
                        <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>INVOICES - THIS MONTH</Text>
                        <View style={s.invoiceRow}>
                            <InvoiceChip label="Total" value={invoiceSummary.total} color={colors.primary} colors={colors} />
                            <InvoiceChip label="Paid" value={invoiceSummary.paid} color={colors.success} colors={colors} />
                            <InvoiceChip label="Overdue" value={invoiceSummary.overdue} color={colors.error} colors={colors} />
                            <InvoiceChip
                                label="Outstanding"
                                value={invoiceSummary.outstanding}
                                prefix="Rs "
                                color={invoiceSummary.outstanding > 0 ? colors.warning : colors.textSecondary}
                                colors={colors}
                            />
                        </View>
                    </View>
                ) : null}
                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>OUTSTANDING</Text>
                    <View style={s.row}>
                        <OutstandingCard
                            label="Receivables"
                            value={customerStats?.totalReceivable ?? stats?.outstandingReceivables}
                            loading={customerLoading || isLoading}
                            color={colors.success}
                            count={customerStats?.totalCustomers}
                            colors={colors}
                            onPress={() => router.push('/(main)/parties?tab=customer' as Parameters<typeof router.push>[0])}
                        />
                        <OutstandingCard
                            label="Payables"
                            value={supplierStats?.totalPayable ?? stats?.outstandingPayables}
                            loading={supplierLoading || isLoading}
                            color={colors.error}
                            count={supplierStats?.totalSuppliers}
                            colors={colors}
                            onPress={() => router.push('/(main)/parties?tab=supplier' as Parameters<typeof router.push>[0])}
                        />
                    </View>
                </View>
                {offers.length > 0 ? (
                    <View style={s.section}>
                        {offers.slice(0, 2).map((offer) => (
                            <Pressable
                                key={offer.id}
                                style={[s.offerCard, { backgroundColor: withAlpha(colors.primary, '10'), borderColor: withAlpha(colors.primary, '30') }]}
                                onPress={() => { if (offer.ctaRoute) router.push(offer.ctaRoute as Parameters<typeof router.push>[0]); }}
                            >
                                <MaterialCommunityIcons name="star-four-points-outline" size={14} color={colors.primary} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.offerTitle, { color: colors.primary }]}>{offer.title}</Text>
                                    <Text style={[s.offerMessage, { color: colors.textSecondary }]}>{offer.message}</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
                            </Pressable>
                        ))}
                    </View>
                ) : null}
                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>QUICK CREATE</Text>
                    <View style={s.quickGrid}>
                        {quickActions.map((qa) => (
                            <Pressable
                                key={qa.label}
                                style={({ pressed }) => [s.quickCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
                                onPress={() => { void selection(); router.push(qa.route as Parameters<typeof router.push>[0]); }}
                                accessibilityRole="button"
                                accessibilityLabel={qa.label}
                            >
                                <View style={[s.quickIcon, { backgroundColor: withAlpha(colors.primary, '18') }]}>
                                    <MaterialCommunityIcons name={qa.icon} size={18} color={colors.primary} />
                                </View>
                                <Text style={[s.quickLabel, { color: colors.text }]}>{qa.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
                <View style={s.section}>
                    <Pressable
                        style={({ pressed }) => [s.directoryButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
                        onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}
                    >
                        <MaterialCommunityIcons name="compass-outline" size={16} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                            <Text style={[s.directoryTitle, { color: colors.text }]}>Open Screen Directory</Text>
                            <Text style={[s.directorySub, { color: colors.textSecondary }]}>Jump to billing, inventory, reports, settings, legal</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textSecondary} />
                    </Pressable>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function StatCard({ label, value, prev, prefix = '', loading, color, colors }: {
    label: string; value?: number; prev?: number; prefix?: string; loading: boolean; color: string; colors: ColorPalette;
}) {
    const pct = useMemo(() => {
        if (!prev || prev === 0 || value === undefined) return null;
        const p = ((value - prev) / prev) * 100;
        return { p: Math.abs(p).toFixed(1), up: value >= prev };
    }, [value, prev]);

    return (
        <View style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[cardStyles.label, { color: colors.textSecondary }]}>{label}</Text>
            {loading ? (
                <View style={[cardStyles.skeleton, { backgroundColor: colors.skeleton }]} />
            ) : (
                    <Text style={[cardStyles.value, { color }]}>
                        {prefix}{(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
            )}
            {pct ? (
                <View style={cardStyles.trendRow}>
                    <MaterialCommunityIcons name={pct.up ? 'trending-up' : 'trending-down'} size={11} color={pct.up ? colors.success : colors.error} />
                    <Text style={[cardStyles.trendText, { color: pct.up ? colors.success : colors.error }]}>{pct.p}%</Text>
                </View>
            ) : null}
        </View>
    );
}

function InvoiceChip({ label, value, prefix, color, colors }: {
    label: string; value: number; prefix?: string; color: string; colors: ColorPalette;
}) {
    return (
        <View style={[chipStyles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[chipStyles.chipVal, { color }]}>{prefix ?? ''}{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            <Text style={[chipStyles.chipLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );
}

function OutstandingCard({ label, value, loading, color, count, colors, onPress }: {
    label: string; value?: number; loading: boolean; color: string; count?: number; colors: ColorPalette; onPress: () => void;
}) {
    return (
        <Pressable style={({ pressed }) => [outStyles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]} onPress={onPress}>
            <Text style={[outStyles.label, { color: colors.textSecondary }]}>{label}</Text>
            {loading ? (
                <View style={[outStyles.skeleton, { backgroundColor: colors.skeleton }]} />
            ) : (
                    <Text style={[outStyles.value, { color }]}>Rs {(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            )}
            {count !== undefined ? <Text style={[outStyles.count, { color: colors.textSecondary }]}>{count} parties</Text> : null}
            <MaterialCommunityIcons name="chevron-right" size={14} color={colors.textSecondary} style={{ alignSelf: 'flex-end', marginTop: 4 }} />
        </Pressable>
    );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    tierBadge: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
    tierText: { fontWeight: '800', fontSize: 11 },
    banner: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: Spacing.sm, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
    bannerText: { fontSize: 12, fontWeight: '600', flex: 1 },
    section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    invoiceRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    row: { flexDirection: 'row', gap: Spacing.sm },
    offerCard: { borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    offerTitle: { fontWeight: '700', fontSize: 13 },
    offerMessage: { fontSize: 11, marginTop: 1 },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    quickCard: { width: '30%', borderWidth: 1, borderRadius: Radius.card, paddingVertical: Spacing.md, alignItems: 'center', gap: 6 },
    quickIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    quickLabel: { fontSize: 11, fontWeight: '600' },
    directoryButton: { borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    directoryTitle: { fontWeight: '700', fontSize: 13 },
    directorySub: { fontSize: 11, marginTop: 1 },
});

const cardStyles = StyleSheet.create({
    card: { flex: 1, minWidth: '45%', borderWidth: 1, borderRadius: Radius.card, padding: Spacing.sm, gap: 2 },
    label: { fontSize: 11, fontWeight: '600' },
    skeleton: { height: 18, borderRadius: 4, marginTop: 4 },
    value: { fontSize: Typography.title.size, fontWeight: '800' },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
    trendText: { fontSize: 10, fontWeight: '700' },
});

const chipStyles = StyleSheet.create({
    chip: { flex: 1, borderWidth: 1, borderRadius: Radius.card, padding: Spacing.sm, alignItems: 'center', gap: 2 },
    chipVal: { fontWeight: '800', fontSize: 16 },
    chipLabel: { fontSize: 10, fontWeight: '600' },
});

const outStyles = StyleSheet.create({
    card: { flex: 1, borderWidth: 1, borderRadius: Radius.card, padding: Spacing.md, gap: 2 },
    label: { fontSize: 11, fontWeight: '600' },
    skeleton: { height: 20, borderRadius: 4, marginTop: 4 },
    value: { fontSize: 18, fontWeight: '800', marginTop: 4 },
    count: { fontSize: 10, fontWeight: '600' },
});
