import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DESIGN_SPACING, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { useCurrentBusiness } from '../../../hooks/useCurrentBusiness';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { UtilityEmptyState, UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useTrialBalance } from '../../../hooks/useAccountingMutations';
import { exportReportDocument } from '../../../utils/reportDocument';

export default function TrialBalanceScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const dialog = useAppDialog();
    const smartBack = useSmartBack('/(main)/reports');
    const { business } = useCurrentBusiness();
    const { rows, totals, isLoading, isRefetching, refetch } = useTrialBalance({
        staleTime: 60_000,
    });

    const handleExport = async () => {
        try {
            await exportReportDocument({
                title: 'Trial Balance',
                subtitle: 'Debit and credit integrity across visible accounts.',
                businessName: business?.name,
                contextLabel: totals.isBalanced ? 'Books balanced' : 'Mismatch detected',
                documentKind: 'trial-balance',
                summaryMetrics: [
                    { label: 'Debit', value: `Rs ${totals.debit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` },
                    { label: 'Credit', value: `Rs ${totals.credit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` },
                    { label: 'Status', value: totals.isBalanced ? 'Balanced' : 'Mismatch' },
                ],
                sections: [
                    {
                        title: 'Ledger Position',
                        caption: 'Visible debit and credit totals by account.',
                        columns: [
                            { label: 'Account' },
                            { label: 'Type' },
                            { label: 'Debit', align: 'right' },
                            { label: 'Credit', align: 'right' },
                        ],
                        rows: rows.map((row) => [
                            row.accountName,
                            row.accountType,
                            row.debitTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
                            row.creditTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
                        ]),
                    },
                ],
            });
        } catch (error) {
            dialog.alert('Export failed', error instanceof Error ? error.message : 'Unable to export trial balance.');
        }
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Trial Balance"
                subtitle="Dr/Cr integrity check"
                onBackPress={smartBack}
                actions={[
                    { icon: 'file-pdf-box', label: 'Export trial balance', onPress: handleExport, accent: colors.warning },
                ]}
                contextChip={{ label: totals.isBalanced ? 'Balanced' : 'Review', accent: totals.isBalanced ? colors.success : colors.warning }}
            />
            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item) => item.accountId}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                void refetch();
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <>
                            <View style={s.heroWrap}>
                                <UtilityHero
                                    title="Trial Balance"
                                    subtitle="Review debit and credit integrity across all visible accounts."
                                    icon="scale-balance"
                                    tone={totals.isBalanced ? 'success' : 'danger'}
                                />
                            </View>
                            <View style={s.statsRow}>
                                <HubMetricCard label="Book Status" value={totals.isBalanced ? 'Balanced' : 'Mismatch'} meta="Debit vs credit check" tone={totals.isBalanced ? 'success' : 'danger'} />
                                <HubMetricCard label="Total Debit" value={`Rs ${totals.debit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} meta="Visible debit" tone="info" />
                                <HubMetricCard label="Total Credit" value={`Rs ${totals.credit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} meta="Visible credit" tone="warning" />
                            </View>
                        </>
                    }
                    renderItem={({ item }) => (
                        <View style={[s.row, getSurfaceStyle(colors, { elevated: true })]}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.rowTitle}>{item.accountName}</Text>
                                <Text style={s.rowMeta}>{item.accountType}</Text>
                            </View>
                            <View style={s.numbers}>
                                <Text style={s.dr}>Dr {item.debitTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.cr}>Cr {item.creditTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={(
                        <View style={s.emptyWrap}>
                            <UtilityEmptyState icon="database-search-outline" title="No accounting entries yet" description="Create vouchers to populate trial balance." />
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
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        heroWrap: { marginBottom: Spacing.sm },
        statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
        row: {
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        rowTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
        rowMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        numbers: { alignItems: 'flex-end', gap: 2 },
        dr: { color: colors.success, fontWeight: '700', fontSize: 12 },
        cr: { color: colors.error, fontWeight: '700', fontSize: 12 },
        emptyWrap: { paddingVertical: Spacing.lg },
    });
