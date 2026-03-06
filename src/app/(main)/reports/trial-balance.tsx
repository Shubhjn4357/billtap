import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../api/endpoints';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useSmartBack } from '../../../hooks/useSmartBack';

type TrialRow = {
    accountId: string;
    accountName: string;
    accountType: string;
    debitTotal: number;
    creditTotal: number;
};

export default function TrialBalanceScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/reports');

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['reports-trial-balance'],
        queryFn: () => accountingApi.getTrialBalance(),
        staleTime: 60_000,
    });

    const rows: TrialRow[] = data?.data?.rows ?? [];
    const totals = data?.data?.totals ?? { debit: 0, credit: 0, isBalanced: true };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Trial Balance"
                subtitle="Dr/Cr integrity check"
                onBackPress={smartBack}
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
                                refetch();
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={s.summaryHeader}>
                                <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>BOOK STATUS</Text>
                                <View style={[s.balanceBadge, {
                                    backgroundColor: withAlpha(totals.isBalanced ? colors.success : colors.error, '16'),
                                }]}>
                                    <MaterialCommunityIcons
                                        name={totals.isBalanced ? 'check-circle-outline' : 'alert-circle-outline'}
                                        size={14}
                                        color={totals.isBalanced ? colors.success : colors.error}
                                    />
                                    <Text style={[s.balanceTag, { color: totals.isBalanced ? colors.success : colors.error }]}>
                                        {totals.isBalanced ? 'Balanced' : 'Mismatch'}
                                    </Text>
                                </View>
                            </View>
                            <View style={s.summaryGrid}>
                                <View style={[s.summaryCell, { backgroundColor: colors.surfaceVariant }]}>
                                    <Text style={[s.summaryCaption, { color: colors.textSecondary }]}>Total Debit</Text>
                                    <Text style={s.summaryValue}>Rs {totals.debit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                </View>
                                <View style={[s.summaryCell, { backgroundColor: colors.surfaceVariant }]}>
                                    <Text style={[s.summaryCaption, { color: colors.textSecondary }]}>Total Credit</Text>
                                    <Text style={s.summaryValue}>Rs {totals.credit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                </View>
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                        <View style={[s.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="database-search-outline" size={22} color={colors.textSecondary} />
                            <Text style={[s.emptyTitle, { color: colors.text }]}>No accounting entries yet</Text>
                            <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>Create vouchers to populate trial balance.</Text>
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
        summaryCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.md,
        },
        summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
        summaryLabel: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
        balanceBadge: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 3,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
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
        balanceTag: { fontSize: Typography.caption.size, fontWeight: '700' },
        row: {
            borderWidth: 1,
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
