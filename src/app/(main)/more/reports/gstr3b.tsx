import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../../constants/theme';

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

export default function Gstr3bReportScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const s = styles(colors);
    const [month, setMonth] = useState(DEFAULT_MONTH);
    const [year] = useState(DEFAULT_YEAR);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['report-gstr3b', month, year],
        queryFn: () => reportApi.getGstr3b({ month, year }),
        staleTime: 60_000,
    });

    const rows = useMemo<GstSummaryRow[]>(() => {
        const payload = data as { data?: { rows?: GstSummaryRow[] }; rows?: GstSummaryRow[] } | undefined;
        return payload?.data?.rows ?? payload?.rows ?? [];
    }, [data]);

    const totals = useMemo<{ taxable: number; tax: number; cgst: number; sgst: number; igst: number }>(() => {
        return rows.reduce<{ taxable: number; tax: number; cgst: number; sgst: number; igst: number }>(
            (acc, row) => ({
                taxable: acc.taxable + asNumber(row.taxableTurnover ?? row.taxable ?? row.totalTaxable),
                tax: acc.tax + asNumber(row.totalTax ?? row.taxAmount),
                cgst: acc.cgst + asNumber(row.cgstAmount ?? row.cgst),
                sgst: acc.sgst + asNumber(row.sgstAmount ?? row.sgst),
                igst: acc.igst + asNumber(row.igstAmount ?? row.igst),
            }),
            { taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 }
        );
    }, [rows]);

    const changeMonth = (delta: number) => {
        const next = month + delta;
        if (next >= 1 && next <= 12) setMonth(next);
    };

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={[s.title, { color: colors.text }]}>GSTR-3B</Text>
                <View style={{ width: 48 }} />
            </View>

            <View style={s.periodRow}>
                <Pressable style={[s.periodBtn, { borderColor: colors.border }]} onPress={() => changeMonth(-1)}>
                    <Text style={{ color: colors.textSecondary }}>{'<'}</Text>
                </Pressable>
                <Text style={[s.periodText, { color: colors.text }]}>
                    {String(month).padStart(2, '0')}/{year}
                </Text>
                <Pressable style={[s.periodBtn, { borderColor: colors.border }]} onPress={() => changeMonth(1)}>
                    <Text style={{ color: colors.textSecondary }}>{'>'}</Text>
                </Pressable>
            </View>

            <View style={[s.summaryCard, { backgroundColor: colors.primaryVariant }]}>
                <Text style={s.summaryLabel}>NET TAX LIABILITY (EST.)</Text>
                <Text style={s.summaryValue}>
                    Rs {totals.tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
                <Text style={s.summaryMeta}>
                    CGST {totals.cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })} | SGST {totals.sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })} | IGST {totals.igst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
            </View>

            {isLoading || isFetching ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item, idx) => `${item.gstRate ?? idx}`}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary }}>No GST rows found for this period.</Text>
                        </View>
                    }
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
                                        CGST {cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })} | SGST {sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })} | IGST {igst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[s.rowValue, { color: colors.text }]}>Rs {taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                    <Text style={[s.rowTax, { color: colors.primary }]}>Tax Rs {tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
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
        header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        back: { fontWeight: '700', fontSize: 14, width: 48 },
        title: { fontWeight: '700', fontSize: 17 },
        periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, marginBottom: Spacing.md },
        periodBtn: {
            borderWidth: 1,
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceVariant,
        },
        periodText: { fontSize: 16, fontWeight: '700', minWidth: 100, textAlign: 'center' },
        summaryCard: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
            borderRadius: Radius.card,
            padding: Spacing.lg,
        },
        summaryLabel: { color: '#ffffffcc', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
        summaryValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 6 },
        summaryMeta: { color: '#ffffffcc', fontSize: 12, marginTop: 4 },
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
        rowTitle: { fontSize: 14, fontWeight: '700' },
        rowMeta: { fontSize: 11, marginTop: 3 },
        rowValue: { fontSize: 13, fontWeight: '700' },
        rowTax: { fontSize: 11, fontWeight: '700', marginTop: 3 },
    });

