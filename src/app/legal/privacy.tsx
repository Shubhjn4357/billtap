import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { PRIVACY_LAST_UPDATED, PRIVACY_SECTIONS } from '../../constants/legal';

export default function PrivacyScreen() {
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const s = styles(colors);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Privacy Policy</Text>
                <View style={s.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <Text style={[s.lastUpdated, { color: colors.textSecondary }]}>
                    Last updated: {PRIVACY_LAST_UPDATED}
                </Text>
                {PRIVACY_SECTIONS.map((section) => (
                    <View key={section.title} style={[s.sectionCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                        <Text style={[s.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                        {section.points.map((point) => (
                            <View key={`${section.title}-${point}`} style={s.pointRow}>
                                <Text style={[s.bullet, { color: colors.textSecondary }]}>-</Text>
                                <Text style={[s.pointText, { color: colors.textSecondary }]}>{point}</Text>
                            </View>
                        ))}
                    </View>
                ))}
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
        lastUpdated: { fontSize: 12, marginBottom: Spacing.xs },
        sectionCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            gap: Spacing.xs,
        },
        sectionTitle: { fontSize: 14, fontWeight: '700' },
        pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
        bullet: { fontSize: 13, lineHeight: 20 },
        pointText: { flex: 1, fontSize: 13, lineHeight: 20 },
    });
