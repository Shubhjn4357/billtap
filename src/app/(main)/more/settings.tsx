import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';
import { SETTINGS_SECTION_ORDER, getSettingsSectionLabel } from '../../../constants/settingsSchema';

export default function SettingsRootScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);

    const { data, isLoading } = useQuery({
        queryKey: ['settings-schema'],
        queryFn: () => settingsApi.getSchema(),
        staleTime: 30 * 60_000,
    });

    const sections = useMemo(() => {
        const apiSections = data?.sections ?? [];
        const schema = data?.schema ?? {};

        const ordered = [
            ...SETTINGS_SECTION_ORDER.filter((entry) => apiSections.includes(entry)),
            ...apiSections.filter((entry) => !SETTINGS_SECTION_ORDER.includes(entry)),
        ];

        return ordered.map((section) => ({
            key: section,
            label: getSettingsSectionLabel(section),
            fieldCount: (schema[section] ?? []).length,
        }));
    }, [data]);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={s.content}>
                    {sections.map((section) => (
                        <Pressable
                            key={section.key}
                            style={({ pressed }) => [
                                s.card,
                                { backgroundColor: colors.card, borderColor: colors.border },
                                pressed && { opacity: 0.8 },
                            ]}
                            onPress={() => router.push(`/(main)/more/settings/${section.key}` as Parameters<typeof router.push>[0])}
                        >
                            <View>
                                <Text style={[s.cardTitle, { color: colors.text }]}>{section.label}</Text>
                                <Text style={[s.cardMeta, { color: colors.textSecondary }]}>{section.fieldCount} fields</Text>
                            </View>
                            <Text style={[s.chevron, { color: colors.textSecondary }]}>{'>'}</Text>
                        </Pressable>
                    ))}
                    <Pressable
                        style={({ pressed }) => [
                            s.card,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => router.push('/legal')}
                    >
                        <View>
                            <Text style={[s.cardTitle, { color: colors.text }]}>Legal and Compliance</Text>
                            <Text style={[s.cardMeta, { color: colors.textSecondary }]}>
                                Terms, privacy policy, changelog, and app information
                            </Text>
                        </View>
                        <Text style={[s.chevron, { color: colors.textSecondary }]}>{'>'}</Text>
                    </Pressable>
                    <View style={{ height: 80 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
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
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    card: {
        borderWidth: 1,
        borderRadius: Radius.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardTitle: { fontSize: 14, fontWeight: '600' },
    cardMeta: { fontSize: 12, marginTop: 2 },
    chevron: { fontSize: 18, fontWeight: '700' },
});



