import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSmartBack } from '../../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../../../../api/endpoints';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';

const CURRENT_DATE = new Date();
const DEFAULT_MONTH = CURRENT_DATE.getMonth() + 1;
const DEFAULT_YEAR = CURRENT_DATE.getFullYear();

const asNumber = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

type GstSummaryRow = {
    gstRate?: number;
    rate?: number;
    taxableTurnover?: number;
    taxable?: number;
    totalTaxable?: number;
    totalTax?: number;
    taxAmount?: number;
    cgstAmount?: number;
    cgst?: number;
    sgstAmount?: number;
    sgst?: number;
    igstAmount?: number;
    igst?: number;
};

export default function Gstr1ReportScreen() {
        const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/reports');
    const [month, setMonth] = useState(DEFAULT_MONTH);
    const [year] = useState(DEFAULT_YEAR);

    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['report-gstr1', month, year],
        queryFn: () => reportApi.getGstr1({ month, year }),
        staleTime: 60_000,
    });

    const rows = useMemo<GstSummaryRow[]>(() => {
        const payload = data as { data?: { rows?: GstSummaryRow[] }; rows?: GstSummaryRow[] } | undefined;
        return payload?.data?.rows ?? payload?.rows ?? [];
    }, [data]);

    const totals = useMemo(
        () => rows.reduce<{ taxable: number; tax: number }>(
            (acc, row) => ({
                taxable: acc.taxable + asNumber(row.taxableTurnover ?? row.taxable ?? row.totalTaxable),
                tax: acc.tax + asNumber(row.totalTax ?? row.taxAmount),
            }),
            { taxable: 0, tax: 0 }
        ),
        [rows]
    );

    const changeMonth = (delta: number) => {
        const next = month + delta;
        if (next >= 1 && next <= 12) {
            setMonth(next);
        }
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="GSTR-1"
                subtitle="Outward supplies summary"
                onBackPress={smartBack}
            />

            <View style={s.periodRow}>
                <Pressable style={[s.periodBtn, { borderColor: colors.border }]} onPress={() => changeMonth(-1)}>
                    <MaterialCommunityIcons name="chevron-left" size={18} color={colors.textSecondary} />
                </Pressable>
                <Text style={[s.periodText, { color: colors.text }]}>
                    {String(month).padStart(2, '0')}/{year}
                </Text>
                <Pressable style={[s.periodBtn, { borderColor: colors.border }]} onPress={() => changeMonth(1)}>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                </Pressable>
            </View>

            <View style={[s.summaryCard, { backgroundColor: colors.primary }]}>
                <Text style={s.summaryLabel}>TOTAL TAXABLE</Text>
                <Text style={s.summaryValue}>
                    Rs {totals.taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
                <Text style={s.summaryMeta}>
                    Tax Rs {totals.tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
            </View>

            {isLoading || isFetching ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={rows}
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
                        const rate = asNumber(item.gstRate ?? item.rate);
                        const taxable = asNumber(item.taxableTurnover ?? item.taxable ?? item.totalTaxable);
                        const tax = asNumber(item.totalTax ?? item.taxAmount);
                        const cgst = asNumber(item.cgstAmount ?? item.cgst);
                        const sgst = asNumber(item.sgstAmount ?? item.sgst);
                        const igst = asNumber(item.igstAmount ?? item.igst);

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
                                        Rs {taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    </Text>
                                    <Text style={[s.rowTax, { color: colors.primary }]}>
                                        Tax Rs {tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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
