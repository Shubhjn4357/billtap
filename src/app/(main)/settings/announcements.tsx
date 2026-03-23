import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
    DESIGN_SPACING,
    getSurfaceStyle,
} from '../../../constants/designSystem';
import {
    Radius,
    Spacing,
    Typography,
    type ColorPalette,
    withAlpha,
} from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { useSmartBack } from '../../../hooks/useSmartBack';
import {
    SettingsHeroCard,
    SettingsPageShell,
    SettingsSectionGroup,
    SettingsStatusPill,
} from '../../../components/settings/SettingsBlocks';
import { useActiveOffers } from '../../../hooks/useOffers';
import { openOfferDestination } from '../../../utils/offerNavigation';

export default function AnnouncementsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/settings/notifications');

    const { offers, isLoading, isRefetching, refetch, data } = useActiveOffers();
    const cacheMessage = /offline cache/i.test(String(data?.message ?? '')) ? data?.message : null;

    return (
        <SettingsPageShell
            title="Announcements"
            subtitle="Offers, release notices, and system communication"
            onBackPress={smartBack}
            scrollProps={{
                refreshControl: (
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefetching}
                        onRefresh={() => {
                            void refetch();
                        }}
                    />
                ),
            }}
        >
            <SettingsHeroCard
                title="Announcement feed"
                subtitle="Product notices and active offer cards stay under Notifications, not in a separate More hub."
                primaryLabel={offers.length > 0 ? `${offers.length} live` : 'No live cards'}
                secondaryLabel={cacheMessage ? 'Offline cache' : 'Fresh feed'}
            />

            {cacheMessage ? (
                <SettingsSectionGroup
                    title="Feed state"
                    subtitle="The app should tell you when this list is being served from cached data."
                >
                    <View style={[s.infoCard, getSurfaceStyle(colors, { accent: colors.info, muted: true })]}>
                        <MaterialCommunityIcons name="information-outline" size={18} color={colors.info} />
                        <Text style={s.infoText}>{cacheMessage}</Text>
                    </View>
                </SettingsSectionGroup>
            ) : null}

            <SettingsSectionGroup
                title="Live cards"
                subtitle="Announcements should look like clear cards with obvious call to action."
                action={<SettingsStatusPill label={`${offers.length} items`} tone="info" />}
            >
                {isLoading ? (
                    <View style={s.centered}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : offers.length === 0 ? (
                    <View style={[s.emptyCard, getSurfaceStyle(colors, { muted: true })]}>
                        <MaterialCommunityIcons name="bullhorn-outline" size={24} color={colors.textSecondary} />
                        <Text style={s.emptyTitle}>No announcements</Text>
                        <Text style={s.emptySubtitle}>
                            There are no active announcement cards right now.
                        </Text>
                    </View>
                ) : (
                    offers.map((item) => (
                        <Pressable
                            key={item.id}
                            style={({ pressed }) => [
                                s.feedCard,
                                getSurfaceStyle(colors, { accent: colors.primary, elevated: true }),
                                pressed ? { opacity: 0.92 } : null,
                            ]}
                            disabled={!item.ctaRoute}
                            onPress={() => {
                                if (item.ctaRoute) {
                                    void openOfferDestination(item.ctaRoute);
                                }
                            }}
                        >
                            <View style={s.feedHeader}>
                                <View
                                    style={[
                                        s.feedIconWrap,
                                        {
                                            backgroundColor: withAlpha(colors.primary, colors.isDark ? '22' : '12'),
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons name="bullhorn-outline" size={18} color={colors.primary} />
                                </View>
                                <View style={s.feedCopy}>
                                    <Text style={s.feedTitle}>{item.title}</Text>
                                    <Text style={s.feedMessage}>{item.message}</Text>
                                </View>
                            </View>

                            <View style={s.feedMeta}>
                                <SettingsStatusPill label={item.audience} tone="info" />
                                {item.startsAt ? (
                                    <SettingsStatusPill
                                        label={`From ${new Date(item.startsAt).toLocaleDateString('en-IN')}`}
                                        tone="neutral"
                                    />
                                ) : null}
                                {item.endsAt ? (
                                    <SettingsStatusPill
                                        label={`Till ${new Date(item.endsAt).toLocaleDateString('en-IN')}`}
                                        tone="warning"
                                    />
                                ) : null}
                            </View>

                            {(item.ctaText || item.ctaRoute) ? (
                                <Text style={s.feedCta}>
                                    {`${item.ctaText ?? 'Open'}${item.ctaRoute ? ' -> Tap to open' : ''}`}
                                </Text>
                            ) : null}
                        </Pressable>
                    ))
                )}
            </SettingsSectionGroup>
        </SettingsPageShell>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        infoCard: {
            borderRadius: Radius.card,
            paddingHorizontal: DESIGN_SPACING.sectionGap,
            paddingVertical: DESIGN_SPACING.cardGap,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: Spacing.sm,
        },
        infoText: {
            flex: 1,
            color: colors.text,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '600',
        },
        centered: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 32,
        },
        emptyCard: {
            alignItems: 'center',
            gap: Spacing.xs,
            paddingHorizontal: DESIGN_SPACING.sectionGap,
            paddingVertical: DESIGN_SPACING.sectionGap,
        },
        emptyTitle: {
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '800',
        },
        emptySubtitle: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
            textAlign: 'center',
        },
        feedCard: {
            paddingHorizontal: DESIGN_SPACING.sectionGap,
            paddingVertical: DESIGN_SPACING.cardGap,
            gap: Spacing.sm,
        },
        feedHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: Spacing.md,
        },
        feedIconWrap: {
            width: 40,
            height: 40,
            borderRadius: Radius.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        feedCopy: {
            flex: 1,
            gap: 4,
        },
        feedTitle: {
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '800',
        },
        feedMessage: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
        },
        feedMeta: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.xs,
        },
        feedCta: {
            color: colors.primary,
            fontSize: Typography.caption.size,
            fontWeight: '800',
        },
    });
