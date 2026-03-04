import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { invoiceApi } from '../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { PaymentStatus } from '../../constants/enums';
import type { Invoice } from '../../types/domain';
import { canUsePos } from '../../utils/accessControl';
import { useAuthStore } from '../../store/authStore';

type BillingTab = 'sales' | 'purchases' | 'orders';

const TAB_OPTIONS: { key: BillingTab; label: string; queryType: string }[] = [
    { key: 'sales', label: 'Sales', queryType: 'TAX_INVOICE' },
    { key: 'purchases', label: 'Purchases', queryType: 'PURCHASE_BILL' },
    { key: 'orders', label: 'Orders', queryType: 'ESTIMATE' },
];

const CREATE_OPTIONS: { label: string; route: string }[] = [
    { label: 'Sale Invoice', route: '/(main)/billing/create?type=TAX_INVOICE' },
    { label: 'Purchase Bill', route: '/(main)/billing/purchase-bill' },
    { label: 'Sale Return', route: '/(main)/billing/sale-return' },
    { label: 'Purchase Return', route: '/(main)/billing/purchase-return' },
    { label: 'Estimate', route: '/(main)/billing/estimate' },
    { label: 'Sale Order', route: '/(main)/billing/sale-order' },
    { label: 'Purchase Order', route: '/(main)/billing/purchase-order' },
    { label: 'Delivery Challan', route: '/(main)/billing/delivery-challan' },
    { label: 'Payment In', route: '/(main)/billing/payment-in' },
    { label: 'Payment Out', route: '/(main)/billing/payment-out' },
];

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

    const [activeTab, setActiveTab] = useState<BillingTab>('sales');
    const subscription = useAuthStore((state) => state.subscription);
    const showPos = canUsePos(subscription);

    const queryType = useMemo(
        () => TAB_OPTIONS.find((entry) => entry.key === activeTab)?.queryType ?? 'TAX_INVOICE',
        [activeTab]
    );

    const { data, isLoading } = useQuery({
        queryKey: ['invoices', activeTab],
        queryFn: () => invoiceApi.list({ type: queryType, limit: 50 }),
        staleTime: 60_000,
    });

    const invoices = data?.data ?? [];
    const [createSheetOpen, setCreateSheetOpen] = useState(false);

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
            <View style={s.header}>
                <Text style={s.title}>Billing</Text>
                <Pressable onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}>
                    <Text style={[s.headerAction, { color: colors.primary }]}>All Screens</Text>
                </Pressable>
            </View>

            <FlatList
                data={invoices}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <InvoiceRow invoice={item} colors={colors} />}
                ListHeaderComponent={
                    <>
                        <View style={s.tabs}>
                            {TAB_OPTIONS.map((tab) => {
                                const selected = activeTab === tab.key;
                                return (
                                    <Pressable
                                        key={tab.key}
                                        style={[s.tab, selected && s.activeTab]}
                                        onPress={() => setActiveTab(tab.key)}
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
                        <View style={s.centered}>
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    ) : (
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary }}>No transactions yet.</Text>
                        </View>
                    )
                }
            />

            <Pressable style={s.fab} onPress={() => setCreateSheetOpen(true)}>
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
                                            setCreateSheetOpen(false);
                                            router.push(option.route as Parameters<typeof router.push>[0]);
                                        }}
                                    >
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

    return (
        <Pressable
            style={({ pressed }) => [rowStyles.row, { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => router.push(`/(main)/billing/${invoice.id}` as Parameters<typeof router.push>[0])}
        >
            <View style={rowStyles.left}>
                <Text style={[rowStyles.number, { color: colors.text }]}>{invoice.invoiceNumber}</Text>
                <Text style={[rowStyles.date, { color: colors.textSecondary }]}>{formatInvoiceDate(invoice.invoiceDate)}</Text>
            </View>
            <View style={rowStyles.right}>
                <Text style={[rowStyles.amount, { color: colors.text }]}>Rs {invoice.totalInvoiceValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                <View style={[rowStyles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
                    <Text style={[rowStyles.statusText, { color: statusColor }]}>{invoice.paymentStatus}</Text>
                </View>
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
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 8,
        },
        fabText: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '700' },
        modalRoot: { flex: 1, justifyContent: 'flex-end' },
        backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000088' },
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
            justifyContent: 'center',
        },
        sheetOptionText: { fontSize: Typography.body.size, fontWeight: '600' },
        tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.sm },
        tab: {
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.lg,
            borderRadius: Radius.pill,
            backgroundColor: colors.surfaceVariant,
        },
        activeTab: { backgroundColor: colors.primary },
        tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
        activeTabText: { color: '#fff', fontWeight: '700' },
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
    },
    left: { flex: 1 },
    right: { alignItems: 'flex-end' },
    number: { fontWeight: '600', fontSize: 14 },
    date: { fontSize: 12, marginTop: 2 },
    amount: { fontWeight: '700', fontSize: 15 },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: Radius.pill,
        marginTop: 4,
    },
    statusText: { fontSize: 10, fontWeight: '700' },
});
