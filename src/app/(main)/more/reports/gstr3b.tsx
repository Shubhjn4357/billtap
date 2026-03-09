import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSmartBack } from '../../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { useGstr3bReport } from '../../../../hooks/useReports';
import { formatInr, formatMonthYear, normalizeGstRows, shiftMonthYear, summarizeGstRows, type NormalizedGstRow } from '../../../../selectors/reportSelectors';

const CURRENT_DATE = new Date();
const DEFAULT_MONTH = CURRENT_DATE.getMonth() + 1;
const DEFAULT_YEAR = CURRENT_DATE.getFullYear();

export default function Gstr3bReportScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/reports');
    const [month, setMonth] = useState(DEFAULT_MONTH);
    const [year, setYear] = useState(DEFAULT_YEAR);

    const { rows, isLoading, isFetching, refetch } = useGstr3bReport(
        { month, year },
        { staleTime: 60_000 }
    );

    const reportRows = useMemo<NormalizedGstRow[]>(() => normalizeGstRows(rows ?? []), [rows]);
    const totals = useMemo(() => summarizeGstRows(reportRows), [reportRows]);

    const changeMonth = (delta: number) => {
        const next = shiftMonthYear(month, year, delta);
        setMonth(next.month);
        setYear(next.year);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="GSTR-3B"
                subtitle="Monthly GST liability summary"
                onBackPress={smartBack}
            />

            <View style={s.periodRow}>
                <Pressable style={[s.periodBtn, { borderColor: colors.border }]} onPress={() => changeMonth(-1)}>
                    <MaterialCommunityIcons name="chevron-left" size={18} color={colors.textSecondary} />
                </Pressable>
                <Text style={[s.periodText, { color: colors.text }]}>
                    {formatMonthYear(month, year)}
                </Text>
                <Pressable style={[s.periodBtn, { borderColor: colors.border }]} onPress={() => changeMonth(1)}>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                </Pressable>
            </View>

            <View style={[s.summaryCard, { backgroundColor: colors.primaryVariant }]}>
                <Text style={s.summaryLabel}>NET TAX LIABILITY (EST.)</Text>
                <Text style={s.summaryValue}>
                    {formatInr(totals.tax)}
                </Text>
                <Text style={s.summaryMeta}>
                    CGST {totals.cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    {' | '}
                    SGST {totals.sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    {' | '}
                    IGST {totals.igst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
            </View>

            {isLoading || isFetching ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={reportRows}
                    keyExtractor={(item, index) => `${item.gstRate ?? index}`}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isFetching}
                            onRefresh={() => {
                                refetch();
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListEmptyComponent={(
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary }}>No GST rows found for this period.</Text>
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const rate = item.gstRate;
                        const taxable = item.taxableTurnover;
                        const tax = item.totalTax;
                        const cgst = item.cgstAmount;
                        const sgst = item.sgstAmount;
                        const igst = item.igstAmount;

                        return (
                            <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.rowTitle, { color: colors.text }]}>GST {rate}%</Text>
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]}>
                                        CGST {cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        {' | '}
                                        SGST {sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        {' | '}
                                        IGST {igst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[s.rowValue, { color: colors.text }]}>
                                        {formatInr(taxable)}
                                    </Text>
                                    <Text style={[s.rowTax, { color: colors.primary }]}>
                                        Tax {formatInr(tax)}
                                    </Text>
                                </View>
                            </View>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        periodRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.md,
            marginBottom: Spacing.md,
            marginTop: Spacing.xs,
        },
        periodBtn: {
            borderWidth: 1,
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceVariant,
        },
        periodText: { fontSize: Typography.title.size, fontWeight: '700', minWidth: 100, textAlign: 'center' },
        summaryCard: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
            borderRadius: Radius.card,
            padding: Spacing.lg,
        },
        summaryLabel: { color: withAlpha(colors.onPrimary, 'cc'), fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
        summaryValue: { color: colors.onPrimary, fontSize: 28, fontWeight: '800', marginTop: 6 },
        summaryMeta: { color: withAlpha(colors.onPrimary, 'cc'), fontSize: Typography.caption.size, marginTop: 4 },
        centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
        row: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            gap: Spacing.sm,
        },
        rowTitle: { fontSize: Typography.body.size, fontWeight: '700' },
        rowMeta: { fontSize: Typography.caption.size, marginTop: 3 },
        rowValue: { fontSize: Typography.body.size, fontWeight: '700' },
        rowTax: { fontSize: Typography.caption.size, fontWeight: '700', marginTop: 3 },
    });
