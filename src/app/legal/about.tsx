import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../hooks/useSmartBack';
import Constants from 'expo-constants';
import { getColors, Radius, Spacing, type ColorPalette } from '../../constants/theme';
import { AppTopBar } from '../../components/ui/AppTopBar';

export default function AboutScreen() {
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const s = styles(colors);
    const smartBack = useSmartBack('/legal');
    const version = Constants.expoConfig?.version ?? '0.0.0';
    const packageName = Constants.expoConfig?.android?.package ?? 'com.blockbucket.vahi';

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="About Vahi"
                subtitle="Build and support details"
                onBackPress={smartBack}
            />

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Text style={[s.appName, { color: colors.text }]}>Vahi</Text>
                    <Text style={[s.appTagline, { color: colors.textSecondary }]}>
                        GST billing, inventory, POS, and accounting for Indian businesses.
                    </Text>
                </View>

                <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <View style={s.metaRow}>
                        <Text style={[s.metaLabel, { color: colors.textSecondary }]}>Version</Text>
                        <Text style={[s.metaValue, { color: colors.text }]}>{version}</Text>
                    </View>
                    <View style={s.metaRow}>
                        <Text style={[s.metaLabel, { color: colors.textSecondary }]}>Android Package</Text>
                        <Text style={[s.metaValue, { color: colors.text }]}>{packageName}</Text>
                    </View>
                    <View style={s.metaRow}>
                        <Text style={[s.metaLabel, { color: colors.textSecondary }]}>Support</Text>
                        <Text style={[s.metaValue, { color: colors.text }]}>support@vahi.app</Text>
                    </View>
                </View>

                <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Text style={[s.linkHeader, { color: colors.text }]}>Quick Links</Text>
                    <Pressable onPress={() => router.push('/legal/terms')} style={s.linkItem}>
                        <Text style={[s.linkText, { color: colors.primary }]}>Terms of Service</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push('/legal/privacy')} style={s.linkItem}>
                        <Text style={[s.linkText, { color: colors.primary }]}>Privacy Policy</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push('/legal/changelog')} style={s.linkItem}>
                        <Text style={[s.linkText, { color: colors.primary }]}>Changelog</Text>
                    </Pressable>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
        card: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            gap: Spacing.xs,
        },
        appName: { fontSize: 20, fontWeight: '800' },
        appTagline: { fontSize: 13, lineHeight: 20 },
        metaRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: Spacing.sm,
            paddingVertical: 4,
        },
        metaLabel: { fontSize: 12, fontWeight: '600' },
        metaValue: { fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },
        linkHeader: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
        linkItem: { paddingVertical: 4 },
        linkText: { fontSize: 14, fontWeight: '600' },
    });
