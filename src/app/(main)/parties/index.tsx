import { useState } from 'react';
import {
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { partyApi } from '../../../api/endpoints';
import { Radius, Spacing, type ColorPalette, withAlpha } from '../../../constants/theme';
import type { Party } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppColors } from '../../../hooks/useAppColors';
import { useParties } from '../../../hooks/useParties';

const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

export default function PartiesScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const dialog = useAppDialog();
    const qc = useQueryClient();
    const { selection, impact } = useHaptics();
    const params = useLocalSearchParams<{ tab?: string }>();

    // Tab and filters
    const [tab, setTab] = useState<'CUSTOMER' | 'SUPPLIER'>(
        params.tab === 'supplier' ? 'SUPPLIER' : 'CUSTOMER'
    );
    const [search, setSearch] = useState('');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // -- useParties hook: reactive, shared, with stats --
    const { parties, stats, isLoading, isRefetching, refetch } = useParties({
        type: tab,
        search,
    });

    // -- Bulk mutations --
    const { mutate: bulkDelete, isPending: bulkDeleting } = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map((id) => partyApi.delete(id)));
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['parties'] });
            setSelectionMode(false);
            setSelectedIds([]);
        },
        onError: (err) => dialog.alert('Bulk delete failed', err instanceof Error ? err.message : 'Unable to archive selected parties.'),
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
        onError: (err) => dialog.alert('Bulk update failed', err instanceof Error ? err.message : 'Unable to reset limits.'),
    });

    const selectedCount = selectedIds.length;

    const requestBulkDelete = () => {
        if (selectedCount === 0) return;
        dialog.alert('Archive selected parties', `Archive ${selectedCount} party(s)?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Archive', style: 'destructive', onPress: () => bulkDelete(selectedIds) },
        ]);
    };

    const requestBulkResetLimit = () => {
        if (selectedCount === 0) return;
        dialog.alert('Reset credit limit', `Set credit limit to 0 for ${selectedCount} party(s)?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Apply', onPress: () => bulkResetLimit(selectedIds) },
        ]);
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
                            onPress={() => { void impact(); router.push(`/(main)/parties/add?type=${tab}` as Parameters<typeof router.push>[0]); }}
                        >
                            <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.onPrimary} />
                        </Pressable>
                    </View>
                )}
            />

            {/* Customer / Supplier tabs with balance summary */}
            <View style={s.tabBar}>
                {([
                    { key: 'CUSTOMER' as const, label: 'Customers' },
                    { key: 'SUPPLIER' as const, label: 'Suppliers' },
                ]).map((entry) => {
                    const sel = tab === entry.key;
                    return (
                        <Pressable key={entry.key}
                            style={[s.tab, { backgroundColor: sel ? colors.primary : colors.surfaceVariant }]}
                            onPress={() => { void selection(); setTab(entry.key); setSelectionMode(false); setSelectedIds([]); }}>
                            <Text style={[s.tabText, { color: sel ? colors.onPrimary : colors.textSecondary }]}>{entry.label}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Stats row */}
            {stats && !isLoading ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsScroll} contentContainerStyle={s.statsRow}>
                    <StatPill label="Total" value={tab === 'CUSTOMER' ? (stats?.totalCustomers ?? 0) : (stats?.totalSuppliers ?? 0)} icon="account-group-outline" colors={colors} />
                    {tab === 'CUSTOMER' ? (
                        <StatPill label="Receivable" value={stats?.totalReceivable ?? 0} prefix="₹" icon="arrow-down-circle-outline" color={colors.success} colors={colors} />
                    ) : (
                        <StatPill label="Payable" value={stats?.totalPayable ?? 0} prefix="₹" icon="arrow-up-circle-outline" color={colors.error} colors={colors} />
                    )}
                </ScrollView>
            ) : null}

            {/* Search */}
            <View style={s.searchRow}>
                <AppSearchBar value={search} onChangeText={setSearch} placeholder="Search by name, phone or GSTIN..." />
            </View>

            {/* Action toolbar */}
            <View style={s.actionBar}>
                <Pressable style={[s.actionChip, { borderColor: colors.border }]} onPress={() => { void selection(); setSelectionMode((c) => !c); setSelectedIds([]); }}>
                    <MaterialCommunityIcons name={selectionMode ? 'close' : 'check-circle-outline'} size={14} color={colors.textSecondary} />
                    <Text style={[s.actionChipText, { color: colors.textSecondary }]}>{selectionMode ? 'Cancel' : 'Select'}</Text>
                </Pressable>
                <Pressable style={[s.actionChip, { borderColor: colors.border }]} onPress={() => { void selection(); router.push('/(main)/parties/recycle-bin' as Parameters<typeof router.push>[0]); }}>
                    <MaterialCommunityIcons name="delete-outline" size={14} color={colors.textSecondary} />
                    <Text style={[s.actionChipText, { color: colors.textSecondary }]}>Bin</Text>
                </Pressable>
            </View>

            {/* Bulk action toolbar */}
            {selectionMode ? (
                <View style={s.bulkRow}>
                    <Text style={[s.bulkLabel, { color: colors.textSecondary }]}>Selected: {selectedCount}</Text>
                    <Pressable style={[s.bulkAction, { borderColor: colors.primary }]} onPress={requestBulkResetLimit} disabled={selectedCount === 0 || bulkUpdating}>
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>{bulkUpdating ? 'Applying…' : 'Reset Limit'}</Text>
                    </Pressable>
                    <Pressable style={[s.bulkAction, { borderColor: colors.error }]} onPress={requestBulkDelete} disabled={selectedCount === 0 || bulkDeleting}>
                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 11 }}>{bulkDeleting ? 'Archiving…' : 'Archive'}</Text>
                    </Pressable>
                </View>
            ) : null}

            {/* List */}
            {isLoading ? (
                <ListSkeleton rows={6} compact />
            ) : (
                <FlatList
                    data={parties}
                        keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <PartyRow
                            party={item}
                            colors={colors}
                            selectionMode={selectionMode}
                            selected={selectedIds.includes(item.id)}
                            onToggleSelect={() => setSelectedIds((c) => toggleId(c, item.id))}
                            onOpen={() => router.push(`/(main)/parties/${item.id}` as Parameters<typeof router.push>[0])}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={(
                            <View style={s.empty}>
                                <MaterialCommunityIcons name="account-off-outline" size={32} color={colors.textSecondary} />
                                <Text style={[s.emptyTitle, { color: colors.text }]}>
                                    No {tab === 'CUSTOMER' ? 'customers' : 'suppliers'} {search ? 'match' : 'yet'}
                            </Text>
                                {!search ? (
                                    <Pressable style={[s.addBtn, { backgroundColor: colors.primary }]}
                                        onPress={() => router.push(`/(main)/parties/add?type=${tab}` as Parameters<typeof router.push>[0])}>
                                        <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 13 }}>
                                            + Add {tab === 'CUSTOMER' ? 'Customer' : 'Supplier'}
                                        </Text>
                                    </Pressable>
                                ) : null}
                            </View>
                    )}
                        refreshControl={(<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => { void refetch(); }} tintColor={colors.primary} />)}
                />
            )}
        </SafeAreaView>
    );
}

// ── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, prefix, icon, color, colors }: {
    label: string; value: number; prefix?: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color?: string; colors: ColorPalette;
}) {
    const c = color ?? colors.primary;
    return (
        <View style={[pillS.pill, { backgroundColor: withAlpha(c, '14'), borderColor: withAlpha(c, '30') }]}>
            <MaterialCommunityIcons name={icon} size={12} color={c} />
            <Text style={[pillS.val, { color: c }]}>{prefix ?? ''}{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            <Text style={[pillS.label, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );
}

// ── Party Row ────────────────────────────────────────────────────────────────
function PartyRow({ party, colors, selectionMode, selected, onToggleSelect, onOpen }: {
    party: Party; colors: ColorPalette; selectionMode: boolean; selected: boolean; onToggleSelect: () => void; onOpen: () => void;
}) {
    const balance = party.openingBalance ?? 0;
    const balanceColor = balance > 0 ? colors.success : balance < 0 ? colors.error : colors.textSecondary;

    return (
        <Pressable
            style={({ pressed }) => [rowS.row, {
                backgroundColor: selected ? withAlpha(colors.primary, '16') : colors.card,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.83 : 1,
            }]}
            onPress={selectionMode ? onToggleSelect : onOpen}
        >
            {selectionMode ? (
                <View style={[rowS.selector, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? withAlpha(colors.primary, '22') : 'transparent' }]}>
                    <MaterialCommunityIcons name={selected ? 'check' : 'minus'} size={14} color={selected ? colors.primary : colors.textSecondary} />
                </View>
            ) : null}
            <View style={[rowS.avatar, { backgroundColor: withAlpha(colors.primary, '20') }]}>
                <Text style={[rowS.avatarText, { color: colors.primary }]}>{party.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={rowS.info}>
                <Text style={[rowS.name, { color: colors.text }]} numberOfLines={1}>{party.name}</Text>
                <Text style={[rowS.phone, { color: colors.textSecondary }]}>{party.phone ?? party.email ?? ''}</Text>
            </View>
            {balance !== 0 ? (
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[rowS.balance, { color: balanceColor }]}>
                        Rs {Math.abs(balance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Text>
                    <Text style={[rowS.balanceLabel, { color: colors.textSecondary }]}>{balance > 0 ? 'to receive' : 'to pay'}</Text>
                </View>
            ) : null}
        </Pressable>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    topIconBtn: { width: 34, height: 34, borderWidth: 1, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.xs },
    tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, alignItems: 'center' },
    tabText: { fontWeight: '700', fontSize: 13 },
    statsScroll: { flexGrow: 0 },
    statsRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
    searchRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs },
    actionBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.xs },
    actionChip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionChipText: { fontWeight: '700', fontSize: 12 },
    bulkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs },
    bulkLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
    bulkAction: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
    empty: { paddingTop: 80, alignItems: 'center', gap: 10 },
    emptyTitle: { fontWeight: '700', fontSize: 15 },
    addBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginTop: 4 },
});

const pillS = StyleSheet.create({
    pill: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
    val: { fontWeight: '800', fontSize: 13 },
    label: { fontSize: 11, fontWeight: '500' },
});

const rowS = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.xs, borderRadius: Radius.card, gap: Spacing.md, borderWidth: 1 },
    selector: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '700' },
    info: { flex: 1 },
    name: { fontWeight: '600', fontSize: 14 },
    phone: { fontSize: 12, marginTop: 2 },
    balance: { fontWeight: '800', fontSize: 14 },
    balanceLabel: { fontSize: 10, fontWeight: '500' },
});
