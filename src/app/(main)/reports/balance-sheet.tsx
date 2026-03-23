import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { UtilityEmptyState, UtilityHero } from '../../../components/ui/UtilityBlocks';
import { DESIGN_SPACING, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { useAppColors } from '../../../hooks/useAppColors';
import { useCurrentBusiness } from '../../../hooks/useCurrentBusiness';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useBalanceSheet } from '../../../hooks/useReports';
import { formatInr } from '../../../selectors/reportSelectors';
import { exportReportDocument } from '../../../utils/reportDocument';

export default function BalanceSheetScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const dialog = useAppDialog();
    const smartBack = useSmartBack('/(main)/reports');
    const { business } = useCurrentBusiness();
    const {
        assets,
        liabilities,
        equity,
        totals,
        isLoading,
        isRefetching,
        refetch,
    } = useBalanceSheet({ staleTime: 60_000 });

    const isBalanced = Math.abs(totals.assets - (totals.liabilities + totals.equity)) < 0.0001;
    const exportSections = useMemo(() => ([
        {
            title: 'Assets',
            caption: 'Accounts contributing to the asset position.',
            columns: [
                { label: 'Account' },
                { label: 'Type' },
                { label: 'Amount', align: 'right' as const },
            ],
            rows: assets.map((row) => [row.accountName, row.accountType, formatInr(row.amount)]),
            footerMetrics: [{ label: 'Total Assets', value: formatInr(totals.assets) }],
        },
        {
            title: 'Liabilities',
            caption: 'Current and long-term obligations.',
            columns: [
                { label: 'Account' },
                { label: 'Type' },
                { label: 'Amount', align: 'right' as const },
            ],
            rows: liabilities.map((row) => [row.accountName, row.accountType, formatInr(row.amount)]),
            footerMetrics: [{ label: 'Total Liabilities', value: formatInr(totals.liabilities) }],
        },
        {
            title: 'Equity',
            caption: 'Owner capital and reserves.',
            columns: [
                { label: 'Account' },
                { label: 'Type' },
                { label: 'Amount', align: 'right' as const },
            ],
            rows: equity.map((row) => [row.accountName, row.accountType, formatInr(row.amount)]),
            footerMetrics: [{ label: 'Total Equity', value: formatInr(totals.equity) }],
        },
    ]), [assets, equity, liabilities, totals.assets, totals.equity, totals.liabilities]);

    const handleExport = async () => {
        try {
            await exportReportDocument({
                title: 'Balance Sheet',
                subtitle: 'Assets, liabilities, and equity snapshot.',
                businessName: business?.name,
                contextLabel: isBalanced ? 'Balanced snapshot' : 'Needs review',
                documentKind: 'balance-sheet',
                summaryMetrics: [
                    { label: 'Assets', value: formatInr(totals.assets) },
                    { label: 'Liabilities', value: formatInr(totals.liabilities) },
                    { label: 'Equity', value: formatInr(totals.equity) },
                ],
                sections: exportSections,
            });
        } catch (error) {
            dialog.alert('Export failed', error instanceof Error ? error.message : 'Unable to export balance sheet.');
        }
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Balance Sheet"
                subtitle="Assets, liabilities, and equity"
                onBackPress={smartBack}
                actions={[
                    { icon: 'file-pdf-box', label: 'Export balance sheet', onPress: handleExport, accent: colors.info },
                ]}
                contextChip={{ label: isBalanced ? 'Balanced' : 'Review', accent: isBalanced ? colors.success : colors.warning }}
            />

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={s.content}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                void refetch();
                            }}
                        />
                    )}
                >
                    <UtilityHero
                        title="Balance Sheet"
                        subtitle="Track what the business owns, owes, and retains in capital."
                        icon="safe-square-outline"
                        tone={isBalanced ? 'success' : 'warning'}
                    />

                    <View style={s.metricRow}>
                        <HubMetricCard label="Assets" value={formatInr(totals.assets)} meta="Total owned value" tone="success" accentColor={colors.success} />
                        <HubMetricCard label="Liabilities" value={formatInr(totals.liabilities)} meta="Outstanding obligations" tone="warning" accentColor={colors.warning} />
                        <HubMetricCard label="Equity" value={formatInr(totals.equity)} meta="Capital and reserves" tone="info" accentColor={colors.info} />
                    </View>

                    <BalanceSection
                        colors={colors}
                        title="Assets"
                        subtitle="Cash, bank, inventory and receivables"
                        rows={assets}
                        total={totals.assets}
                    />
                    <BalanceSection
                        colors={colors}
                        title="Liabilities"
                        subtitle="Payables, loans and liabilities"
                        rows={liabilities}
                        total={totals.liabilities}
                    />
                    <BalanceSection
                        colors={colors}
                        title="Equity"
                        subtitle="Capital and retained earnings"
                        rows={equity}
                        total={totals.equity}
                    />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

function BalanceSection({
    colors,
    title,
    subtitle,
    rows,
    total,
}: {
    colors: ColorPalette;
    title: string;
    subtitle: string;
    rows: { accountId: string; accountName: string; accountType: string; amount: number }[];
    total: number;
}) {
    const s = sectionStyles(colors);

    return (
        <View style={s.wrap}>
            <View style={s.head}>
                <View>
                    <Text style={s.title}>{title}</Text>
                    <Text style={s.subtitle}>{subtitle}</Text>
                </View>
                <Text style={s.total}>{formatInr(total)}</Text>
            </View>

            <View style={[s.card, getSurfaceStyle(colors, { elevated: true })]}>
                {rows.length === 0 ? (
                    <UtilityEmptyState
                        icon="database-search-outline"
                        title={`No ${title.toLowerCase()} yet`}
                        description="Create and post accounting entries to populate this section."
                    />
                ) : rows.map((row, index) => (
                    <View
                        key={`${title}-${row.accountId || row.accountName}-${index}`}
                        style={[
                            s.row,
                            index < rows.length - 1 && s.rowBorder,
                            index < rows.length - 1 && { borderBottomColor: colors.border },
                        ]}
                    >
                        <View style={s.rowCopy}>
                            <Text style={s.rowTitle}>{row.accountName}</Text>
                            <Text style={s.rowMeta}>{row.accountType}</Text>
                        </View>
                        <Text style={s.rowAmount}>{formatInr(row.amount)}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: {
        paddingHorizontal: DESIGN_SPACING.screenX,
        paddingBottom: 120,
        gap: DESIGN_SPACING.sectionGap,
    },
    metricRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
});

const sectionStyles = (colors: ColorPalette) => StyleSheet.create({
    wrap: {
        gap: Spacing.sm,
    },
    head: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Spacing.md,
        alignItems: 'flex-end',
    },
    title: {
        color: colors.text,
        fontSize: Typography.title.size,
        fontWeight: '700',
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: Typography.caption.size,
        marginTop: 2,
    },
    total: {
        color: colors.primary,
        fontSize: Typography.body.size,
        fontWeight: '800',
    },
    card: {
        borderRadius: Radius.card,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    rowBorder: {
        borderBottomWidth: 1,
    },
    rowCopy: {
        flex: 1,
    },
    rowTitle: {
        color: colors.text,
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    rowMeta: {
        color: colors.textSecondary,
        fontSize: Typography.caption.size,
        marginTop: 2,
    },
    rowAmount: {
        color: colors.text,
        fontSize: Typography.body.size,
        fontWeight: '800',
    },
});
