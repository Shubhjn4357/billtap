import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { router } from 'expo-router';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';

const REPORT_CARDS = [
    { title: 'Profit and Loss', subtitle: 'Income, expense and net result', route: '/(main)/more/reports/pnl' },
    { title: 'GST Summary', subtitle: 'Slab-wise taxable turnover and tax', route: '/(main)/reports/gst-summary' },
    { title: 'Trial Balance', subtitle: 'Debit/Credit balance check', route: '/(main)/reports/trial-balance' },
    { title: 'Ledgers', subtitle: 'Drill down by account', route: '/(main)/reports/ledgers' },
    { title: 'Inventory', subtitle: 'Open inventory and stock reports', route: '/(main)/inventory' },
];

export default function ReportsScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.content}>
                <View style={s.header}>
                    <Text style={s.title}>Reports</Text>
                    <Text style={s.subtitle}>Sales, GST, accounting, and inventory insights.</Text>
                </View>

                {REPORT_CARDS.map((card) => (
                    <Pressable
                        key={card.title}
                        style={({ pressed }) => [
                            s.card,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => router.push(card.route as Parameters<typeof router.push>[0])}
                    >
                        <Text style={s.cardTitle}>{card.title}</Text>
                        <Text style={s.cardSubtitle}>{card.subtitle}</Text>
                        <Text style={[s.cardAction, { color: colors.primary }]}>Open</Text>
                    </Pressable>
                ))}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.sm },
        header: { marginBottom: Spacing.sm },
        title: { fontSize: Typography.headline.size, fontWeight: '700', color: colors.text },
        subtitle: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
        card: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            gap: 4,
        },
        cardTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
        cardSubtitle: { color: colors.textSecondary, fontSize: 12 },
        cardAction: { marginTop: 4, fontSize: 12, fontWeight: '700' },
    });
