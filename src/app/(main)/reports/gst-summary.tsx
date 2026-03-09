import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GST_PERIOD_OPTIONS } from '../../../constants/reportOptions';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { useHaptics } from '../../../hooks/useHaptics';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useGstSummaryReport } from '../../../hooks/useReports';
import { formatInr, formatMonthYear, normalizeGstRows, summarizeGstRows, type NormalizedGstRow } from '../../../selectors/reportSelectors';

export default function GstSummaryScreen() {
    const colors = useAppColors();
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

    const { rows, isLoading, isRefetching, refetch } = useGstSummaryReport(
        { month, year },
        { staleTime: 60_000 }
    );

    const reportRows = useMemo<NormalizedGstRow[]>(() => normalizeGstRows(rows ?? []), [rows]);
    const totals = useMemo(() => summarizeGstRows(reportRows), [reportRows]);
    const monthLabel = formatMonthYear(month, year);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="GST Summary"
                subtitle="Slab-wise tax overview"
                onBackPress={smartBack}
            />

            <View style={s.filters}>
                {GST_PERIOD_OPTIONS.map((option) => {
                    return (
                        <ChipButton
                            key={option.key}
                            label={option.label}
                            icon={option.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                            selected={period === option.key}
                            tone="info"
                            onPress={() => {
                                void selection();
                                setPeriod(option.key);
                            }}
                        />
                    );
                })}
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={reportRows}
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
                                    <Text style={s.summaryValue}>{reportRows.length}</Text>
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
