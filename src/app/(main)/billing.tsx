// @ts-nocheck
import { View, Text, StyleSheet, FlatList, Pressable, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { invoiceApi } from '../../api/endpoints';
import { Spacing, Radius, Typography, type ColorPalette } from '../../constants/theme';
import { PaymentStatus } from '../../constants/enums';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { Invoice } from '../../types/domain';

export default function BillingScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];
    const [activeTab, setActiveTab] = useState<'sales' | 'purchases' | 'orders'>('sales');
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['invoices', activeTab],
        queryFn: () => invoiceApi.list({ type: activeTab === 'sales' ? 'TAX_INVOICE' : activeTab === 'purchases' ? 'PURCHASE_BILL' : 'ESTIMATE', limit: 50 }),
        staleTime: 60_000,
    });

    const TAB_OPTIONS = [
        { key: 'sales', label: 'Sales' },
        { key: 'purchases', label: 'Purchase' },
        { key: 'orders', label: 'Orders' },
    ] as const;

    const CREATE_OPTIONS = [
        { label: '+ Sale Invoice', type: 'TAX_INVOICE', icon: '🧾' },
        { label: '+ Estimate', type: 'ESTIMATE', icon: '📝' },
        { label: '+ Purchase', type: 'PURCHASE_BILL', icon: '📥' },
        { label: '+ Credit Note', type: 'CREDIT_NOTE_DOC', icon: '↩️' },
    ];

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            {/* Header */}
            <View style={s.header}>
                <Text style={s.title}>Billing</Text>
                <Pressable style={s.posBtn} onPress={() => router.push('/(main)/billing/pos')}>
                    <Text style={s.posBtnText}>POS 🛒</Text>
                </Pressable>
            </View>

            {/* Create options */}
            <View style={s.createRow}>
                {CREATE_OPTIONS.map((opt) => (
                    <Pressable
                        key={opt.type}
                        style={({ pressed }) => [s.createBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => router.push(`/(main)/billing/create?type=${opt.type}` as Parameters<typeof router.push>[0])}
                    >
                        <Text style={s.createBtnText}>{opt.label}</Text>
                    </Pressable>
                ))}
            </View>

            {/* Tabs */}
            <View style={s.tabs}>
                {TAB_OPTIONS.map((tab) => (
                    <Pressable key={tab.key} style={[s.tab, activeTab === tab.key && s.activeTab]} onPress={() => setActiveTab(tab.key)}>
                        <Text style={[s.tabText, activeTab === tab.key && s.activeTabText]}>{tab.label}</Text>
                    </Pressable>
                ))}
            </View>

            {/* Invoice list */}
            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={data?.data ?? []}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <InvoiceRow invoice={item} colors={colors} />}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={<View style={s.centered}><Text style={{ color: colors.textSecondary }}>No transactions yet. Create your first!</Text></View>}
                />
            )}
        </SafeAreaView>
    );
}

function InvoiceRow({ invoice, colors }: { invoice: Invoice; colors: ColorPalette }) {
    const statusColor = invoice.paymentStatus === PaymentStatus.PAID
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
                <Text style={[rowStyles.date, { color: colors.textSecondary }]}>
                    {format(parseISO(invoice.invoiceDate), 'dd MMM yyyy')}
                </Text>
            </View>
            <View style={rowStyles.right}>
                <Text style={[rowStyles.amount, { color: colors.text }]}>
                    ₹{invoice.totalInvoiceValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
                <View style={[rowStyles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                    <Text style={[rowStyles.statusText, { color: statusColor }]}>{invoice.paymentStatus}</Text>
                </View>
            </View>
        </Pressable>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    title: { fontSize: Typography.headline.size, fontWeight: '700', color: colors.text },
    posBtn: { backgroundColor: colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill },
    posBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    createRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, flexWrap: 'wrap' },
    createBtn: { backgroundColor: colors.primaryVariant, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
    createBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
    tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.sm },
    tab: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.pill, backgroundColor: colors.surfaceVariant },
    activeTab: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
    activeTabText: { color: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
});

const rowStyles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.card },
    left: { flex: 1 },
    right: { alignItems: 'flex-end' },
    number: { fontWeight: '600', fontSize: 14 },
    date: { fontSize: 12, marginTop: 2 },
    amount: { fontWeight: '700', fontSize: 16 },
    statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill, marginTop: 4 },
    statusText: { fontSize: 10, fontWeight: '600' },
});


