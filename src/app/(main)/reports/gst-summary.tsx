import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useHaptics } from '../../../hooks/useHaptics';
import { useSmartBack } from '../../../hooks/useSmartBack';

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
    const smartBack = useSmartBack('/(main)/reports');
    const { selection } = useHaptics();

    const [period, setPeriod] = useState<'current' | 'last'>('current');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const last = new Date(currentYear, now.getMonth() - 1, 1);
    const month = period === 'current' ? currentMonth : last.getMonth() + 1;
    const year = period === 'current' ? currentYear : last.getFullYear();

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['reports-gst-summary', month, year],
        queryFn: () => reportApi.getGstSummary({ month, year }),
        staleTime: 60_000,
    });

    const rows = useMemo<GstRow[]>(() => data?.data?.rows ?? [], [data?.data?.rows]);

    const totals = useMemo(
        () =>
            rows.reduce(
                (acc, row) => {
                    acc.taxable += Number(row.taxableTurnover ?? 0);
                    acc.tax += Number(row.totalTax ?? 0);
                    return acc;
                },
                { taxable: 0, tax: 0 }
            ),
        [rows]
    );
    const formatInr = (value: number) => `Rs ${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    const monthLabel = `${month.toString().padStart(2, '0')}/${year}`;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="GST Summary"
                subtitle="Slab-wise tax overview"
                onBackPress={smartBack}
            />

            <View style={s.filters}>
                <Pressable
                    style={[s.filterChip, period === 'current' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => {
                        void selection();
                        setPeriod('current');
                    }}
                >
                    <MaterialCommunityIcons name="calendar-month-outline" size={16} color={period === 'current' ? colors.onPrimary : colors.textSecondary} />
                    <Text style={[s.filterText, period === 'current' && { color: colors.onPrimary }]}>Current Month</Text>
                </Pressable>
                <Pressable
                    style={[s.filterChip, period === 'last' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => {
                        void selection();
                        setPeriod('last');
                    }}
                >
                    <MaterialCommunityIcons name="history" size={16} color={period === 'last' ? colors.onPrimary : colors.textSecondary} />
                    <Text style={[s.filterText, period === 'last' && { color: colors.onPrimary }]}>Last Month</Text>
                </Pressable>
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item) => String(item.gstRate)}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                refetch();
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={s.summaryHeader}>
                                <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>PERIOD</Text>
                                <Text style={[s.periodBadge, { color: colors.primary, backgroundColor: withAlpha(colors.primary, '14') }]}>
                                    {monthLabel}
                                </Text>
                            </View>
                            <View style={s.summaryGrid}>
                                <View style={[s.summaryCell, { backgroundColor: colors.surfaceVariant }]}>
                                    <Text style={[s.summaryCaption, { color: colors.textSecondary }]}>Taxable Turnover</Text>
                                    <Text style={s.summaryValue}>{formatInr(totals.taxable)}</Text>
                                </View>
                                <View style={[s.summaryCell, { backgroundColor: colors.surfaceVariant }]}>
                                    <Text style={[s.summaryCaption, { color: colors.textSecondary }]}>Total Tax</Text>
                                    <Text style={[s.summaryValue, { color: colors.primary }]}>{formatInr(totals.tax)}</Text>
                                </View>
                                <View style={[s.summaryCell, { backgroundColor: colors.surfaceVariant }]}>
                                    <Text style={[s.summaryCaption, { color: colors.textSecondary }]}>Slabs</Text>
                                    <Text style={s.summaryValue}>{rows.length}</Text>
                                </View>
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={{ flex: 1 }}>
                                <View style={s.rowTitleWrap}>
                                    <Text style={s.rowTitle}>{item.gstRate}% GST</Text>
                                    <Text style={[s.rateBadge, { backgroundColor: withAlpha(colors.info, '14'), color: colors.info }]}>
                                        Slab
                                    </Text>
                                </View>
                                <Text style={s.rowMeta}>Taxable: {formatInr(item.taxableTurnover)}</Text>
                            </View>
                            <View style={s.numbers}>
                                <Text style={s.rowValue}>CGST {formatInr(item.cgstAmount)}</Text>
                                <Text style={s.rowValue}>SGST {formatInr(item.sgstAmount)}</Text>
                                <Text style={s.rowValue}>IGST {formatInr(item.igstAmount)}</Text>
                                <Text style={s.totalTax}>Total {formatInr(item.totalTax)}</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={(
                        <View style={[s.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="file-search-outline" size={22} color={colors.textSecondary} />
                            <Text style={[s.emptyTitle, { color: colors.text }]}>No GST data found</Text>
                            <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>Create invoices to generate GST totals.</Text>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        filters: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        filterChip: {
            backgroundColor: colors.surfaceVariant,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        filterText: { color: colors.textSecondary, fontSize: Typography.caption.size, fontWeight: '700' },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        summaryCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.md,
        },
        summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
        summaryLabel: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
        periodBadge: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 3,
            fontSize: Typography.caption.size,
            fontWeight: '700',
            overflow: 'hidden',
        },
        summaryGrid: { gap: Spacing.sm },
        summaryCell: {
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.sm,
        },
        summaryCaption: { fontSize: Typography.caption.size, fontWeight: '600' },
        summaryValue: { color: colors.text, fontSize: Typography.title.size, fontWeight: '800', marginTop: 2 },
        row: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            gap: Spacing.sm,
        },
        rowTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
        rowTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
        rateBadge: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 2,
            fontSize: Typography.caption.size,
            fontWeight: '700',
            overflow: 'hidden',
        },
        rowMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        numbers: { alignItems: 'flex-end', gap: 2 },
        rowValue: { color: colors.textSecondary, fontWeight: '600', fontSize: 11 },
        totalTax: { color: colors.primary, fontWeight: '700', fontSize: 11, marginTop: 2 },
        emptyState: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingVertical: Spacing.lg,
            alignItems: 'center',
            gap: 2,
        },
        emptyTitle: { fontSize: Typography.body.size, fontWeight: '700' },
        emptySubtitle: { fontSize: Typography.caption.size },
    });
