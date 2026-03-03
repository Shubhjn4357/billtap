import { useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { godownApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../../constants/theme';
import type { GodownStockEntry } from '../../../../types/domain';

export default function GodownDetailScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const s = styles(colors);
    const { id } = useLocalSearchParams<{ id: string }>();

    const godownId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

    const { data, isLoading } = useQuery({
        queryKey: ['godown-stock', godownId],
        queryFn: () => godownApi.getStock(godownId as string),
        enabled: Boolean(godownId),
        staleTime: 30_000,
    });

    const stock = (data?.data ?? []) as GodownStockEntry[];

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>{'< Back'}</Text>
                </Pressable>
                <Text style={[s.title, { color: colors.text }]}>Godown Stock</Text>
                <View style={{ width: 58 }} />
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={stock}
                    keyExtractor={(item) => item.itemId}
                    ListEmptyComponent={<View style={s.centered}><Text style={{ color: colors.textSecondary }}>No stock entries found.</Text></View>}
                    renderItem={({ item }) => (
                        <View style={[s.row, { backgroundColor: colors.card }]}> 
                            <View style={{ flex: 1 }}>
                                <Text style={[s.itemName, { color: colors.text }]}>{item.itemName ?? item.itemId}</Text>
                                <Text style={[s.meta, { color: colors.textSecondary }]}>{item.itemSku ?? 'No SKU'}</Text>
                            </View>
                            <Text style={[s.qty, { color: colors.primary }]}>{`${item.quantity} ${item.itemUnit ?? ''}`.trim()}</Text>
                        </View>
                    )}
                    contentContainerStyle={{ paddingBottom: 120 }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
        back: { width: 58, fontWeight: '600', fontSize: 14 },
        title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        row: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
            padding: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        itemName: { fontWeight: '700', fontSize: 14 },
        meta: { fontSize: 12, marginTop: 2 },
        qty: { fontWeight: '700', fontSize: 14 },
    });
