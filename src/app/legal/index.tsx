import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../hooks/useSmartBack';
import Constants from 'expo-constants';
import { LEGAL_CENTER_LINKS } from '../../constants/appShellOptions';
import { DESIGN_SPACING, getPillStyle } from '../../constants/designSystem';
import { Radius, Spacing, type ColorPalette, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { AppTopBar } from '../../components/ui/AppTopBar';
import { UtilityHero, UtilityPanel, UtilityRow, UtilitySection } from '../../components/ui/UtilityBlocks';

export default function LegalCenterScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/legal');
    const version = Constants.expoConfig?.version ?? '0.0.0';

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Legal and Compliance"
                subtitle="Policies, terms and app history"
                onBackPress={smartBack}
            />

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <UtilityHero
                    title="Legal and Compliance"
                    subtitle="Policies, version history, and public app disclosures in one place."
                    icon="scale-balance"
                    tone="info"
                    right={(
                        <View style={[s.versionBadge, { backgroundColor: withAlpha(colors.primary, '18'), borderColor: withAlpha(colors.primary, '36') }]}>
                            <Text style={[s.versionBadgeText, { color: colors.primary }]}>v{version}</Text>
                        </View>
                    )}
                />
                <UtilitySection title="Documents">
                    <UtilityPanel>
                        {LEGAL_CENTER_LINKS.map((link, index) => (
                            <View key={link.title} style={index < LEGAL_CENTER_LINKS.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}>
                                <UtilityRow
                                    label={link.title}
                                    description={link.description}
                                    icon="file-document-outline"
                                    onPress={() => router.push(link.route as Parameters<typeof router.push>[0])}
                                />
                            </View>
                        ))}
                    </UtilityPanel>
                </UtilitySection>
                <UtilitySection title="Build Info">
                    <UtilityPanel tone="info">
                        <UtilityRow
                            label="App Version"
                            description="Installed Expo app version reported by the bundle."
                            icon="tag-outline"
                            right={<Text style={[s.metaValue, { color: colors.text }]}>{version}</Text>}
                        />
                    </UtilityPanel>
                </UtilitySection>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: DESIGN_SPACING.screenX, gap: DESIGN_SPACING.cardGap },
        versionBadge: {
            ...getPillStyle(colors, colors.primary),
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        versionBadgeText: {
            fontSize: 11,
            fontWeight: '800',
        },
        metaValue: { fontSize: 14, fontWeight: '700' },
    });
