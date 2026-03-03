import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { partyApi } from '../../../api/endpoints';
import { useInvoiceBuilderStore } from '../../../store/invoiceBuilderStore';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';

export default function PartySelectScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const [search, setSearch] = useState('');

    const setParty = useInvoiceBuilderStore((state) => state.setParty);

    const { data, isLoading } = useQuery({
        queryKey: ['party-select', search],
        queryFn: () => partyApi.list({ q: search.trim() || undefined, limit: 200 }),
        staleTime: 30_000,
    });

    const parties = useMemo(() => data?.data ?? [], [data?.data]);

    const onSelect = (party: (typeof parties)[number]) => {
        setParty(party.id, {
            id: party.id,
            type: party.type,
            name: party.name,
            phone: party.phone ?? null,
            email: party.email ?? null,
            gstin: party.gstin ?? null,
            billingAddress: party.billingAddress ?? null,
            shippingAddress: party.shippingAddress ?? null,
        });
        router.back();
    };

    const clearParty = () => {
        setParty(null, null);
        router.back();
    };

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.headerAction, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Select Party</Text>
                <Pressable onPress={clearParty}>
                    <Text style={[s.headerAction, { color: colors.error }]}>Clear</Text>
                </Pressable>
            </View>

            <View style={s.searchWrap}>
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search by name, phone or GSTIN"
                    placeholderTextColor={colors.textSecondary}
                    style={[s.searchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                />
            </View>

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={parties}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Text style={[s.empty, { color: colors.textSecondary }]}>No party found.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            style={({ pressed }) => [
                                s.row,
                                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                            ]}
                            onPress={() => onSelect(item)}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[s.rowName, { color: colors.text }]}>{item.name}</Text>
                                <Text style={[s.rowMeta, { color: colors.textSecondary }]}>
                                    {item.type} {item.phone ? `- ${item.phone}` : ''}
                                </Text>
                                {item.gstin ? (
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]}>GSTIN: {item.gstin}</Text>
                                ) : null}
                            </View>
                            <Text style={[s.chevron, { color: colors.textSecondary }]}>{'>'}</Text>
                        </Pressable>
                    )}
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
        headerAction: { fontSize: 14, fontWeight: '700' },
        title: { fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
        searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
        searchInput: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            fontSize: 14,
        },
        centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl },
        empty: { fontSize: 13 },
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
        rowName: { fontSize: 14, fontWeight: '700' },
        rowMeta: { fontSize: 12, marginTop: 2 },
        chevron: { fontSize: 16, fontWeight: '700' },
    });


