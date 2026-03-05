import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { accountingApi } from '../../../api/endpoints';
import { toUserMessage } from '../../../api/client';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useAuthStore } from '../../../store/authStore';

type LedgerRow = {
    id: string;
    code: string;
    name: string;
    type: string;
    debitTotal: number;
    creditTotal: number;
    balance: number;
    isActive: boolean;
    isSystem: boolean;
    isDefault: boolean;
};

export default function LedgersListScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/reports');
    const [search, setSearch] = useState('');
    const { selection } = useHaptics();
    const dialog = useAppDialog();
    const role = useAuthStore((state) => state.organizationRole);
    const canManageLedgers = role === 'owner' || role === 'manager';

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['reports-ledgers'],
        queryFn: () => accountingApi.getLedgers({ includeInactive: false }),
        staleTime: 60_000,
    });

    const rows = useMemo<LedgerRow[]>(() => data?.data?.data ?? [], [data?.data?.data]);
    const filteredRows = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return rows;
        return rows.filter((entry) => `${entry.name} ${entry.code} ${entry.type}`.toLowerCase().includes(needle));
    }, [rows, search]);

    const getTypeStyle = (type: string) => {
        const upper = type.toUpperCase();
        if (upper === 'ASSET') return { color: colors.success, bg: withAlpha(colors.success, '16'), icon: 'cash-plus' as const };
        if (upper === 'LIABILITY') return { color: colors.error, bg: withAlpha(colors.error, '16'), icon: 'cash-minus' as const };
        if (upper === 'INCOME') return { color: colors.primary, bg: withAlpha(colors.primary, '16'), icon: 'trending-up' as const };
        if (upper === 'EXPENSE') return { color: colors.warning, bg: withAlpha(colors.warning, '16'), icon: 'trending-down' as const };
        return { color: colors.info, bg: withAlpha(colors.info, '16'), icon: 'book-outline' as const };
    };

    const getDeactivateReason = (row: LedgerRow): string | null => {
        if (!canManageLedgers) return 'Your role cannot deactivate ledgers.';
        if (!row.isActive) return 'Ledger is already inactive.';
        if (row.isSystem || row.isDefault) return 'System/default ledgers cannot be deactivated.';
        const hasPostedEntries = Math.abs(Number(row.debitTotal ?? 0)) > 0.0001 || Math.abs(Number(row.creditTotal ?? 0)) > 0.0001;
        if (hasPostedEntries) return 'Ledger has posted entries and cannot be deactivated.';
        return null;
    };

    const { mutate: deactivateLedger, isPending: deactivating } = useMutation({
        mutationFn: (accountId: string) => accountingApi.deactivateAccount(accountId),
        onSuccess: () => {
            void refetch();
            dialog.alert('Ledger deactivated', 'Ledger has been deactivated successfully.');
        },
        onError: (error) => {
            dialog.alert('Deactivate failed', toUserMessage(error, 'Unable to deactivate this ledger.'));
        },
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Ledgers"
                subtitle="Account-wise balances"
                onBackPress={smartBack}
            />
            <View style={s.searchWrap}>
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search name, code or type..."
                />
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={filteredRows}
                    keyExtractor={(item) => item.id}
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
                    ListHeaderComponent={(
                        <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>LEDGERS</Text>
                            <Text style={s.summaryValue}>{filteredRows.length}</Text>
                            <Text style={[s.summaryMeta, { color: colors.textSecondary }]}>
                                {search.trim().length > 0 ? `Filtered from ${rows.length}` : 'Active ledgers only'}
                            </Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <Pressable
                            style={({ pressed }) => [
                                s.row,
                                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.84 : 1 },
                            ]}
                            onPress={() => {
                                void selection();
                                router.push(`/(main)/reports/ledgers/${item.id}` as Parameters<typeof router.push>[0]);
                            }}
                        >
                            <View style={{ flex: 1, gap: 4 }}>
                                <View style={s.rowTitleWrap}>
                                    <Text style={s.rowTitle}>{item.name}</Text>
                                    <View style={[s.typeBadge, { backgroundColor: getTypeStyle(item.type).bg }]}>
                                        <MaterialCommunityIcons name={getTypeStyle(item.type).icon} size={12} color={getTypeStyle(item.type).color} />
                                        <Text style={[s.typeBadgeText, { color: getTypeStyle(item.type).color }]}>{item.type}</Text>
                                    </View>
                                </View>
                                <Text style={s.rowMeta}>Code: {item.code}</Text>
                            </View>
                            <View style={s.numbers}>
                                <Text style={s.dr}>Dr {item.debitTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.cr}>Cr {item.creditTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.balance}>Bal {item.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            </View>
                            <Pressable
                                style={({ pressed }) => [
                                    s.deactivateBtn,
                                    {
                                        borderColor: getDeactivateReason(item) ? colors.border : colors.error,
                                        opacity: pressed ? 0.72 : 1,
                                    },
                                ]}
                                onPress={(event) => {
                                    event.stopPropagation();
                                    const reason = getDeactivateReason(item);
                                    if (reason) {
                                        dialog.alert('Cannot deactivate', reason);
                                        return;
                                    }
                                    dialog.alert('Deactivate ledger', `Deactivate "${item.name}"?`, [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: deactivating ? 'Deactivating...' : 'Deactivate',
                                            style: 'destructive',
                                            onPress: () => deactivateLedger(item.id),
                                        },
                                    ]);
                                }}
                            >
                                <MaterialCommunityIcons
                                    name={getDeactivateReason(item) ? 'lock-outline' : 'archive-arrow-down-outline'}
                                    size={14}
                                    color={getDeactivateReason(item) ? colors.textSecondary : colors.error}
                                />
                            </Pressable>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                        </Pressable>
                    )}
                    ListEmptyComponent={(
                        <View style={[s.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="book-search-outline" size={22} color={colors.textSecondary} />
                            <Text style={[s.emptyTitle, { color: colors.text }]}>No ledgers available</Text>
                            <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>Create accounting entries to generate ledgers.</Text>
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
        searchWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        summaryCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.md,
        },
        summaryLabel: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
        summaryValue: { marginTop: 4, color: colors.text, fontSize: Typography.headline.size, fontWeight: '800' },
        summaryMeta: { marginTop: 2, fontSize: Typography.caption.size },
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
        rowTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
        rowTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
        typeBadge: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.xs,
            paddingVertical: 2,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            overflow: 'hidden',
        },
        typeBadgeText: { fontSize: Typography.caption.size, fontWeight: '700' },
        rowMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        numbers: { alignItems: 'flex-end', gap: 2 },
        dr: { color: colors.success, fontWeight: '700', fontSize: 11 },
        cr: { color: colors.error, fontWeight: '700', fontSize: 11 },
        balance: { color: colors.textSecondary, fontWeight: '700', fontSize: 11 },
        deactivateBtn: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.xs,
            paddingVertical: 6,
            alignItems: 'center',
            justifyContent: 'center',
        },
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
