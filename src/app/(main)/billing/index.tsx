import { useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { usePermissions } from '../../../hooks/usePermissions';
import { useInvoices, formatInvoiceDate, type InvoiceDateRange, type InvoiceStatusFilter, type InvoiceQueryType } from '../../../hooks/useInvoices';
import type { Invoice } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { useHaptics } from '../../../hooks/useHaptics';

type BillingTab = 'sales' | 'purchases' | 'orders';

const TAB_OPTIONS: { key: BillingTab; label: string; queryType: InvoiceQueryType; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { key: 'sales', label: 'Sales', queryType: 'TAX_INVOICE', icon: 'file-document-outline' },
    { key: 'purchases', label: 'Purchases', queryType: 'PURCHASE_BILL', icon: 'cart-outline' },
    { key: 'orders', label: 'Orders', queryType: 'ESTIMATE', icon: 'clipboard-outline' },
];

const CREATE_OPTIONS: { label: string; route: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { label: 'Sale Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', icon: 'file-document-plus-outline' },
    { label: 'Quick Sale (POS)', route: '/(main)/billing/pos', icon: 'point-of-sale' },
    { label: 'Purchase Bill', route: '/(main)/billing/purchase-bill', icon: 'cart-plus' },
    { label: 'Sale Return', route: '/(main)/billing/sale-return', icon: 'undo-variant' },
    { label: 'Purchase Return', route: '/(main)/billing/purchase-return', icon: 'redo-variant' },
    { label: 'Estimate', route: '/(main)/billing/estimate', icon: 'file-document-edit-outline' },
    { label: 'Sale Order', route: '/(main)/billing/sale-order', icon: 'clipboard-text-outline' },
    { label: 'Purchase Order', route: '/(main)/billing/purchase-order', icon: 'clipboard-list-outline' },
    { label: 'Delivery Challan', route: '/(main)/billing/delivery-challan', icon: 'truck-delivery-outline' },
    { label: 'Payment In', route: '/(main)/billing/payment-in', icon: 'cash-plus' },
    { label: 'Payment Out', route: '/(main)/billing/payment-out', icon: 'cash-minus' },
];

const DATE_FILTERS: { key: InvoiceDateRange; label: string }[] = [
    { key: 'all', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
];

const STATUS_FILTERS: { key: InvoiceStatusFilter; label: string; color?: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'credit', label: 'Credit' },
];

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

    const queryType = TAB_OPTIONS.find((t) => t.key === activeTab)?.queryType ?? 'TAX_INVOICE';

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
                rightAction={(
                    <Pressable onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}>
                        <MaterialCommunityIcons name="compass-outline" size={20} color={colors.primary} />
                    </Pressable>
                )}
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
                        {/* Summary Metrics */}
                        <View style={s.metricsRow}>
                            {[
                                { label: 'Total', value: String(summary.total), color: colors.text },
                                { label: 'Paid', value: String(summary.paid), color: colors.success },
                                { label: 'Overdue', value: String(summary.overdue), color: colors.error },
                            ].map((m) => (
                                <View key={m.label} style={[s.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[s.metricLabel, { color: colors.textSecondary }]}>{m.label}</Text>
                                    <Text style={[s.metricValue, { color: m.color }]}>{m.value}</Text>
                                </View>
                            ))}
                        </View>
                        <View style={[s.dueCard, { backgroundColor: withAlpha(colors.primary, '12'), borderColor: withAlpha(colors.primary, '30') }]}>
                            <MaterialCommunityIcons name="cash-clock" size={16} color={colors.primary} />
                            <Text style={[s.dueLabel, { color: colors.textSecondary }]}>Outstanding</Text>
                            <Text style={[s.dueValue, { color: colors.primary }]}>Rs {summary.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                        </View>

                        {/* Tabs */}
                        <View style={s.tabs}>
                            {TAB_OPTIONS.map((tab) => {
                                const sel = activeTab === tab.key;
                                return (
                                    <Pressable key={tab.key} style={[s.tab, sel && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                        onPress={() => { void selection(); setActiveTab(tab.key); }}>
                                        <MaterialCommunityIcons name={tab.icon} size={13} color={sel ? colors.onPrimary : colors.textSecondary} />
                                        <Text style={[s.tabText, { color: sel ? colors.onPrimary : colors.textSecondary, fontWeight: sel ? '700' : '500' }]}>{tab.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Date filters */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersRow}>
                            {DATE_FILTERS.map((df) => {
                                const sel = dateRange === df.key;
                                return (
                                    <Pressable key={df.key} style={[s.filterChip, sel && { backgroundColor: colors.primary }]}
                                        onPress={() => { void selection(); setDateRange(df.key); }}>
                                        <Text style={[s.filterChipText, { color: sel ? colors.onPrimary : colors.textSecondary, fontWeight: sel ? '700' : '500' }]}>{df.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        {/* Status filters */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersRow}>
                            {STATUS_FILTERS.map((sf) => {
                                const sel = statusFilter === sf.key;
                                const chipColor = sf.key === 'paid' ? colors.success : sf.key === 'overdue' ? colors.error : sf.key === 'credit' ? colors.warning : colors.primary;
                                return (
                                    <Pressable key={sf.key} style={[s.filterChip, sel && { backgroundColor: chipColor }]}
                                        onPress={() => { void selection(); setStatusFilter(sf.key); }}>
                                        <Text style={[s.filterChipText, { color: sel ? colors.onPrimary : colors.textSecondary, fontWeight: sel ? '700' : '500' }]}>{sf.label}</Text>
                                    </Pressable>
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
                        <View style={s.centered}>
                                <MaterialCommunityIcons name="file-document-outline" size={36} color={colors.textSecondary} />
                                <Text style={{ color: colors.textSecondary, marginTop: Spacing.sm }}>No transactions found</Text>
                        </View>
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
                            {CREATE_OPTIONS.map((option) => {
                                if (!canPos && option.route.endsWith('/billing/pos')) return null;
                                return (
                                    <Pressable
                                        key={option.label}
                                        style={({ pressed }) => [s.sheetOption, { backgroundColor: pressed ? withAlpha(colors.primary, '14') : colors.surfaceVariant, borderColor: colors.border }]}
                                        onPress={() => { void selection(); setCreateSheetOpen(false); router.push(option.route as Parameters<typeof router.push>[0]); }}
                                    >
                                        <View style={[s.sheetOptionIcon, { backgroundColor: withAlpha(colors.primary, '16') }]}>
                                            <MaterialCommunityIcons name={option.icon} size={16} color={colors.primary} />
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
            style={({ pressed }) => [rowStyles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
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
    searchWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    metricsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    metricCard: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
    metricLabel: { fontSize: Typography.caption.size, fontWeight: '600' },
    metricValue: { marginTop: 2, fontSize: Typography.title.size, fontWeight: '800' },
    dueCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.card, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    dueLabel: { fontSize: Typography.caption.size, fontWeight: '600' },
    dueValue: { marginLeft: 'auto', fontSize: Typography.body.size, fontWeight: '800' },
    tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.sm },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.pill, backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border },
    tabText: { fontSize: 12 },
    filtersScroll: { flexGrow: 0, marginBottom: 4 },
    filtersRow: { paddingHorizontal: Spacing.lg, gap: Spacing.xs },
    filterChip: { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: colors.surfaceVariant },
    filterChipText: { fontSize: 12 },
    fab: { position: 'absolute', right: Spacing.lg, bottom: Spacing.xl, width: 56, height: 56, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
    fabText: { fontSize: 28, lineHeight: 30, fontWeight: '700' },
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: Spacing.lg, paddingBottom: 32, paddingTop: Spacing.sm, maxHeight: '80%' },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: Spacing.sm },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    sheetTitle: { fontSize: Typography.title.size, fontWeight: '700' },
    sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.md },
    sheetOption: { width: '48%', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    sheetOptionIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    sheetOptionText: { fontSize: 13, fontWeight: '600', flex: 1 },
    centered: { paddingTop: 80, alignItems: 'center', gap: Spacing.sm },
});

const rowStyles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.card, borderWidth: 1 },
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
