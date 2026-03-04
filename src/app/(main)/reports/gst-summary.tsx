import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';

type GstRow = {
    gstRate: number;
    taxableTurnover: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
};

export default function GstSummaryScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);

    const [period, setPeriod] = useState<'current' | 'last'>('current');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const last = new Date(currentYear, now.getMonth() - 1, 1);
    const month = period === 'current' ? currentMonth : last.getMonth() + 1;
    const year = period === 'current' ? currentYear : last.getFullYear();

    const { data, isLoading } = useQuery({
        queryKey: ['reports-gst-summary', month, year],
        queryFn: () => reportApi.getGstSummary({ month, year }),
        staleTime: 60_000,
    });

    const rows = useMemo<GstRow[]>(() => data?.data?.rows ?? [], [data?.data?.rows]);

    const totals = useMemo(() => {
        return rows.reduce(
            (acc, row) => {
                acc.taxable += Number(row.taxableTurnover ?? 0);
                acc.tax += Number(row.totalTax ?? 0);
                return acc;
            },
            { taxable: 0, tax: 0 }
        );
    }, [rows]);

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>GST Summary</Text>
                <View style={{ width: 44 }} />
            </View>

            <View style={s.filters}>
                <Pressable
                    style={[s.filterChip, period === 'current' && { backgroundColor: colors.primary }]}
                    onPress={() => setPeriod('current')}
                >
                    <Text style={[s.filterText, period === 'current' && { color: '#fff' }]}>Current Month</Text>
                </Pressable>
                <Pressable
                    style={[s.filterChip, period === 'last' && { backgroundColor: colors.primary }]}
                    onPress={() => setPeriod('last')}
                >
                    <Text style={[s.filterText, period === 'last' && { color: '#fff' }]}>Last Month</Text>
                </Pressable>
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item) => String(item.gstRate)}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>TAXABLE TURNOVER</Text>
                            <Text style={s.summaryValue}>Rs {totals.taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            <Text style={[s.summaryLabel, { color: colors.textSecondary, marginTop: 8 }]}>TOTAL TAX</Text>
                            <Text style={s.summaryValue}>Rs {totals.tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            <Text style={s.summaryPeriod}>{`${month}/${year}`}</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <View style={{ flex: 1 }}>
                                <Text style={s.rowTitle}>{item.gstRate}% GST</Text>
                                <Text style={s.rowMeta}>Taxable: Rs {item.taxableTurnover.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            </View>
                            <View style={s.numbers}>
                                <Text style={s.rowValue}>CGST {item.cgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.rowValue}>SGST {item.sgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.rowValue}>IGST {item.igstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.totalTax}>Total {item.totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No GST data found.</Text>}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        back: { fontWeight: '600', fontSize: 14 },
        title: { fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
        filters: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        filterChip: {
            backgroundColor: colors.surfaceVariant,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        summaryCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.md,
        },
        summaryLabel: { fontSize: 11, fontWeight: '700' },
        summaryValue: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 2 },
        summaryPeriod: { marginTop: 8, color: colors.textSecondary, fontSize: 11 },
        row: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            gap: Spacing.sm,
        },
        rowTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
        rowMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        numbers: { alignItems: 'flex-end', gap: 1 },
        rowValue: { color: colors.textSecondary, fontWeight: '600', fontSize: 11 },
        totalTax: { color: colors.primary, fontWeight: '700', fontSize: 11, marginTop: 2 },
    });
