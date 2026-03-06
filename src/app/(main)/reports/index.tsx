import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { useHaptics } from '../../../hooks/useHaptics';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type ReportCard = {
    title: string;
    subtitle: string;
    route: string;
    icon: IconName;
    category: string;
    tone: 'primary' | 'success' | 'warning' | 'info';
};

const REPORT_CARDS = [
    {
        title: 'Profit and Loss',
        subtitle: 'Income, expense and net result',
        route: '/(main)/more/reports/pnl',
        icon: 'chart-areaspline',
        category: 'Financial',
        tone: 'success',
    },
    {
        title: 'GST Summary',
        subtitle: 'Slab-wise taxable turnover and tax',
        route: '/(main)/reports/gst-summary',
        icon: 'bank-outline',
        category: 'Tax',
        tone: 'primary',
    },
    {
        title: 'Trial Balance',
        subtitle: 'Debit and credit integrity check',
        route: '/(main)/reports/trial-balance',
        icon: 'scale-balance',
        category: 'Accounting',
        tone: 'warning',
    },
    {
        title: 'Ledgers',
        subtitle: 'Drill down voucher-level transactions',
        route: '/(main)/reports/ledgers',
        icon: 'book-open-page-variant-outline',
        category: 'Accounting',
        tone: 'info',
    },
    {
        title: 'Inventory',
        subtitle: 'Stock valuation and movement reports',
        route: '/(main)/inventory',
        icon: 'archive-outline',
        category: 'Stock',
        tone: 'primary',
    },
    {
        title: 'Screen Directory',
        subtitle: 'Open all screens and flows',
        route: '/(main)/more/screen-directory',
        icon: 'compass-outline',
        category: 'Utility',
        tone: 'info',
    },
] as const satisfies readonly ReportCard[];

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

                <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>AVAILABLE REPORTS</Text>
                    <Text style={s.summaryValue}>{filteredCount}</Text>
                    <Text style={[s.summaryMeta, { color: colors.textSecondary }]}>
                        {search.trim().length > 0 ? 'Filtered by search' : 'Across GST, accounts and inventory'}
                    </Text>
                </View>

                {filteredCards.map((card) => {
                    const accent = toneColor(card.tone);
                    return (
                        <Pressable
                            key={card.title}
                            style={({ pressed }) => [
                                s.card,
                                { backgroundColor: colors.card, borderColor: colors.border },
                                pressed && { opacity: 0.85 },
                            ]}
                            onPress={() => {
                                void selection();
                                router.push(card.route as Parameters<typeof router.push>[0]);
                            }}
                        >
                            <View style={[s.iconWrap, { backgroundColor: withAlpha(accent, '18') }]}>
                                <MaterialCommunityIcons name={card.icon} size={18} color={accent} />
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
                    <View style={[s.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
        content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.sm },
        summaryCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.xs,
        },
        summaryLabel: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
        summaryValue: { marginTop: 4, color: colors.text, fontSize: 22, fontWeight: '800' },
        summaryMeta: { marginTop: 2, fontSize: Typography.caption.size },
        card: {
            flexDirection: 'row',
            gap: Spacing.sm,
            borderWidth: 1,
            borderRadius: Radius.card,
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
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingVertical: Spacing.lg,
            alignItems: 'center',
            gap: 2,
        },
        emptyTitle: { fontSize: Typography.body.size, fontWeight: '700' },
        emptySubtitle: { fontSize: Typography.caption.size },
    });

