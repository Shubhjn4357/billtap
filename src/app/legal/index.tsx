import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';

const LINKS = [
    {
        title: 'Terms of Service',
        description: 'Usage rules, subscriptions, billing, and legal conditions.',
        route: '/legal/terms',
    },
    {
        title: 'Privacy Policy',
        description: 'How account and business data is collected and used.',
        route: '/legal/privacy',
    },
    {
        title: 'Changelog',
        description: 'Version history and major feature updates.',
        route: '/legal/changelog',
    },
    {
        title: 'About Vahi',
        description: 'App identity, build version, and support details.',
        route: '/legal/about',
    },
] as const;

export default function LegalCenterScreen() {
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const s = styles(colors);
    const version = Constants.expoConfig?.version ?? '0.0.0';

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Legal and Compliance</Text>
                <View style={s.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                {LINKS.map((link) => (
                    <Pressable
                        key={link.title}
                        style={({ pressed }) => [
                            s.card,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => router.push(link.route as Parameters<typeof router.push>[0])}
                        accessibilityRole="button"
                        accessibilityLabel={link.title}
                    >
                        <Text style={[s.cardTitle, { color: colors.text }]}>{link.title}</Text>
                        <Text style={[s.cardDescription, { color: colors.textSecondary }]}>{link.description}</Text>
                    </Pressable>
                ))}
                <View style={[s.metaCard, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}>
                    <Text style={[s.metaLabel, { color: colors.textSecondary }]}>App Version</Text>
                    <Text style={[s.metaValue, { color: colors.text }]}>{version}</Text>
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
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
        back: { fontSize: 14, fontWeight: '600' },
        title: { fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
        headerSpacer: { width: 44 },
        content: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
        card: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
        },
        cardTitle: { fontSize: 14, fontWeight: '700' },
        cardDescription: { fontSize: 12, marginTop: 4, lineHeight: 18 },
        metaCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
        },
        metaLabel: { fontSize: 12, fontWeight: '600' },
        metaValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
    });
