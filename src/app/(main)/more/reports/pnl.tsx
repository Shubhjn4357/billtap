import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getPnlRangePresets, PNL_METRIC_OPTIONS } from '../../../../constants/reportOptions';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { ChipButton } from '../../../../components/ui/ChipBlocks';
import { useHaptics } from '../../../../hooks/useHaptics';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { useReportSummary } from '../../../../hooks/useReports';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type MetricTone = 'success' | 'warning' | 'primary' | 'error' | 'neutral';

const toNumber = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getMetricColor = (colors: ColorPalette, tone: MetricTone) => {
    if (tone === 'success') return colors.success;
    if (tone === 'warning') return colors.warning;
    if (tone === 'error') return colors.error;
    if (tone === 'primary') return colors.primary;
    return colors.textSecondary;
};

export default function PnLReportScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const [rangeIndex, setRangeIndex] = useState(0);
    const smartBack = useSmartBack('/(main)/reports');
    const { selection } = useHaptics();
    const ranges = useMemo(() => getPnlRangePresets(), []);
    const range = ranges[rangeIndex] ?? ranges[0];

    const { summary, isLoading, isRefetching, refetch } = useReportSummary(
        { from: range.from, to: range.to },
        { staleTime: 120_000 }
    );

    const metrics = (summary ?? {}) as Record<string, number>;
    const netProfit = toNumber(metrics.netProfit);
    const isProfitable = netProfit >= 0;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Profit and Loss"
                subtitle="Revenue, expense and net profitability"
                onBackPress={smartBack}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
                {ranges.map((entry, index) => {
                    return (
                        <ChipButton
                            key={entry.label}
                            label={entry.label}
                            selected={rangeIndex === index}
                            tone="info"
                            onPress={() => {
                                void selection();
                                setRangeIndex(index);
                            }}
                        />
                    );
                })}
            </ScrollView>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefetching}
                        onRefresh={() => {
                            refetch();
                        }}
                    />
                )}
            >
                <View style={[s.heroCard, { backgroundColor: isProfitable ? colors.success : colors.error }]}>
                    <Text style={s.heroLabel}>NET PROFIT / LOSS</Text>
                    {isLoading ? (
                        <ActivityIndicator color={colors.onPrimary} style={{ marginTop: Spacing.sm }} />
                    ) : (
                        <Text style={s.heroValue}>
                            {netProfit < 0 ? '-' : '+'}Rs {Math.abs(netProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    )}
                    <Text style={s.heroRange}>{range.from} to {range.to}</Text>
                </View>

                <View style={s.topStats}>
                    <View style={[s.topStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.topStatLabel, { color: colors.textSecondary }]}>Sales vs Expenses</Text>
                        <Text style={[s.topStatValue, { color: colors.text }]}>
                            Rs {toNumber(metrics.totalSales).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / Rs {toNumber(metrics.totalExpenses).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                    <View style={[s.topStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.topStatLabel, { color: colors.textSecondary }]}>Receivable vs Payable</Text>
                        <Text style={[s.topStatValue, { color: colors.text }]}>
                            Rs {toNumber(metrics.outstandingReceivables).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / Rs {toNumber(metrics.outstandingPayables).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                </View>

                <View style={s.metricsGrid}>
                    {PNL_METRIC_OPTIONS.map((metric) => {
                        const value = toNumber(metrics[metric.key]);
                        const toneColor = getMetricColor(colors, metric.tone);
                        return (
                            <View key={metric.key} style={[s.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <MaterialCommunityIcons name={metric.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={18} color={toneColor} />
                                <Text style={[s.metricLabel, { color: colors.textSecondary }]}>{metric.label}</Text>
                                {isLoading ? (
                                    <View style={[s.skeleton, { backgroundColor: colors.skeleton }]} />
                                ) : (
                                    <Text style={[s.metricValue, { color: toneColor }]}>
                                        Rs {value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </View>

                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>GST Reports</Text>
                    {([
                        { label: 'GSTR-1 (Sales)', route: '/(main)/more/reports/gstr1', icon: 'file-document-outline' },
                        { label: 'GSTR-3B (Summary)', route: '/(main)/more/reports/gstr3b', icon: 'chart-box-outline' },
                    ] satisfies readonly { label: string; route: string; icon: IconName }[]).map((entry) => (
                        <Pressable
                            key={entry.label}
                            style={[s.reportLink, { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => router.push(entry.route as Parameters<typeof router.push>[0])}
                        >
                            <MaterialCommunityIcons name={entry.icon} size={18} color={colors.primary} />
                            <Text style={[s.reportLabel, { color: colors.text }]}>{entry.label}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                        </Pressable>
                    ))}
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        chipsRow: {
            paddingHorizontal: Spacing.lg,
            gap: Spacing.sm,
            paddingBottom: Spacing.md,
        },
        heroCard: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
            borderRadius: Radius.lg,
            padding: Spacing.xl,
            alignItems: 'center',
        },
        heroLabel: { color: withAlpha(colors.onPrimary, 'cc'), fontWeight: '700', fontSize: Typography.caption.size, letterSpacing: 0.8 },
        heroValue: { color: colors.onPrimary, fontWeight: '900', fontSize: 34, marginTop: Spacing.sm },
        heroRange: { color: withAlpha(colors.onPrimary, 'cc'), fontSize: Typography.caption.size, marginTop: Spacing.xs },
        topStats: {
            paddingHorizontal: Spacing.lg,
            gap: Spacing.sm,
            marginBottom: Spacing.md,
        },
        topStatCard: {
            borderRadius: Radius.card,
            borderWidth: 1,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        topStatLabel: { fontSize: Typography.caption.size, fontWeight: '700' },
        topStatValue: { marginTop: 2, fontSize: Typography.body.size, fontWeight: '700' },
        metricsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
        },
        metricCard: {
            borderRadius: Radius.card,
            borderWidth: 1,
            padding: Spacing.md,
            width: '47%',
            minHeight: 92,
        },
        metricLabel: { fontSize: Typography.caption.size, marginTop: 4 },
        metricValue: { fontSize: Typography.title.size, fontWeight: '700', marginTop: 4 },
        skeleton: { height: 24, borderRadius: 4, marginTop: 4 },
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        sectionTitle: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
        reportLink: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: Spacing.md,
            borderRadius: Radius.card,
            borderWidth: 1,
            marginBottom: Spacing.sm,
            gap: Spacing.sm,
        },
        reportLabel: { flex: 1, fontWeight: '600', fontSize: Typography.body.size },
    });
