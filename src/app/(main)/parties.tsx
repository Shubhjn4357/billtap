// @ts-nocheck
import { View, Text, FlatList, Pressable, StyleSheet, useColorScheme, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { partyApi } from '../../api/endpoints';
import { Spacing, Radius, Typography, type ColorPalette } from '../../constants/theme';
import type { Party } from '../../types/domain';

export default function PartiesScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];
    const [tab, setTab] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
    const [search, setSearch] = useState('');
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['parties', tab, search],
        queryFn: () => partyApi.list({ type: tab, q: search || undefined, limit: 100 }),
        staleTime: 60_000,
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Text style={s.title}>Parties</Text>
                <Pressable style={s.addBtn} onPress={() => router.push(`/(main)/parties/add?type=${tab}` as Parameters<typeof router.push>[0])}>
                    <Text style={s.addBtnText}>+ Add</Text>
                </Pressable>
            </View>

            <View style={s.tabs}>
                {(['CUSTOMER', 'SUPPLIER'] as const).map((t) => (
                    <Pressable key={t} style={[s.tab, tab === t && s.activeTab]} onPress={() => setTab(t)}>
                        <Text style={[s.tabText, tab === t && s.activeTabText]}>
                            {t === 'CUSTOMER' ? '👤 Customers' : '🏭 Suppliers'}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <View style={s.searchRow}>
                <TextInput
                    style={[s.searchInput, { color: colors.text }]}
                    placeholder="Search by name or phone…"
                    placeholderTextColor={colors.textSecondary}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={data?.data ?? []}
                    keyExtractor={(p) => p.id}
                    renderItem={({ item }) => <PartyRow party={item} colors={colors} />}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary }}>
                                No {tab === 'CUSTOMER' ? 'customers' : 'suppliers'} yet.
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

function PartyRow({ party, colors }: { party: Party; colors: ColorPalette }) {
    const balanceColor = party.openingBalance > 0 ? colors.success : party.openingBalance < 0 ? colors.error : colors.textSecondary;
    return (
        <Pressable
            style={({ pressed }) => [rowStyles.row, { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => router.push(`/(main)/parties/${party.id}` as Parameters<typeof router.push>[0])}
        >
            <View style={rowStyles.avatar}>
                <Text style={rowStyles.avatarText}>{party.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={rowStyles.info}>
                <Text style={[rowStyles.name, { color: colors.text }]} numberOfLines={1}>{party.name}</Text>
                <Text style={[rowStyles.phone, { color: colors.textSecondary }]}>{party.phone ?? party.email ?? ''}</Text>
            </View>
            {party.openingBalance !== 0 && (
                <Text style={[rowStyles.balance, { color: balanceColor }]}>
                    ₹{Math.abs(party.openingBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
            )}
        </Pressable>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    title: { fontSize: Typography.headline.size, fontWeight: '700', color: colors.text },
    addBtn: { backgroundColor: colors.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
    addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.sm },
    tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, backgroundColor: colors.surfaceVariant, alignItems: 'center' },
    activeTab: { backgroundColor: colors.primary },
    tabText: { fontWeight: '600', fontSize: 13, color: colors.textSecondary },
    activeTabText: { color: '#fff' },
    searchRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    searchInput: { backgroundColor: colors.surfaceVariant, borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, fontSize: 14 },
    centered: { paddingTop: 80, alignItems: 'center' },
});

const rowStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.card, gap: Spacing.md },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#007B8322', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '700', color: '#007B83' },
    info: { flex: 1 },
    name: { fontWeight: '600', fontSize: 14 },
    phone: { fontSize: 12, marginTop: 2 },
    balance: { fontWeight: '700', fontSize: 14 },
});


