import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { REPORT_CARDS, type ReportCard } from '../../../constants/reportOptions';
import { DESIGN_SPACING, getIconAccentStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useHaptics } from '../../../hooks/useHaptics';

export default function ReportsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const [search, setSearch] = useState('');
    const { selection } = useHaptics();

    const filteredCards = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return REPORT_CARDS;
        return REPORT_CARDS.filter((entry) => `${entry.title} ${entry.subtitle}`.toLowerCase().includes(needle));
    }, [search]);

    const filteredCount = filteredCards.length;
    const categoryCount = useMemo(() => new Set(filteredCards.map((entry) => entry.category)).size, [filteredCards]);

    const toneColor = (tone: ReportCard['tone']) => {
        if (tone === 'success') return colors.success;
        if (tone === 'warning') return colors.warning;
        if (tone === 'info') return colors.info;
        return colors.primary;
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.content}>
                <AppTopBar
                    title="Reports"
                    subtitle="Sales, GST, accounting, and inventory insights"
                    rightAction={(
                        <Pressable onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}>
                            <MaterialCommunityIcons name="compass-outline" size={20} color={colors.primary} />
                        </Pressable>
                    )}
                />
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search reports..."
                />

                <UtilityHero
                    title="Reports Hub"
                    subtitle="Sales, GST, accounting, and inventory insight routes in one place."
                    icon="chart-box-outline"
                    tone="info"
                />

                <View style={s.metricRow}>
                    <HubMetricCard
                        label="Available Reports"
                        value={String(filteredCount)}
                        meta={search.trim().length > 0 ? 'Filtered by search' : 'Across GST, accounts, and inventory'}
                        tone="info"
                    />
                    <HubMetricCard
                        label="Categories"
                        value={String(categoryCount)}
                        meta="Financial, tax, stock, utility"
                        tone="success"
                    />
                </View>

                {filteredCards.map((card) => {
                    const accent = toneColor(card.tone);
                    return (
                        <Pressable
                            key={card.title}
                            style={({ pressed }) => [
                                s.card,
                                getSurfaceStyle(colors, { elevated: true }),
                                pressed && { opacity: 0.85 },
                            ]}
                            onPress={() => {
                                void selection();
                                router.push(card.route as Parameters<typeof router.push>[0]);
                            }}
                        >
                            <View style={[s.iconWrap, getIconAccentStyle(colors, accent, { mediumGlow: true })]}>
                                <MaterialCommunityIcons name={card.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={18} color={accent} />
                            </View>
                            <View style={s.cardBody}>
                                <View style={s.cardTitleRow}>
                                    <Text style={s.cardTitle}>{card.title}</Text>
                                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                                </View>
                                <Text style={s.cardSubtitle}>{card.subtitle}</Text>
                                <View style={s.badgeRow}>
                                    <Text style={[s.badge, { color: accent, backgroundColor: withAlpha(accent, '14') }]}>
                                        {card.category}
                                    </Text>
                                </View>
                            </View>
                        </Pressable>
                    );
                })}

                {filteredCards.length === 0 ? (
                    <View style={[s.emptyState, getSurfaceStyle(colors, { elevated: true })]}>
                        <MaterialCommunityIcons name="file-search-outline" size={22} color={colors.textSecondary} />
                        <Text style={[s.emptyTitle, { color: colors.text }]}>No reports found</Text>
                        <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>Try a different search term.</Text>
                    </View>
                ) : null}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: DESIGN_SPACING.screenX, paddingTop: Spacing.md, gap: DESIGN_SPACING.cardGap },
        metricRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.sm,
        },
        card: {
            flexDirection: 'row',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            alignItems: 'flex-start',
        },
        iconWrap: {
            width: 36,
            height: 36,
            borderRadius: Radius.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardBody: {
            flex: 1,
            gap: 2,
        },
        cardTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Spacing.sm,
        },
        cardTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
        cardSubtitle: { color: colors.textSecondary, fontSize: 12 },
        badgeRow: { flexDirection: 'row', marginTop: 4 },
        badge: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 3,
            fontSize: Typography.caption.size,
            fontWeight: '700',
            overflow: 'hidden',
        },
        emptyState: {
            paddingVertical: Spacing.lg,
            alignItems: 'center',
            gap: 2,
        },
        emptyTitle: { fontSize: Typography.body.size, fontWeight: '700' },
        emptySubtitle: { fontSize: Typography.caption.size },
    });

