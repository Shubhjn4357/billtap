import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { offerApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import type { Offer } from '../../../types/domain';

export default function AnnouncementsScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['active-offers'],
        queryFn: () => offerApi.getActive(),
        staleTime: 60_000,
    });

    const offers = (data?.data ?? []) as Offer[];

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>{'< Back'}</Text>
                </Pressable>
                <Text style={[s.title, { color: colors.text }]}>Announcements</Text>
                <View style={{ width: 58 }} />
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={offers}
                    keyExtractor={(item) => item.id}
                    ListEmptyComponent={<View style={s.centered}><Text style={{ color: colors.textSecondary }}>No active announcements.</Text></View>}
                    renderItem={({ item }) => (
                        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <Text style={[s.cardTitle, { color: colors.text }]}>{item.title}</Text>
                            <Text style={[s.cardMessage, { color: colors.textSecondary }]}>{item.message}</Text>
                            {(item.ctaText || item.ctaRoute) ? (
                                <Text style={[s.cardMeta, { color: colors.primary }]}>{`${item.ctaText ?? 'Open'} ${item.ctaRoute ?? ''}`.trim()}</Text>
                            ) : null}
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
        card: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
            borderWidth: 1,
            padding: Spacing.md,
        },
        cardTitle: { fontWeight: '700', fontSize: 15 },
        cardMessage: { fontSize: 13, marginTop: 6, lineHeight: 18 },
        cardMeta: { marginTop: 8, fontWeight: '700', fontSize: 12 },
    });
