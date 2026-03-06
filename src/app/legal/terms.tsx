import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSmartBack } from '../../hooks/useSmartBack';
import { Radius, Spacing, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { TERMS_LAST_UPDATED, TERMS_SECTIONS } from '../../constants/legal';
import { AppTopBar } from '../../components/ui/AppTopBar';

export default function TermsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/legal');

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Terms of Service"
                subtitle="Usage and subscription conditions"
                onBackPress={smartBack}
            />

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <Text style={[s.lastUpdated, { color: colors.textSecondary }]}>
                    Last updated: {TERMS_LAST_UPDATED}
                </Text>
                {TERMS_SECTIONS.map((section) => (
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
