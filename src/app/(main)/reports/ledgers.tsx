import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';

type LedgerRow = {
    id: string;
    code: string;
    name: string;
    type: string;
    debitTotal: number;
    creditTotal: number;
    balance: number;
    isActive: boolean;
};

export default function LedgersListScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['reports-ledgers'],
        queryFn: () => accountingApi.getLedgers({ includeInactive: false }),
        staleTime: 60_000,
    });

    const rows: LedgerRow[] = data?.data?.data ?? [];

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Ledgers</Text>
                <View style={{ width: 44 }} />
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    renderItem={({ item }) => (
                        <Pressable
                            style={({ pressed }) => [
                                s.row,
                                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 },
                            ]}
                            onPress={() => router.push(`/(main)/reports/ledgers/${item.id}` as Parameters<typeof router.push>[0])}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={s.rowTitle}>{item.name}</Text>
                                <Text style={s.rowMeta}>{item.code} | {item.type}</Text>
                            </View>
                            <View style={s.numbers}>
                                <Text style={s.dr}>Dr {item.debitTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.cr}>Cr {item.creditTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                                <Text style={s.balance}>Bal {item.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            </View>
                        </Pressable>
                    )}
                    ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No ledgers available.</Text>}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        back: { fontWeight: '600', fontSize: 14 },
        title: { fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
        numbers: { alignItems: 'flex-end', gap: 1 },
        dr: { color: colors.success, fontWeight: '700', fontSize: 11 },
        cr: { color: colors.error, fontWeight: '700', fontSize: 11 },
        balance: { color: colors.textSecondary, fontWeight: '700', fontSize: 11 },
    });
