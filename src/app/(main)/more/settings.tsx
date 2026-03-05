import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { SETTINGS_SECTION_ORDER, getSettingsSectionLabel } from '../../../constants/settingsSchema';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useHaptics } from '../../../hooks/useHaptics';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const iconForSection = (section: string): IconName => {
    switch (section) {
        case 'GENERAL': return 'cog-outline';
        case 'SECURITY': return 'shield-lock-outline';
        case 'TAXES_AND_GST': return 'file-percent-outline';
        case 'INVOICE_PRINT': return 'printer-outline';
        case 'BACKUP_SETTINGS': return 'cloud-upload-outline';
        case 'PARTY_SETTINGS': return 'account-group-outline';
        case 'ITEM_SETTINGS': return 'cube-outline';
        case 'MULTI_FIRM': return 'office-building-outline';
        default: return 'tune-variant';
    }
};

export default function SettingsRootScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
    const { selection } = useHaptics();
    const [search, setSearch] = useState('');

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['settings-schema'],
        queryFn: () => settingsApi.getSchema(),
        staleTime: 30 * 60_000,
    });

    const allSections = useMemo(() => {
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
    const sections = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return allSections;
        return allSections.filter((section) => `${section.label} ${section.key}`.toLowerCase().includes(needle));
    }, [allSections, search]);
    const totalFields = useMemo(() => allSections.reduce((sum, section) => sum + section.fieldCount, 0), [allSections]);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Settings"
                subtitle="Controls and preferences"
                onBackPress={smartBack}
            />

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={s.content}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                refetch();
                            }}
                        />
                    )}
                >
                    <AppSearchBar
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search settings sections..."
                    />

                    <Pressable
                        style={({ pressed }) => [
                            s.card,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => {
                            void selection();
                            router.push('/(main)/more/app-preferences');
                        }}
                    >
                        <View style={s.cardLeft}>
                            <View style={[s.iconWrap, { backgroundColor: withAlpha(colors.primary, '16') }]}>
                                <MaterialCommunityIcons name="tune-variant" size={18} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={[s.cardTitle, { color: colors.text }]}>App Preferences</Text>
                                <Text style={[s.cardMeta, { color: colors.textSecondary }]}>Theme and device-local behavior</Text>
                            </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                    </Pressable>

                    <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>SETTINGS OVERVIEW</Text>
                        <Text style={s.summaryValue}>{sections.length}</Text>
                        <Text style={[s.summaryMeta, { color: colors.textSecondary }]}>
                            {search.trim().length > 0 ? `Filtered from ${allSections.length} sections` : `${totalFields} total configurable fields`}
                        </Text>
                    </View>

                    {sections.map((section) => (
                        <Pressable
                            key={section.key}
                            style={({ pressed }) => [
                                s.card,
                                { backgroundColor: colors.card, borderColor: colors.border },
                                pressed && { opacity: 0.8 },
                            ]}
                            onPress={() => {
                                void selection();
                                router.push(`/(main)/more/settings/${section.key}` as Parameters<typeof router.push>[0]);
                            }}
                        >
                            <View style={s.cardLeft}>
                                <View style={[s.iconWrap, { backgroundColor: withAlpha(colors.primary, '16') }]}>
                                    <MaterialCommunityIcons name={iconForSection(section.key)} size={18} color={colors.primary} />
                                </View>
                                <View>
                                    <Text style={[s.cardTitle, { color: colors.text }]}>{section.label}</Text>
                                    <Text style={[s.cardMeta, { color: colors.textSecondary }]}>{section.fieldCount} fields</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                    ))}
                    <Pressable
                            style={({ pressed }) => [
                                s.card,
                                { backgroundColor: colors.card, borderColor: colors.border },
                                pressed && { opacity: 0.8 },
                            ]}
                            onPress={() => {
                                void selection();
                                router.push('/legal');
                            }}
                        >
                            <View style={s.cardLeft}>
                                <View style={[s.iconWrap, { backgroundColor: withAlpha(colors.primary, '16') }]}>
                                    <MaterialCommunityIcons name="file-document-outline" size={18} color={colors.primary} />
                                </View>
                                <View>
                                    <Text style={[s.cardTitle, { color: colors.text }]}>Legal and Compliance</Text>
                                <Text style={[s.cardMeta, { color: colors.textSecondary }]}>
                                    Terms, privacy policy, changelog, and app information
                                </Text>
                            </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                    {sections.length === 0 ? (
                        <View style={[s.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="file-search-outline" size={22} color={colors.textSecondary} />
                            <Text style={[s.emptyTitle, { color: colors.text }]}>No settings section found</Text>
                            <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>Try a different search term.</Text>
                        </View>
                    ) : null}
                    <View style={{ height: 80 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    summaryCard: {
        borderWidth: 1,
        borderRadius: Radius.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    summaryLabel: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
    summaryValue: { marginTop: 4, color: colors.text, fontSize: Typography.headline.size, fontWeight: '800' },
    summaryMeta: { marginTop: 2, fontSize: Typography.caption.size },
    card: {
        borderWidth: 1,
        borderRadius: Radius.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    iconWrap: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: { fontSize: 14, fontWeight: '600' },
    cardMeta: { fontSize: 12, marginTop: 2 },
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



