import { useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BILLING_CREATE_OPTIONS, BILLING_DATE_FILTER_OPTIONS, BILLING_STATUS_FILTER_OPTIONS, BILLING_TAB_OPTIONS } from '../../../constants/billingOptions';
import { DESIGN_SPACING, getShadowStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { usePermissions } from '../../../hooks/usePermissions';
import { useInvoices, formatInvoiceDate, type InvoiceDateRange, type InvoiceStatusFilter, type InvoiceQueryType } from '../../../hooks/useInvoices';
import type { Invoice } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { EmptyStateCard } from '../../../components/ui/ListBlocks';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useHaptics } from '../../../hooks/useHaptics';

type BillingTab = 'sales' | 'purchases' | 'orders';

export default function BillingScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const { selection, impact } = useHaptics();
    const { canPos } = usePermissions();

    const [activeTab, setActiveTab] = useState<BillingTab>('sales');
    const [search, setSearch] = useState('');
    const [dateRange, setDateRange] = useState<InvoiceDateRange>('all');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all');
    const [createSheetOpen, setCreateSheetOpen] = useState(false);

    const queryType = (BILLING_TAB_OPTIONS.find((t) => t.key === activeTab)?.queryType ?? 'TAX_INVOICE') as InvoiceQueryType;

    const { invoices, summary, isLoading, isRefetching, refetch } = useInvoices({
        type: queryType,
        search,
        dateRange,
        statusFilter,
    });

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
            <AppTopBar
                title="Billing"
                subtitle="Invoices, purchases & payments"
            />

            {/* Search */}
            <View style={s.searchWrap}>
                <AppSearchBar value={search} onChangeText={setSearch} placeholder="Search invoice no or party..." showScanAction={false} />
            </View>

            <FlatList
                data={invoices}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <InvoiceRow invoice={item} colors={colors} />}
                ListHeaderComponent={(
                    <>
                        <View style={s.heroWrap}>
                            <UtilityHero
                                title="Billing Hub"
                                subtitle="Invoices, purchases, orders, and payment status from one list."
                                icon="file-document-multiple-outline"
                                tone="info"
                            />
                        </View>
                        <View style={s.metricsRow}>
                            <HubMetricCard label="Total" value={String(summary.total)} meta="Visible rows" tone="default" />
                            <HubMetricCard label="Paid" value={String(summary.paid)} meta="Settled invoices" tone="success" />
                            <HubMetricCard label="Overdue" value={String(summary.overdue)} meta="Needs follow-up" tone="danger" />
                            <HubMetricCard
                                label="Outstanding"
                                value={`Rs ${summary.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                                meta="Open amount"
                                tone="warning"
                            />
                        </View>
                        <View style={s.tabs}>
                            {BILLING_TAB_OPTIONS.map((tab) => {
                                const sel = activeTab === tab.key;
                                return (
                                    <ChipButton
                                        key={tab.key}
                                        label={tab.label}
                                        icon={tab.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                                        selected={sel}
                                        tone="info"
                                        onPress={() => { void selection(); setActiveTab(tab.key); }}
                                    />
                                );
                            })}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersRow}>
                            {BILLING_DATE_FILTER_OPTIONS.map((df) => {
                                const sel = dateRange === df.key;
                                return (
                                    <ChipButton
                                        key={df.key}
                                        label={df.label}
                                        selected={sel}
                                        tone="info"
                                        onPress={() => { void selection(); setDateRange(df.key as InvoiceDateRange); }}
                                    />
                                );
                            })}
                        </ScrollView>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersRow}>
                            {BILLING_STATUS_FILTER_OPTIONS.map((sf) => {
                                const sel = statusFilter === sf.key;
                                const tone = sf.key === 'paid' ? 'success' : sf.key === 'overdue' ? 'danger' : sf.key === 'credit' ? 'warning' : 'info';
                                return (
                                    <ChipButton
                                        key={sf.key}
                                        label={sf.label}
                                        selected={sel}
                                        tone={tone}
                                        onPress={() => { void selection(); setStatusFilter(sf.key as InvoiceStatusFilter); }}
                                    />
                                );
                            })}
                        </ScrollView>
                    </>
                )}
                contentContainerStyle={{ paddingBottom: 120 }}
                ListEmptyComponent={
                    isLoading ? (
                        <ListSkeleton rows={6} />
                    ) : (
                        <EmptyStateCard
                            icon="file-document-outline"
                            title="No transactions found"
                            subtitle={search.trim().length > 0 ? 'Try a different party name, invoice number, date range, or status.' : 'Start a new billing document from the create sheet.'}
                            tone="info"
                        />
                    )
                }
                refreshControl={(
                    <RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => { void refetch(); }} tintColor={colors.primary} />
                )}
            />

            {/* FAB */}
            <Pressable style={[s.fab, { backgroundColor: colors.primary }]} onPress={() => { void impact(); setCreateSheetOpen(true); }}>
                <Text style={[s.fabText, { color: colors.onPrimary }]}>+</Text>
            </Pressable>

            {/* Create Sheet */}
            <Modal visible={createSheetOpen} transparent animationType="slide" onRequestClose={() => setCreateSheetOpen(false)}>
                <View style={s.modalRoot}>
                    <Pressable style={[s.backdrop, { backgroundColor: withAlpha(colors.text, '66') }]} onPress={() => setCreateSheetOpen(false)} />
                    <View style={[s.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={s.sheetHandle} />
                        <View style={s.sheetHeader}>
                            <Text style={[s.sheetTitle, { color: colors.text }]}>New Transaction</Text>
                            <Pressable onPress={() => setCreateSheetOpen(false)}>
                                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                            </Pressable>
                        </View>
                        <ScrollView contentContainerStyle={s.sheetGrid} showsVerticalScrollIndicator={false}>
                            {BILLING_CREATE_OPTIONS.map((option) => {
                                if (!canPos && option.route.endsWith('/billing/pos')) return null;
                                return (
                                    <Pressable
                                        key={option.label}
                                        style={({ pressed }) => [s.sheetOption, { opacity: pressed ? 0.86 : 1 }]}
                                        onPress={() => { void selection(); setCreateSheetOpen(false); router.push(option.route as Parameters<typeof router.push>[0]); }}
                                    >
                                        <View style={[s.sheetOptionIcon, { backgroundColor: withAlpha(colors.primary, '16') }]}>
                                            <MaterialCommunityIcons name={option.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={16} color={colors.primary} />
                                        </View>
                                        <Text style={[s.sheetOptionText, { color: colors.text }]}>{option.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function InvoiceRow({ invoice, colors }: { invoice: Invoice; colors: ColorPalette }) {
    const statusColor =
        invoice.paymentStatus === 'PAID' ? colors.success
            : invoice.paymentStatus === 'OVERDUE' ? colors.error
                : colors.warning;
    const partyName = invoice.partySnapshot?.name ?? invoice.party?.name ?? 'Walk-in';
    const rawType = invoice.invoiceType as string;
    const typeLabel = rawType === 'TAX_INVOICE' ? 'Sale'
        : rawType === 'PURCHASE_BILL' ? 'Purchase'
            : rawType === 'ESTIMATE' ? 'Estimate'
                : rawType === 'SALE_RETURN' || rawType === 'CREDIT_NOTE_DOC' ? 'Sale Return'
                    : rawType === 'PURCHASE_RETURN' || rawType === 'DEBIT_NOTE_DOC' ? 'Purchase Return'
                        : rawType.replace(/_/g, ' ').replace('DOC', '').trim();

    return (
        <Pressable
            style={({ pressed }) => [rowStyles.row, getSurfaceStyle(colors, { elevated: true }), { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push(`/(main)/billing/${invoice.id}` as Parameters<typeof router.push>[0])}
        >
            <View style={rowStyles.left}>
                <View style={rowStyles.topRow}>
                    <Text style={[rowStyles.number, { color: colors.text }]}>{invoice.invoiceNumber}</Text>
                    <View style={[rowStyles.typeBadge, { backgroundColor: withAlpha(colors.info, '18') }]}>
                        <Text style={[rowStyles.typeText, { color: colors.info }]}>{typeLabel}</Text>
                    </View>
                </View>
                <Text style={[rowStyles.party, { color: colors.text }]} numberOfLines={1}>{partyName}</Text>
                <Text style={[rowStyles.date, { color: colors.textSecondary }]}>{formatInvoiceDate(invoice.invoiceDate)}</Text>
            </View>
            <View style={rowStyles.right}>
                <Text style={[rowStyles.amount, { color: colors.text }]}>Rs {invoice.totalInvoiceValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                <View style={[rowStyles.statusBadge, { backgroundColor: withAlpha(statusColor, '22') }]}>
                    <Text style={[rowStyles.statusText, { color: statusColor }]}>{invoice.paymentStatus}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textSecondary} style={{ marginTop: 4 }} />
            </View>
        </Pressable>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    searchWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
    heroWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
    tabs: { flexDirection: 'row', paddingHorizontal: DESIGN_SPACING.screenX, gap: Spacing.sm, marginBottom: DESIGN_SPACING.cardGap },
    filtersScroll: { flexGrow: 0, marginBottom: 4 },
    filtersRow: { paddingHorizontal: DESIGN_SPACING.screenX, gap: Spacing.xs },
    fab: { position: 'absolute', right: Spacing.lg, bottom: Spacing.xl, width: 56, height: 56, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', ...getShadowStyle(colors, 'floating') },
    fabText: { fontSize: 28, lineHeight: 30, fontWeight: '700' },
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, borderBottomWidth: 0, paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: 32, paddingTop: Spacing.sm, maxHeight: '80%', ...getSurfaceStyle(colors, { floating: true, elevated: true }) },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: Spacing.sm },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    sheetTitle: { fontSize: Typography.title.size, fontWeight: '700' },
    sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.md },
    sheetOption: { width: '48%', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, ...getSurfaceStyle(colors, { muted: true, elevated: true }) },
    sheetOptionIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    sheetOptionText: { fontSize: 13, fontWeight: '600', flex: 1 },
});

const rowStyles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, marginHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.sm, borderRadius: Radius.card },
    left: { flex: 1 },
    right: { alignItems: 'flex-end' },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
    number: { fontWeight: '700', fontSize: 14 },
    typeBadge: { borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
    typeText: { fontSize: 10, fontWeight: '700' },
    party: { fontWeight: '600', fontSize: 13, marginTop: 1 },
    date: { fontSize: 11, marginTop: 1 },
    amount: { fontWeight: '700', fontSize: 15 },
    statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill, marginTop: 4 },
    statusText: { fontSize: 10, fontWeight: '700' },
});
