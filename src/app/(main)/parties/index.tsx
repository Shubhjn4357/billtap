import { useMemo, useState } from 'react';
import {
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, type ColorPalette, withAlpha } from '../../../constants/theme';
import type { Party } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { EmptyStateCard } from '../../../components/ui/ListBlocks';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppColors } from '../../../hooks/useAppColors';
import { useParties } from '../../../hooks/useParties';
import { usePartyMutations } from '../../../hooks/usePartyMutations';

const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

export default function PartiesScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const dialog = useAppDialog();
    const { selection, impact } = useHaptics();
    const params = useLocalSearchParams<{ tab?: string }>();

    const [tab, setTab] = useState<'CUSTOMER' | 'SUPPLIER'>(
        params.tab === 'supplier' ? 'SUPPLIER' : 'CUSTOMER'
    );
    const [search, setSearch] = useState('');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const { parties, stats, isLoading, isRefetching, refetch } = useParties({
        type: tab,
        search,
    });

    const {
        archiveParties,
        resetPartyCreditLimits,
        isArchivingParties: bulkDeleting,
        isResettingPartyCreditLimits: bulkUpdating,
    } = usePartyMutations();

    const selectedCount = selectedIds.length;
    const partiesWithBalance = useMemo(
        () => parties.filter((party) => Math.abs(Number(party.openingBalance ?? 0)) > 0).length,
        [parties]
    );

    const requestBulkDelete = () => {
        if (selectedCount === 0) return;
        dialog.alert('Archive selected parties', `Archive ${selectedCount} party(s)?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Archive',
                style: 'destructive',
                onPress: () => {
                    void archiveParties(selectedIds)
                        .then(() => {
                            setSelectionMode(false);
                            setSelectedIds([]);
                        })
                        .catch((err) => {
                            dialog.alert('Bulk delete failed', err instanceof Error ? err.message : 'Unable to archive selected parties.');
                        });
                },
            },
        ]);
    };

    const requestBulkResetLimit = () => {
        if (selectedCount === 0) return;
        dialog.alert('Reset credit limit', `Set credit limit to 0 for ${selectedCount} party(s)?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Apply',
                onPress: () => {
                    void resetPartyCreditLimits(selectedIds)
                        .then(() => {
                            setSelectionMode(false);
                            setSelectedIds([]);
                        })
                        .catch((err) => {
                            dialog.alert('Bulk update failed', err instanceof Error ? err.message : 'Unable to reset limits.');
                        });
                },
            },
        ]);
    };

    const heroTitle = tab === 'CUSTOMER' ? 'Customer Hub' : 'Supplier Hub';
    const heroSubtitle = tab === 'CUSTOMER'
        ? 'Track receivables, balances, and customer follow-up from one place.'
        : 'Track payables, supplier balances, and purchase-side relationships.';
    const primaryBalance = tab === 'CUSTOMER' ? Number(stats?.totalReceivable ?? 0) : Number(stats?.totalPayable ?? 0);
    const primaryBalanceLabel = tab === 'CUSTOMER' ? 'Receivable' : 'Payable';
    const primaryTone = tab === 'CUSTOMER' ? 'success' : 'danger';

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

            <View style={s.heroWrap}>
                <UtilityHero
                    title={heroTitle}
                    subtitle={heroSubtitle}
                    icon={tab === 'CUSTOMER' ? 'account-group-outline' : 'truck-delivery-outline'}
                    tone={tab === 'CUSTOMER' ? 'success' : 'warning'}
                />
            </View>

            <View style={s.tabBar}>
                {([
                    { key: 'CUSTOMER' as const, label: 'Customers' },
                    { key: 'SUPPLIER' as const, label: 'Suppliers' },
                ]).map((entry) => {
                    const selected = tab === entry.key;
                    return (
                        <ChipButton
                            key={entry.key}
                            label={entry.label}
                            selected={selected}
                            tone={entry.key === 'CUSTOMER' ? 'success' : 'warning'}
                            onPress={() => {
                                void selection();
                                setTab(entry.key);
                                setSelectionMode(false);
                                setSelectedIds([]);
                            }}
                        />
                    );
                })}
            </View>

            {!isLoading ? (
                <View style={s.statsRow}>
                    <HubMetricCard
                        label="Visible"
                        value={String(parties.length)}
                        meta={tab === 'CUSTOMER' ? 'Customers in view' : 'Suppliers in view'}
                        tone="info"
                    />
                    <HubMetricCard
                        label={primaryBalanceLabel}
                        value={`Rs ${primaryBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        meta={tab === 'CUSTOMER' ? 'Amount to receive' : 'Amount to pay'}
                        tone={primaryTone}
                    />
                    <HubMetricCard
                        label="With Balance"
                        value={String(partiesWithBalance)}
                        meta="Need follow-up"
                        tone="warning"
                    />
                </View>
            ) : null}

            <View style={s.searchRow}>
                <AppSearchBar value={search} onChangeText={setSearch} placeholder="Search by name, phone or GSTIN..." />
            </View>

            <View style={s.actionBar}>
                <ChipButton
                    label={selectionMode ? 'Cancel' : 'Select'}
                    icon={selectionMode ? 'close' : 'check-circle-outline'}
                    variant="action"
                    tone="info"
                    onPress={() => { void selection(); setSelectionMode((current) => !current); setSelectedIds([]); }}
                />
                <ChipButton
                    label="Bin"
                    icon="delete-outline"
                    variant="action"
                    tone="warning"
                    onPress={() => { void selection(); router.push('/(main)/parties/recycle-bin' as Parameters<typeof router.push>[0]); }}
                />
            </View>

            {selectionMode ? (
                <View style={s.bulkRow}>
                    <Text style={[s.bulkLabel, { color: colors.textSecondary }]}>Selected: {selectedCount}</Text>
                    <Pressable style={[s.bulkAction, { borderColor: colors.primary }]} onPress={requestBulkResetLimit} disabled={selectedCount === 0 || bulkUpdating}>
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>{bulkUpdating ? 'Applying...' : 'Reset Limit'}</Text>
                    </Pressable>
                    <Pressable style={[s.bulkAction, { borderColor: colors.error }]} onPress={requestBulkDelete} disabled={selectedCount === 0 || bulkDeleting}>
                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 11 }}>{bulkDeleting ? 'Archiving...' : 'Archive'}</Text>
                    </Pressable>
                </View>
            ) : null}

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
                            onToggleSelect={() => setSelectedIds((current) => toggleId(current, item.id))}
                            onOpen={() => router.push(`/(main)/parties/${item.id}` as Parameters<typeof router.push>[0])}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={(
                        <EmptyStateCard
                            icon="account-off-outline"
                            title={`No ${tab === 'CUSTOMER' ? 'customers' : 'suppliers'} ${search ? 'match' : 'yet'}`}
                            subtitle={search ? 'Try a different name, phone number, or GSTIN.' : `Create your first ${tab === 'CUSTOMER' ? 'customer' : 'supplier'} to start posting invoices and balances.`}
                            tone={tab === 'CUSTOMER' ? 'success' : 'warning'}
                            actionLabel={!search ? `Add ${tab === 'CUSTOMER' ? 'Customer' : 'Supplier'}` : undefined}
                            onActionPress={!search ? () => router.push(`/(main)/parties/add?type=${tab}` as Parameters<typeof router.push>[0]) : undefined}
                        />
                    )}
                    refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => { void refetch(); }} tintColor={colors.primary} />}
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
    const balance = Number(party.openingBalance ?? 0);
    const balanceColor = balance > 0 ? colors.success : balance < 0 ? colors.error : colors.textSecondary;

    return (
        <Pressable
            style={({ pressed }) => [
                rowS.row,
                {
                    backgroundColor: selected ? withAlpha(colors.primary, '16') : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: pressed ? 0.83 : 1,
                },
            ]}
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
                <View style={rowS.balanceWrap}>
                    <Text style={[rowS.balance, { color: balanceColor }]}>Rs {Math.abs(balance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    <Text style={[rowS.balanceLabel, { color: colors.textSecondary }]}>{balance > 0 ? 'to receive' : 'to pay'}</Text>
                </View>
            ) : null}
        </Pressable>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    topIconBtn: { width: 34, height: 34, borderWidth: 1, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    heroWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.xs },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, gap: Spacing.sm },
    searchRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs },
    actionBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.xs },
    bulkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs },
    bulkLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
    bulkAction: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
});

const rowS = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.xs, borderRadius: Radius.card, gap: Spacing.md, borderWidth: 1 },
    selector: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '700' },
    info: { flex: 1 },
    name: { fontWeight: '600', fontSize: 14 },
    phone: { fontSize: 12, marginTop: 2 },
    balanceWrap: { alignItems: 'flex-end' },
    balance: { fontWeight: '800', fontSize: 14 },
    balanceLabel: { fontSize: 10, fontWeight: '500' },
});
