import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSmartBack } from '../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING } from '../../../constants/designSystem';
import { Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { UtilityBanner, UtilityEmptyState, UtilityHero, UtilityPanel } from '../../../components/ui/UtilityBlocks';
import { useActiveOffers } from '../../../hooks/useOffers';
import { openOfferDestination } from '../../../utils/offerNavigation';

export default function AnnouncementsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');

    const { offers, isLoading, isRefetching, refetch, data } = useActiveOffers();
    const cacheMessage = /offline cache/i.test(String(data?.message ?? '')) ? data?.message : null;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Announcements"
                subtitle="Offers and system notices"
                onBackPress={smartBack}
            />

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={offers}
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
                    ListHeaderComponent={(
                        <View style={s.headerWrap}>
                            <UtilityHero
                                title="Announcements"
                                subtitle="Offers, release notices, and subscription prompts from the platform."
                                icon="bullhorn-outline"
                                tone="info"
                            />
                            {cacheMessage ? (
                                <View style={s.bannerWrap}>
                                    <UtilityBanner message={cacheMessage} />
                                </View>
                            ) : null}
                        </View>
                    )}
                    ListEmptyComponent={(
                        <UtilityEmptyState
                            icon="bullhorn-outline"
                            title="No announcements"
                            description="There are no active announcements right now."
                        />
                    )}
                    renderItem={({ item }) => (
                        <UtilityPanel tone="info" onPress={item.ctaRoute ? () => { void openOfferDestination(item.ctaRoute); } : undefined}>
                            <View style={s.titleRow}>
                                <MaterialCommunityIcons name="bullhorn-outline" size={18} color={colors.primary} />
                                <Text style={[s.cardTitle, { color: colors.text }]}>{item.title}</Text>
                            </View>
                            <Text style={[s.cardMessage, { color: colors.textSecondary }]}>{item.message}</Text>
                            {(item.ctaText || item.ctaRoute) ? (
                                <Text style={[s.cardMeta, { color: colors.primary }]}>
                                    {`${item.ctaText ?? 'Open'}${item.ctaRoute ? ' -> Tap to open' : ''}`}
                                </Text>
                            ) : null}
                        </UtilityPanel>
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
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        headerWrap: {
            marginHorizontal: DESIGN_SPACING.screenX,
            marginBottom: Spacing.sm,
            gap: Spacing.sm,
        },
        bannerWrap: {
            marginBottom: Spacing.xs,
        },
        card: {
            marginHorizontal: DESIGN_SPACING.screenX,
            marginBottom: Spacing.sm,
        },
        titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
        cardTitle: { fontWeight: '700', fontSize: 15 },
        cardMessage: { fontSize: 13, marginTop: 6, lineHeight: 18 },
        cardMeta: { marginTop: 8, fontWeight: '700', fontSize: 12 },
    });
