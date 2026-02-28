import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../../constants/theme';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const TODAY = new Date();
const RANGES = [
    { label: 'This Month', from: format(startOfMonth(TODAY), 'yyyy-MM-dd'), to: format(endOfMonth(TODAY), 'yyyy-MM-dd') },
    { label: 'Last Month', from: format(startOfMonth(subMonths(TODAY, 1)), 'yyyy-MM-dd'), to: format(endOfMonth(subMonths(TODAY, 1)), 'yyyy-MM-dd') },
    { label: 'Last 3 Months', from: format(startOfMonth(subMonths(TODAY, 2)), 'yyyy-MM-dd'), to: format(endOfMonth(TODAY), 'yyyy-MM-dd') },
    { label: 'This Year', from: `${TODAY.getFullYear()}-04-01`, to: `${TODAY.getFullYear() + (TODAY.getMonth() >= 3 ? 1 : 0)}-03-31` },
] as const;
export default function PnLReportScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const [rangeIdx, setRangeIdx] = useState(0);
    const s = styles(colors);
    const range = RANGES[rangeIdx];

    const { data, isLoading } = useQuery({
        queryKey: ['pnl-report', range.from, range.to],
        queryFn: () => reportApi.getSummary({ from: range.from, to: range.to }),
        staleTime: 2 * 60_000,
    });

    const summary = data?.data as Record<string, number> | undefined;

    const metrics = [
        { label: 'Total Sales', key: 'totalSales', color: colors.success, icon: '📈' },
        { label: 'Total Purchases', key: 'totalPurchases', color: colors.warning, icon: '📦' },
        { label: 'Gross Profit', key: 'grossProfit', color: colors.primary, icon: '💎' },
        { label: 'Total Expenses', key: 'totalExpenses', color: colors.error, icon: '💸' },
        { label: 'Net Profit', key: 'netProfit', color: colors.success, icon: '🏆' },
        { label: 'Tax Collected', key: 'totalTaxCollected', color: colors.textSecondary, icon: '🏛' },
        { label: 'Receivables', key: 'outstandingReceivables', color: colors.success, icon: '⬆️' },
        { label: 'Payables', key: 'outstandingPayables', color: colors.error, icon: '⬇️' },
    ];

    const netProfit = summary?.netProfit ?? 0;
    const isProfitable = netProfit >= 0;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Back</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>P&L Report</Text>
                <View style={{ width: 48 }} />
            </View>

            {/* Date range picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.md }}>
                {RANGES.map((r, i) => (
                    <Pressable key={r.label} style={[s.rangeChip, { backgroundColor: rangeIdx === i ? colors.primary : colors.surfaceVariant }]} onPress={() => setRangeIdx(i)}>
                        <Text style={{ color: rangeIdx === i ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>{r.label}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Net profit hero */}
                <View style={[s.heroCard, { backgroundColor: isProfitable ? colors.success : colors.error }]}>
                    <Text style={s.heroLabel}>NET PROFIT / LOSS</Text>
                    {isLoading ? (
                        <ActivityIndicator color="#fff" style={{ marginTop: 8 }} />
                    ) : (
                        <Text style={s.heroVal}>
                            {netProfit < 0 ? '-' : '+'}₹{Math.abs(netProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    )}
                    <Text style={s.heroRange}>{range.from} – {range.to}</Text>
                </View>

                {/* Metrics grid */}
                <View style={s.metricsGrid}>
                    {metrics.map((m) => (
                        <View key={m.key} style={[s.metricCard, { backgroundColor: colors.card }]}>
                            <Text style={s.metricIcon}>{m.icon}</Text>
                            <Text style={[s.metricLabel, { color: colors.textSecondary }]}>{m.label}</Text>
                            {isLoading ? (
                                <View style={[s.skeleton, { backgroundColor: colors.skeleton }]} />
                            ) : (
                                <Text style={[s.metricVal, { color: m.color }]}>
                                    ₹{(summary?.[m.key] ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </Text>
                            )}
                        </View>
                    ))}
                </View>

                {/* GSTR links */}
                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>GST REPORTS</Text>
                    {[
                        { label: 'GSTR-1 (Sales)', route: '/(main)/more/reports/gstr1', icon: '📋' },
                        { label: 'GSTR-3B (Summary)', route: '/(main)/more/reports/gstr3b', icon: '📊' },
                    ].map((r) => (
                        <Pressable key={r.label} style={[s.reportLink, { backgroundColor: colors.card }]} onPress={() => router.push(r.route as Parameters<typeof router.push>[0])}>
                            <Text style={s.reportIcon}>{r.icon}</Text>
                            <Text style={[s.reportLabel, { color: colors.text }]}>{r.label}</Text>
                            <Text style={{ color: colors.textSecondary }}>›</Text>
                        </Pressable>
                    ))}
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
    rangeChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    heroCard: { margin: Spacing.lg, borderRadius: Radius.card * 1.5, padding: Spacing.xxl, alignItems: 'center' },
    heroLabel: { color: '#ffffffbb', fontWeight: '700', fontSize: 11, letterSpacing: 0.8 },
    heroVal: { color: '#fff', fontWeight: '900', fontSize: 40, marginTop: Spacing.sm },
    heroRange: { color: '#ffffffaa', fontSize: 11, marginTop: Spacing.sm },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    metricCard: { borderRadius: Radius.card, padding: Spacing.md, width: '47%', minHeight: 88 },
    metricIcon: { fontSize: 20 },
    metricLabel: { fontSize: 11, marginTop: 4 },
    metricVal: { fontSize: 18, fontWeight: '700', marginTop: 4 },
    skeleton: { height: 22, borderRadius: 4, marginTop: 4 },
    section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
    reportLink: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.card, marginBottom: Spacing.sm, gap: Spacing.md },
    reportIcon: { fontSize: 18 },
    reportLabel: { flex: 1, fontWeight: '500', fontSize: 14 },
});
