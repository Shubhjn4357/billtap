import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { CHANGELOG_ENTRIES } from '../../constants/legal';

export default function ChangelogScreen() {
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const s = styles(colors);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Changelog</Text>
                <View style={s.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                {CHANGELOG_ENTRIES.map((entry) => (
                    <View key={`${entry.version}-${entry.date}`} style={[s.sectionCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                        <View style={s.versionRow}>
                            <Text style={[s.version, { color: colors.text }]}>v{entry.version}</Text>
                            <Text style={[s.date, { color: colors.textSecondary }]}>{entry.date}</Text>
                        </View>
                        {entry.highlights.map((highlight) => (
                            <View key={`${entry.version}-${highlight}`} style={s.pointRow}>
                                <Text style={[s.bullet, { color: colors.textSecondary }]}>-</Text>
                                <Text style={[s.pointText, { color: colors.textSecondary }]}>{highlight}</Text>
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
        sectionCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            gap: Spacing.xs,
        },
        versionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 2,
        },
        version: { fontSize: 15, fontWeight: '700' },
        date: { fontSize: 12, fontWeight: '600' },
        pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
        bullet: { fontSize: 13, lineHeight: 20 },
        pointText: { flex: 1, fontSize: 13, lineHeight: 20 },
    });
