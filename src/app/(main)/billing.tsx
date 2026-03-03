import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
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

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Text style={s.title}>Billing</Text>
                {showPos ? (
                    <Pressable style={s.posBtn} onPress={() => router.push('/(main)/billing/pos')}>
                        <Text style={s.posBtnText}>POS</Text>
                    </Pressable>
                ) : null}
            </View>

            <FlatList
                data={invoices}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <InvoiceRow invoice={item} colors={colors} />}
                ListHeaderComponent={
                    <>
                        <View style={s.createRow}>
                            {CREATE_OPTIONS.map((option) => (
                                <Pressable
                                    key={option.label}
                                    style={({ pressed }) => [s.createBtn, pressed && { opacity: 0.75 }]}
                                    onPress={() => router.push(option.route as Parameters<typeof router.push>[0])}
                                >
                                    <Text style={s.createBtnText}>{option.label}</Text>
                                </Pressable>
                            ))}
                        </View>

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
        posBtn: {
            backgroundColor: colors.primary,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            borderRadius: Radius.pill,
        },
        posBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
        createRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
        },
        createBtn: {
            backgroundColor: colors.primaryVariant,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs,
        },
        createBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
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
