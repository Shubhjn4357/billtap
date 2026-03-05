import { useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { invoiceApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { PaymentStatus } from '../../../constants/enums';
import type { Invoice } from '../../../types/domain';
import { canUsePos } from '../../../utils/accessControl';
import { useAuthStore } from '../../../store/authStore';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { useHaptics } from '../../../hooks/useHaptics';

type BillingTab = 'sales' | 'purchases' | 'orders';

const TAB_OPTIONS: { key: BillingTab; label: string; queryType: string }[] = [
    { key: 'sales', label: 'Sales', queryType: 'TAX_INVOICE' },
    { key: 'purchases', label: 'Purchases', queryType: 'PURCHASE_BILL' },
    { key: 'orders', label: 'Orders', queryType: 'ESTIMATE' },
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
const EMPTY_INVOICES: Invoice[] = [];

const formatInvoiceDate = (value: string) => {
    try {
        return format(parseISO(value), 'dd MMM yyyy');
    } catch {
        return value.slice(0, 10);
    }
};

export default function BillingScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const { selection, impact } = useHaptics();

    const [activeTab, setActiveTab] = useState<BillingTab>('sales');
    const [search, setSearch] = useState('');
    const subscription = useAuthStore((state) => state.subscription);
    const showPos = canUsePos(subscription);

    const queryType = useMemo(
        () => TAB_OPTIONS.find((entry) => entry.key === activeTab)?.queryType ?? 'TAX_INVOICE',
        [activeTab]
    );

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['invoices', activeTab],
        queryFn: () => invoiceApi.list({ type: queryType, limit: 50 }),
        staleTime: 60_000,
    });

    const invoices = (data?.data as Invoice[] | undefined) ?? EMPTY_INVOICES;
    const filteredInvoices = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return invoices;
        return invoices.filter((entry) => {
            const byNo = entry.invoiceNumber.toLowerCase().includes(needle);
            const byParty = (entry.partySnapshot?.name ?? entry.party?.name ?? '').toLowerCase().includes(needle);
            return byNo || byParty;
        });
    }, [invoices, search]);
    const summary = useMemo(() => {
        let paid = 0;
        let due = 0;
        let overdue = 0;

        for (const entry of filteredInvoices) {
            if (entry.paymentStatus === PaymentStatus.PAID) paid += 1;
            if (entry.paymentStatus === PaymentStatus.OVERDUE) overdue += 1;
            if (entry.paymentStatus !== PaymentStatus.PAID) {
                due += Math.max(entry.totalInvoiceValue - (entry.paidAmount ?? 0), 0);
            }
        }

        return {
            total: filteredInvoices.length,
            paid,
            overdue,
            due,
        };
    }, [filteredInvoices]);
    const [createSheetOpen, setCreateSheetOpen] = useState(false);

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
            <AppTopBar
                title="Billing"
                subtitle="Sales, purchases, returns and payments"
                rightAction={(
                    <Pressable onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}>
                        <MaterialCommunityIcons name="compass-outline" size={20} color={colors.primary} />
                    </Pressable>
                )}
            />
            <View style={s.searchWrap}>
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search invoice no or party..."
                    showScanAction={false}
                />
            </View>

            <FlatList
                data={filteredInvoices}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <InvoiceRow invoice={item} colors={colors} />}
                ListHeaderComponent={
                    <>
                        <View style={s.metricsRow}>
                            <View style={[s.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[s.metricLabel, { color: colors.textSecondary }]}>Transactions</Text>
                                <Text style={[s.metricValue, { color: colors.text }]}>{summary.total}</Text>
                            </View>
                            <View style={[s.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[s.metricLabel, { color: colors.textSecondary }]}>Paid</Text>
                                <Text style={[s.metricValue, { color: colors.success }]}>{summary.paid}</Text>
                            </View>
                            <View style={[s.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[s.metricLabel, { color: colors.textSecondary }]}>Overdue</Text>
                                <Text style={[s.metricValue, { color: colors.error }]}>{summary.overdue}</Text>
                            </View>
                        </View>
                        <View style={[s.dueCard, { backgroundColor: withAlpha(colors.primary, '12'), borderColor: withAlpha(colors.primary, '30') }]}>
                            <MaterialCommunityIcons name="cash-clock" size={16} color={colors.primary} />
                            <Text style={[s.dueLabel, { color: colors.textSecondary }]}>Outstanding</Text>
                            <Text style={[s.dueValue, { color: colors.primary }]}>
                                Rs {summary.due.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </Text>
                        </View>
                        <View style={s.tabs}>
                            {TAB_OPTIONS.map((tab) => {
                                const selected = activeTab === tab.key;
                                return (
                                    <Pressable
                                        key={tab.key}
                                        style={[s.tab, selected && s.activeTab]}
                                        onPress={() => {
                                            void selection();
                                            setActiveTab(tab.key);
                                        }}
                                    >
                                        <Text style={[s.tabText, selected && s.activeTabText]}>{tab.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </>
                }
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={
                    isLoading ? (
                        <ListSkeleton rows={6} />
                    ) : (
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary }}>No transactions yet.</Text>
                        </View>
                    )
                }
                refreshControl={(
                    <RefreshControl
                        refreshing={isRefetching && !isLoading}
                        onRefresh={() => {
                            void refetch();
                        }}
                        tintColor={colors.primary}
                    />
                )}
            />

            <Pressable style={s.fab} onPress={() => {
                void impact();
                setCreateSheetOpen(true);
            }}>
                <Text style={s.fabText}>+</Text>
            </Pressable>

            <Modal
                visible={createSheetOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setCreateSheetOpen(false)}
            >
                <View style={s.modalRoot}>
                    <Pressable style={s.backdrop} onPress={() => setCreateSheetOpen(false)} />
                    <View style={[s.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={s.sheetHeader}>
                            <Text style={[s.sheetTitle, { color: colors.text }]}>Create Transaction</Text>
                            <Pressable onPress={() => setCreateSheetOpen(false)}>
                                <Text style={[s.sheetClose, { color: colors.primary }]}>Close</Text>
                            </Pressable>
                        </View>
                        <View style={s.sheetGrid}>
                            {CREATE_OPTIONS.map((option) => {
                                if (!showPos && option.route.endsWith('/billing/pos')) return null;
                                return (
                                    <Pressable
                                        key={option.label}
                                        style={[s.sheetOption, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                                        onPress={() => {
                                            void selection();
                                            setCreateSheetOpen(false);
                                            router.push(option.route as Parameters<typeof router.push>[0]);
                                        }}
                                    >
                                        <MaterialCommunityIcons name={option.icon} size={16} color={colors.primary} />
                                        <Text style={[s.sheetOptionText, { color: colors.text }]}>{option.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function InvoiceRow({ invoice, colors }: { invoice: Invoice; colors: ColorPalette }) {
    const statusColor =
        invoice.paymentStatus === PaymentStatus.PAID
            ? colors.success
            : invoice.paymentStatus === PaymentStatus.OVERDUE
                ? colors.error
                : colors.warning;
    const partyName = invoice.partySnapshot?.name ?? invoice.party?.name ?? 'Walk-in';

    return (
        <Pressable
            style={({ pressed }) => [rowStyles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push(`/(main)/billing/${invoice.id}` as Parameters<typeof router.push>[0])}
        >
            <View style={rowStyles.left}>
                <Text style={[rowStyles.number, { color: colors.text }]}>{invoice.invoiceNumber}</Text>
                <Text style={[rowStyles.party, { color: colors.text }]} numberOfLines={1}>{partyName}</Text>
                <Text style={[rowStyles.date, { color: colors.textSecondary }]}>{formatInvoiceDate(invoice.invoiceDate)}</Text>
            </View>
            <View style={rowStyles.right}>
                <Text style={[rowStyles.amount, { color: colors.text }]}>Rs {invoice.totalInvoiceValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                <View style={[rowStyles.statusBadge, { backgroundColor: withAlpha(statusColor, '22') }]}>
                    <Text style={[rowStyles.statusText, { color: statusColor }]}>{invoice.paymentStatus}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} style={rowStyles.chevron} />
            </View>
        </Pressable>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
        },
        title: { fontSize: Typography.headline.size, fontWeight: '700', color: colors.text },
        headerAction: { fontSize: Typography.body.size, fontWeight: '700' },
        searchWrap: {
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
        },
        metricsRow: {
            flexDirection: 'row',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
        },
        metricCard: {
            flex: 1,
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.sm,
        },
        metricLabel: {
            fontSize: Typography.caption.size,
            fontWeight: '600',
        },
        metricValue: {
            marginTop: 2,
            fontSize: Typography.title.size,
            fontWeight: '800',
        },
        dueCard: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
            borderRadius: Radius.card,
            borderWidth: 1,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        dueLabel: {
            fontSize: Typography.caption.size,
            fontWeight: '600',
        },
        dueValue: {
            marginLeft: 'auto',
            fontSize: Typography.body.size,
            fontWeight: '800',
        },
        fab: {
            position: 'absolute',
            right: Spacing.lg,
            bottom: Spacing.xl,
            width: 56,
            height: 56,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 8,
        },
        fabText: { color: colors.onPrimary, fontSize: 28, lineHeight: 30, fontWeight: '700' },
        modalRoot: { flex: 1, justifyContent: 'flex-end' },
        backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(colors.text, '66') },
        sheet: {
            borderTopLeftRadius: Radius.lg,
            borderTopRightRadius: Radius.lg,
            borderWidth: 1,
            borderBottomWidth: 0,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            gap: Spacing.sm,
        },
        sheetHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        sheetTitle: { fontSize: Typography.title.size, fontWeight: '700' },
        sheetClose: { fontSize: Typography.body.size, fontWeight: '700' },
        sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
        sheetOption: {
            width: '48%',
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            minHeight: 50,
            justifyContent: 'flex-start',
            alignItems: 'center',
            flexDirection: 'row',
            gap: Spacing.sm,
        },
        sheetOptionText: { fontSize: Typography.body.size, fontWeight: '600' },
        tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
        tab: {
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.lg,
            borderRadius: Radius.pill,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        activeTab: { backgroundColor: colors.primary, borderColor: colors.primary },
        tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
        activeTabText: { color: colors.onPrimary, fontWeight: '700' },
        centered: { paddingTop: 80, alignItems: 'center' },
    });

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
        borderRadius: Radius.card,
        borderWidth: 1,
    },
    left: { flex: 1 },
    right: { alignItems: 'flex-end' },
    number: { fontWeight: '600', fontSize: 14 },
    party: { fontWeight: '600', fontSize: 13, marginTop: 2 },
    date: { fontSize: 12, marginTop: 2 },
    amount: { fontWeight: '700', fontSize: 15 },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: Radius.pill,
        marginTop: 4,
    },
    statusText: { fontSize: 10, fontWeight: '700' },
    chevron: { marginTop: 6 },
});

