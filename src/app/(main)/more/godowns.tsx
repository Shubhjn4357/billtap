import { View, Text, FlatList, Pressable, ScrollView, StyleSheet, useColorScheme, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { godownApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../constants/theme';
import type { Godown } from '../../../types/domain';

export default function GodownsScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const qc = useQueryClient();
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['godowns'],
        queryFn: () => godownApi.list(),
        staleTime: 60_000,
    });

    const { mutate: deleteGodown } = useMutation({
        mutationFn: (id: string) => godownApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['godowns'] }),
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed'),
    });

    const godowns = (data?.data ?? []) as Godown[];

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Back</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>Godowns / Warehouses</Text>
                <Pressable style={s.addBtn} onPress={() => router.push('/(main)/more/godowns/add' as Parameters<typeof router.push>[0])}>
                    <Text style={s.addBtnText}>+ Add</Text>
                </Pressable>
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : godowns.length === 0 ? (
                <View style={s.centered}>
                    <Text style={{ fontSize: 40 }}>🏭</Text>
                    <Text style={{ color: colors.textSecondary, marginTop: Spacing.md }}>No godowns configured.</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Add warehouses to track stock location.</Text>
                    <Pressable style={[s.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(main)/more/godowns/add' as Parameters<typeof router.push>[0])}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Godown</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={godowns}
                    keyExtractor={(g) => g.id}
                    renderItem={({ item: g }) => (
                        <Pressable
                            style={[rowS.row, { backgroundColor: colors.card }]}
                            onPress={() => router.push(`/(main)/more/godowns/${g.id}` as Parameters<typeof router.push>[0])}
                            onLongPress={() => Alert.alert('Delete Godown', `Delete "${g.name}"?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => deleteGodown(g.id) },
                            ])}
                        >
                            <View style={rowS.icon}><Text style={{ fontSize: 24 }}>🏭</Text></View>
                            <View style={{ flex: 1 }}>
                                <Text style={[rowS.name, { color: colors.text }]}>{g.name}</Text>
                                {g.address && <Text style={[rowS.meta, { color: colors.textSecondary }]}>📍 {g.address}</Text>}
                                {g.managerName && <Text style={[rowS.meta, { color: colors.textSecondary }]}>👤 {g.managerName}</Text>}
                            </View>
                            <View style={rowS.stockTag}>
                                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>View Stock →</Text>
                            </View>
                        </Pressable>
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}
        </SafeAreaView>
    );
}

const rowS = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.card, gap: Spacing.md },
    icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007B8322', alignItems: 'center', justifyContent: 'center' },
    name: { fontWeight: '600', fontSize: 15 },
    meta: { fontSize: 12, marginTop: 2 },
    stockTag: {},
});

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 15, marginHorizontal: Spacing.sm },
    addBtn: { backgroundColor: colors.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
    addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    emptyBtn: { marginTop: Spacing.md, borderRadius: Radius.pill, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
});
