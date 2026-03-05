import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { partyApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette, withAlpha } from '../../../constants/theme';
import type { Party } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { useHaptics } from '../../../hooks/useHaptics';

const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

export default function PartiesScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const dialog = useAppDialog();
    const [tab, setTab] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
    const [search, setSearch] = useState('');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const s = styles(colors);
    const qc = useQueryClient();
    const { selection, impact } = useHaptics();

    const openInfoDialog = (title: string, message: string) => {
        dialog.alert(title, message);
    };

    const openConfirmDialog = (title: string, message: string, onConfirm: () => void, destructive = false) => {
        dialog.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: destructive ? 'Archive' : 'Apply',
                style: destructive ? 'destructive' : 'default',
                onPress: onConfirm,
            },
        ]);
    };

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['parties', tab, search],
        queryFn: () => partyApi.list({ type: tab, q: search || undefined, limit: 200 }),
        staleTime: 60_000,
    });

    const parties = useMemo(() => (data?.data ?? []) as Party[], [data?.data]);

    const { mutate: bulkDelete, isPending: bulkDeleting } = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map((id) => partyApi.delete(id)));
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['parties'] });
            setSelectionMode(false);
            setSelectedIds([]);
        },
        onError: (error) => {
            openInfoDialog('Bulk delete failed', error instanceof Error ? error.message : 'Unable to archive selected parties.');
        },
    });

    const { mutate: bulkResetLimit, isPending: bulkUpdating } = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map((id) => partyApi.update(id, { creditLimit: 0 })));
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['parties'] });
            setSelectionMode(false);
            setSelectedIds([]);
        },
        onError: (error) => {
            openInfoDialog('Bulk update failed', error instanceof Error ? error.message : 'Unable to update selected parties.');
        },
    });

    const selectedCount = selectedIds.length;

    const requestBulkDelete = () => {
        if (selectedCount === 0) return;
        openConfirmDialog(
            'Archive selected parties',
            `Archive ${selectedCount} party(s)?`,
            () => bulkDelete(selectedIds),
            true
        );
    };

    const requestBulkResetLimit = () => {
        if (selectedCount === 0) return;
        openConfirmDialog(
            'Reset credit limit',
            `Set credit limit to 0 for ${selectedCount} party(s)?`,
            () => bulkResetLimit(selectedIds)
        );
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Parties"
                subtitle="Customers, suppliers and balances"
                rightAction={(
                    <View style={s.topActions}>
                        <Pressable
                            style={[s.topIconBtn, { borderColor: colors.border }]}
                            onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}
                        >
                            <MaterialCommunityIcons name="compass-outline" size={18} color={colors.primary} />
                        </Pressable>
                        <Pressable
                            style={[s.topIconBtn, { backgroundColor: colors.primary }]}
                            onPress={() => {
                                void impact();
                                router.push(`/(main)/parties/add?type=${tab}` as Parameters<typeof router.push>[0]);
                            }}
                        >
                            <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.onPrimary} />
                        </Pressable>
                    </View>
                )}
            />

            <View style={s.actionBar}>
                <View style={s.actionRow}>
                    <Pressable style={[s.actionChip, { borderColor: colors.border }]} onPress={() => {
                        void selection();
                        setSelectionMode((current) => !current);
                        setSelectedIds([]);
                    }}>
                        <MaterialCommunityIcons name={selectionMode ? 'close' : 'check-circle-outline'} size={14} color={colors.textSecondary} />
                        <Text style={[s.actionChipText, { color: colors.textSecondary }]}>
                            {selectionMode ? 'Cancel' : 'Select'}
                        </Text>
                    </Pressable>
                    <Pressable style={[s.actionChip, { borderColor: colors.border }]} onPress={() => {
                        void selection();
                        router.push('/(main)/parties/recycle-bin' as Parameters<typeof router.push>[0]);
                    }}>
                        <MaterialCommunityIcons name="delete-outline" size={14} color={colors.textSecondary} />
                        <Text style={[s.actionChipText, { color: colors.textSecondary }]}>Bin</Text>
                    </Pressable>
                </View>
            </View>

            <View style={s.tabs}>
                {(['CUSTOMER', 'SUPPLIER'] as const).map((entry) => (
                    <Pressable key={entry} style={[s.tab, tab === entry && s.activeTab]} onPress={() => {
                        void selection();
                        setTab(entry);
                    }}>
                        <Text style={[s.tabText, tab === entry && s.activeTabText]}>
                            {entry === 'CUSTOMER' ? 'Customers' : 'Suppliers'}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <View style={s.searchRow}>
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search by name, phone or GSTIN..."
                />
            </View>

            {selectionMode ? (
                <View style={s.bulkRow}>
                    <Text style={[s.bulkLabel, { color: colors.textSecondary }]}>Selected: {selectedCount}</Text>
                    <Pressable style={[s.bulkAction, { borderColor: colors.primary }]} onPress={requestBulkResetLimit} disabled={selectedCount === 0 || bulkUpdating}>
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>
                            {bulkUpdating ? 'Applying...' : 'Reset Limit'}
                        </Text>
                    </Pressable>
                    <Pressable style={[s.bulkAction, { borderColor: colors.error }]} onPress={requestBulkDelete} disabled={selectedCount === 0 || bulkDeleting}>
                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 11 }}>
                            {bulkDeleting ? 'Archiving...' : 'Archive'}
                        </Text>
                    </Pressable>
                </View>
            ) : null}

            {isLoading ? (
                <ListSkeleton rows={6} compact />
            ) : (
                <FlatList
                    data={parties}
                    keyExtractor={(entry) => entry.id}
                    renderItem={({ item }) => (
                        <PartyRow
                            party={item}
                            colors={colors}
                            selectionMode={selectionMode}
                            selected={selectedIds.includes(item.id)}
                            onToggleSelect={() => setSelectedIds((current) => toggleId(current, item.id))}
                            onOpen={() => router.push(`/(main)/parties/${item.id}` as Parameters<typeof router.push>[0])}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary }}>
                                No {tab === 'CUSTOMER' ? 'customers' : 'suppliers'} yet.
                            </Text>
                        </View>
                    }
                    refreshControl={(
                        <RefreshControl
                            refreshing={isRefetching && !isLoading}
                            onRefresh={() => {
                                void refetch();
                            }}
                            tintColor={colors.primary}
                        />
                    )}
                />
            )}
        </SafeAreaView>
    );
}

function PartyRow({
    party,
    colors,
    selectionMode,
    selected,
    onToggleSelect,
    onOpen,
}: {
    party: Party;
    colors: ColorPalette;
    selectionMode: boolean;
    selected: boolean;
    onToggleSelect: () => void;
    onOpen: () => void;
}) {
    const balanceColor = party.openingBalance > 0 ? colors.success : party.openingBalance < 0 ? colors.error : colors.textSecondary;
    return (
        <Pressable
            style={({ pressed }) => [
                rowStyles.row,
                {
                    backgroundColor: selected ? withAlpha(colors.primary, '20') : colors.card,
                    opacity: pressed ? 0.8 : 1,
                    borderColor: selected ? colors.primary : 'transparent',
                    borderWidth: selected ? 1 : 0,
                },
            ]}
            onPress={selectionMode ? onToggleSelect : onOpen}
        >
            {selectionMode ? (
                <View style={[rowStyles.selector, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? withAlpha(colors.primary, '22') : 'transparent' }]}>
                    <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                        {selected ? 'ON' : 'OFF'}
                    </Text>
                </View>
            ) : null}
            <View style={[rowStyles.avatar, { backgroundColor: withAlpha(colors.primary, '22') }]}>
                <Text style={[rowStyles.avatarText, { color: colors.primary }]}>{party.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={rowStyles.info}>
                <Text style={[rowStyles.name, { color: colors.text }]} numberOfLines={1}>{party.name}</Text>
                <Text style={[rowStyles.phone, { color: colors.textSecondary }]}>{party.phone ?? party.email ?? ''}</Text>
            </View>
            {party.openingBalance !== 0 ? (
                <Text style={[rowStyles.balance, { color: balanceColor }]}>
                    Rs {Math.abs(party.openingBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
            ) : null}
        </Pressable>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    topActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    topIconBtn: {
        width: 34,
        height: 34,
        borderWidth: 1,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBar: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    actionChip: {
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionChipText: { fontWeight: '700', fontSize: 12 },
    tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.sm },
    tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, backgroundColor: colors.surfaceVariant, alignItems: 'center' },
    activeTab: { backgroundColor: colors.primary },
    tabText: { fontWeight: '600', fontSize: 13, color: colors.textSecondary },
    activeTabText: { color: colors.onPrimary },
    searchRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    bulkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    bulkLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
    bulkAction: {
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
    },
    centered: { paddingTop: 80, alignItems: 'center' },
});

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
        borderRadius: Radius.card,
        gap: Spacing.md,
    },
    selector: {
        width: 42,
        borderWidth: 1,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '700' },
    info: { flex: 1 },
    name: { fontWeight: '600', fontSize: 14 },
    phone: { fontSize: 12, marginTop: 2 },
    balance: { fontWeight: '700', fontSize: 14 },
});

