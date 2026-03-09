import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSmartBack } from '../../hooks/useSmartBack';
import { DESIGN_SPACING, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { CHANGELOG_ENTRIES } from '../../constants/legal';
import { AppTopBar } from '../../components/ui/AppTopBar';
import { UtilityHero } from '../../components/ui/UtilityBlocks';

export default function ChangelogScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/legal');

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Changelog"
                subtitle="Version history and highlights"
                onBackPress={smartBack}
            />

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <UtilityHero
                    title="Changelog"
                    subtitle="Version history, release notes, and major improvements across billing, sync, and reporting."
                    icon="history"
                    tone="info"
                />
                {CHANGELOG_ENTRIES.map((entry) => (
                    <View key={`${entry.version}-${entry.date}`} style={[s.sectionCard, getSurfaceStyle(colors, { elevated: true })]}>
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
        content: { paddingHorizontal: DESIGN_SPACING.screenX, gap: DESIGN_SPACING.cardGap },
        sectionCard: {
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
