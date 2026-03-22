import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    APP_LANGUAGE_OPTIONS,
    APP_PREFERENCE_GROUPS,
    APP_PREFERENCE_TOGGLES,
    INVOICE_TEMPLATE_OPTIONS,
    THEME_MODE_OPTIONS,
} from '../../../constants/appPreferences';
import {
    SETTINGS_SECTION_ICONS,
    SETTINGS_SECTION_TAB_MAP,
    SETTINGS_STATIC_ITEMS,
    SETTINGS_TABS,
    type SettingsIconName,
    type SettingsTabKey,
} from '../../../constants/settingsOptions';
import { DESIGN_SPACING, getInsetPanelStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../../../constants/theme';
import { getSettingsSectionLabel } from '../../../constants/settingsSchema';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { EmptyStateCard } from '../../../components/ui/ListBlocks';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppColors } from '../../../hooks/useAppColors';
import { useI18n } from '../../../hooks/useI18n';
import { type LocalPreferences } from '../../../services/localPreferences';
import { useSettingsSchemaQuery } from '../../../hooks/useSettingsSection';
import { useAppRuntime } from '../../../components/providers/AppRuntimeProvider';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type SettingsSearchResult =
    | { key: string; label: string; fieldCount: number; icon: SettingsIconName; tab: SettingsTabKey; kind: 'section' }
    | { key: string; label: string; fieldCount: number; icon: SettingsIconName; tab: SettingsTabKey; kind: 'route'; route: string };

export default function SettingsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
    const { selection } = useHaptics();
    const { t } = useI18n();
    const {
        biometricSupported,
        localPreferences: prefs,
        localPreferencesReady,
        refreshLocalPreferences,
        updateLocalPreferences,
    } = useAppRuntime();

    const [activeTab, setActiveTab] = useState<SettingsTabKey>('app');
    const [search, setSearch] = useState('');
    const contentScrollRef = useRef<ScrollView | null>(null);

    const { data, isLoading, isRefetching, refetch } = useSettingsSchemaQuery();

    const apiSectionsByTab = useMemo(() => {
        const apiSections = data?.sections ?? [];
        const schema = data?.schema ?? {};
        const excluded = new Set(['INVOICE_PRINT']);
        const result: Record<SettingsTabKey, { key: string; label: string; fieldCount: number; icon: SettingsIconName }[]> = {
            app: [],
            invoicing: [],
            inventory: [],
            business: [],
            notifications: [],
        };

        for (const section of apiSections) {
            if (excluded.has(section)) continue;
            const tab: SettingsTabKey = SETTINGS_SECTION_TAB_MAP[section] ?? 'business';
            result[tab].push({
                key: section,
                label: getSettingsSectionLabel(section),
                fieldCount: (schema[section] ?? []).length,
                icon: SETTINGS_SECTION_ICONS[section] ?? 'tune-variant',
            });
        }
        return result;
    }, [data]);

    const searchResults = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return null;

        const results: SettingsSearchResult[] = [];
        for (const tab of Object.keys(apiSectionsByTab) as SettingsTabKey[]) {
            for (const section of apiSectionsByTab[tab]) {
                if (`${section.label} ${section.key}`.toLowerCase().includes(needle)) {
                    results.push({ ...section, tab, kind: 'section' });
                }
            }
            for (const staticItem of SETTINGS_STATIC_ITEMS[tab]) {
                if (`${staticItem.label} ${staticItem.subtitle}`.toLowerCase().includes(needle)) {
                    results.push({
                        key: staticItem.route,
                        label: staticItem.label,
                        fieldCount: 0,
                        icon: staticItem.icon,
                        tab,
                        kind: 'route',
                        route: staticItem.route,
                    });
                }
            }
        }

        return results;
    }, [apiSectionsByTab, search]);

    const navigateToSection = (key: string) =>
        router.push(`/(main)/more/settings/${key}` as Parameters<typeof router.push>[0]);

    useEffect(() => {
        const handle = setTimeout(() => {
            contentScrollRef.current?.scrollTo({ y: 0, animated: false });
        }, 0);
        return () => clearTimeout(handle);
    }, [activeTab, search]);

    const renderActiveTabContent = () => {
        if (activeTab === 'app') {
            return (
                <ScrollView
                    ref={contentScrollRef}
                    contentContainerStyle={s.tabContent}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={false}
                            onRefresh={() => {
                                void refreshLocalPreferences();
                            }}
                        />
                    )}
                >
                    <AppBlock
                        biometricSupported={biometricSupported}
                        colors={colors}
                        loading={!localPreferencesReady}
                        onUpdate={updateLocalPreferences}
                        prefs={prefs}
                        t={t}
                    />
                </ScrollView>
            );
        }

        const apiRows = apiSectionsByTab[activeTab] ?? [];
        const staticRows = SETTINGS_STATIC_ITEMS[activeTab] ?? [];

        return (
            <ScrollView
                ref={contentScrollRef}
                contentContainerStyle={s.tabContent}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefetching && !isLoading}
                        onRefresh={() => {
                            void refetch();
                        }}
                    />
                )}
            >
                {isLoading ? <ListSkeleton rows={5} /> : (
                    <>
                        {apiRows.map((section) => (
                            <SettingRow
                                key={section.key}
                                colors={colors}
                                icon={section.icon}
                                label={section.label}
                                meta={`${section.fieldCount} ${section.fieldCount === 1 ? 'field' : 'fields'}`}
                                onPress={() => {
                                    void selection();
                                    navigateToSection(section.key);
                                }}
                            />
                        ))}
                        {staticRows.map((item) => (
                            <SettingRow
                                key={item.route}
                                colors={colors}
                                icon={item.icon}
                                label={item.label}
                                meta={item.subtitle}
                                onPress={() => {
                                    void selection();
                                    router.push(item.route as Parameters<typeof router.push>[0]);
                                }}
                            />
                        ))}
                        {apiRows.length === 0 && staticRows.length === 0 ? (
                            <EmptyStateCard
                                icon="tune-variant"
                                title={t('settings.no_settings')}
                                subtitle={t('settings.no_settings_subtitle')}
                                tone="info"
                            />
                        ) : null}
                    </>
                )}
            </ScrollView>
        );
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={t('settings.title')}
                subtitle={t('settings.subtitle')}
                onBackPress={smartBack}
            />

            <View style={s.heroWrap}>
                <UtilityHero
                    title={t('settings.hub_title')}
                    subtitle={t('settings.hub_subtitle')}
                    icon="cog-outline"
                    tone="info"
                />
            </View>

            <View style={s.searchWrap}>
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t('settings.search_placeholder')}
                />
            </View>

            {searchResults ? (
                <ScrollView ref={contentScrollRef} contentContainerStyle={s.tabContent}>
                    {searchResults.length === 0 ? (
                        <EmptyStateCard
                            icon="file-search-outline"
                            title={t('settings.no_results')}
                            subtitle={t('settings.no_results_subtitle')}
                            tone="info"
                        />
                    ) : searchResults.map((result) => (
                        <SettingRow
                            key={`${result.kind}-${result.tab}-${result.key}`}
                            colors={colors}
                            icon={result.icon}
                            label={result.label}
                            meta={SETTINGS_TABS.find((tab) => tab.key === result.tab)?.label ?? result.tab}
                            onPress={() => {
                                void selection();
                                if (result.kind === 'route') {
                                    router.push(result.route as Parameters<typeof router.push>[0]);
                                    return;
                                }
                                navigateToSection(result.key);
                            }}
                        />
                    ))}
                </ScrollView>
            ) : (
                <>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={s.tabBarScroll}
                        contentContainerStyle={s.tabBar}
                    >
                        {SETTINGS_TABS.map((tab) => {
                            const selected = activeTab === tab.key;
                            return (
                                <ChipButton
                                    key={tab.key}
                                    icon={tab.icon}
                                    label={tab.label}
                                    onPress={() => {
                                        void selection();
                                        setActiveTab(tab.key);
                                    }}
                                    selected={selected}
                                    tone="info"
                                />
                            );
                        })}
                    </ScrollView>

                    <View style={s.tabUnderline}>
                        {SETTINGS_TABS.map((tab) => (
                            <View
                                key={tab.key}
                                style={[
                                    s.tabDot,
                                    { backgroundColor: activeTab === tab.key ? colors.primary : 'transparent' },
                                ]}
                            />
                        ))}
                    </View>

                    {renderActiveTabContent()}
                </>
            )}
        </SafeAreaView>
    );
}

function AppBlock({
    biometricSupported,
    colors,
    loading,
    onUpdate,
    prefs,
    t,
}: {
    biometricSupported: boolean;
    colors: ColorPalette;
    loading: boolean;
    onUpdate: (patch: Partial<LocalPreferences>) => void | Promise<unknown>;
    prefs: LocalPreferences;
    t: TranslateFn;
}) {
    const s = blockStyles(colors);

    if (loading) return <ListSkeleton rows={4} />;

    const groupedToggles = APP_PREFERENCE_TOGGLES.reduce<Record<string, (typeof APP_PREFERENCE_TOGGLES)[number][]>>((result, item) => {
        const current = result[item.group] ?? [];
        result[item.group] = [...current, item];
        return result;
    }, {});

    return (
        <>
            {APP_PREFERENCE_GROUPS.map((group) => {
                if (group.key === 'appearance') {
                    return (
                        <View key={group.key} style={s.groupCard}>
                            <Text style={s.groupTitle}>{t(group.titleKey)}</Text>
                            <View style={s.preferenceBlock}>
                                <Text style={s.preferenceLabel}>{t('settings.theme_mode')}</Text>
                                <View style={s.chipRow}>
                                    {THEME_MODE_OPTIONS.map((option) => (
                                        <ChipButton
                                            key={option.key}
                                            icon={option.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                                            label={t(`theme.${option.key}`)}
                                            onPress={() => {
                                                void onUpdate({ themeMode: option.key });
                                            }}
                                            selected={prefs.themeMode === option.key}
                                            tone="info"
                                        />
                                    ))}
                                </View>
                            </View>

                            <View style={s.preferenceBlock}>
                                <Text style={s.preferenceLabel}>{t('settings.language')}</Text>
                                <Text style={s.preferenceSub}>{t('settings.language_sub')}</Text>
                                <View style={s.chipRow}>
                                    {APP_LANGUAGE_OPTIONS.map((option) => (
                                        <ChipButton
                                            key={option.key}
                                            label={t(`language.${option.key}`)}
                                            onPress={() => {
                                                void onUpdate({ appLanguage: option.key });
                                            }}
                                            selected={prefs.appLanguage === option.key}
                                            tone="info"
                                        />
                                    ))}
                                </View>
                            </View>
                        </View>
                    );
                }

                if (group.key === 'documents') {
                    return (
                        <View key={group.key} style={s.groupCard}>
                            <Text style={s.groupTitle}>{t(group.titleKey)}</Text>
                            <View style={s.preferenceBlock}>
                                <Text style={s.preferenceLabel}>{t('settings.invoice_template')}</Text>
                                <Text style={s.preferenceSub}>{t('settings.invoice_template_sub')}</Text>
                                <View style={s.templateStack}>
                                    {INVOICE_TEMPLATE_OPTIONS.map((option) => {
                                        const selected = prefs.invoiceTemplateMode === option.key;
                                        return (
                                            <Pressable
                                                key={option.key}
                                                style={({ pressed }) => [
                                                    s.templateCard,
                                                    getInsetPanelStyle(colors, selected ? colors.primary : undefined),
                                                    {
                                                        opacity: pressed ? 0.9 : 1,
                                                        borderColor: selected ? withAlpha(colors.primary, '42') : withAlpha(colors.border, 'B8'),
                                                        backgroundColor: selected ? withAlpha(colors.primary, '0C') : colors.surface,
                                                    },
                                                ]}
                                                onPress={() => {
                                                    void onUpdate({ invoiceTemplateMode: option.key });
                                                }}
                                            >
                                                <View style={s.templateHeader}>
                                                    <Text style={[s.templateTitle, { color: selected ? colors.primary : colors.text }]}>
                                                        {t(`invoice_template.${option.key.toLowerCase()}`)}
                                                    </Text>
                                                    {selected ? (
                                                        <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} />
                                                    ) : null}
                                                </View>
                                                <Text style={s.templateDescription}>{option.description}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>
                    );
                }

                const toggles = groupedToggles[group.key] ?? [];
                if (toggles.length === 0) return null;

                return (
                    <View key={group.key} style={s.groupCard}>
                        <Text style={s.groupTitle}>{t(group.titleKey)}</Text>
                        {toggles.map((toggle, index) => {
                            const disabled = toggle.key === 'biometricLockEnabled' && !biometricSupported;
                            return (
                                <View
                                    key={toggle.key}
                                    style={[
                                        s.toggleRow,
                                        index > 0 ? s.toggleRowBorder : null,
                                        { borderColor: withAlpha(colors.border, '80') },
                                    ]}
                                >
                                    <View style={s.toggleTextBlock}>
                                        <Text style={s.toggleLabel}>{t(toggle.titleKey)}</Text>
                                        <Text style={s.toggleSub}>
                                            {disabled ? t('lock.unavailable') : t(toggle.descriptionKey)}
                                        </Text>
                                    </View>
                                    <Switch
                                        disabled={disabled}
                                        value={Boolean(prefs[toggle.key])}
                                        onValueChange={(value) => {
                                            void onUpdate({ [toggle.key]: value } as Partial<LocalPreferences>);
                                        }}
                                        trackColor={{ true: colors.primary, false: colors.border }}
                                        thumbColor={colors.onPrimary}
                                    />
                                </View>
                            );
                        })}
                    </View>
                );
            })}

            <View style={s.infoCard}>
                <MaterialCommunityIcons name="information-outline" size={16} color={colors.info} />
                <Text style={s.infoText}>{t('settings.local_note')}</Text>
            </View>
        </>
    );
}

function SettingRow({
    colors,
    icon,
    label,
    meta,
    onPress,
}: {
    colors: ColorPalette;
    icon: SettingsIconName;
    label: string;
    meta: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            style={({ pressed }) => [
                rowStyles.row,
                getSurfaceStyle(colors, { elevated: true }),
                { opacity: pressed ? 0.84 : 1 },
            ]}
            onPress={onPress}
        >
            <View style={[rowStyles.iconWrap, { backgroundColor: withAlpha(colors.primary, '12') }]}>
                <MaterialCommunityIcons name={icon} size={16} color={colors.primary} />
            </View>
            <View style={rowStyles.info}>
                <Text style={[rowStyles.label, { color: colors.text }]}>{label}</Text>
                <Text style={[rowStyles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {meta}
                </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
        </Pressable>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    heroWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
    searchWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
    tabBarScroll: {
        flexGrow: 0,
        minHeight: 48,
        marginBottom: Spacing.sm,
    },
    tabBar: {
        paddingHorizontal: DESIGN_SPACING.screenX,
        gap: DESIGN_SPACING.cardGap,
        paddingVertical: 2,
        alignItems: 'center',
    },
    tabUnderline: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginBottom: DESIGN_SPACING.cardGap,
    },
    tabDot: { width: 6, height: 6, borderRadius: 3 },
    tabContent: {
        paddingHorizontal: DESIGN_SPACING.screenX,
        gap: DESIGN_SPACING.cardGap,
        paddingBottom: 120,
    },
});

const blockStyles = (colors: ColorPalette) => StyleSheet.create({
    groupCard: {
        padding: DESIGN_SPACING.sectionGap,
        gap: DESIGN_SPACING.cardGap,
        ...getSurfaceStyle(colors, { elevated: true }),
    },
    groupTitle: {
        fontSize: Typography.caption.size,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: colors.primary,
    },
    preferenceBlock: {
        gap: 6,
    },
    preferenceLabel: {
        fontSize: Typography.body.size,
        fontWeight: '700',
        color: colors.text,
    },
    preferenceSub: {
        fontSize: Typography.caption.size,
        lineHeight: Typography.caption.lineHeight,
        color: colors.textSecondary,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DESIGN_SPACING.cardGap,
    },
    templateStack: {
        gap: DESIGN_SPACING.cardGap,
        marginTop: 2,
    },
    templateCard: {
        padding: DESIGN_SPACING.sectionGap,
        gap: 6,
        borderRadius: Radius.card,
        borderWidth: 1,
    },
    templateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DESIGN_SPACING.cardGap,
    },
    templateTitle: {
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    templateDescription: {
        fontSize: Typography.caption.size,
        lineHeight: Typography.caption.lineHeight,
        color: colors.textSecondary,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_SPACING.cardGap,
        paddingVertical: DESIGN_SPACING.cardGap,
    },
    toggleRowBorder: {
        borderTopWidth: 1,
        paddingTop: DESIGN_SPACING.sectionGap,
    },
    toggleTextBlock: {
        flex: 1,
        gap: 2,
    },
    toggleLabel: {
        fontSize: Typography.body.size,
        fontWeight: '700',
        color: colors.text,
    },
    toggleSub: {
        fontSize: Typography.caption.size,
        lineHeight: Typography.caption.lineHeight,
        color: colors.textSecondary,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_SPACING.cardGap,
        paddingHorizontal: DESIGN_SPACING.sectionGap,
        paddingVertical: DESIGN_SPACING.cardGap,
        borderRadius: Radius.card,
        borderWidth: 1,
        borderColor: withAlpha(colors.info, '30'),
        backgroundColor: withAlpha(colors.info, '12'),
    },
    infoText: {
        flex: 1,
        fontSize: Typography.caption.size,
        lineHeight: Typography.caption.lineHeight,
        color: colors.textSecondary,
        fontWeight: '600',
    },
});

const rowStyles = StyleSheet.create({
    row: {
        paddingHorizontal: DESIGN_SPACING.sectionGap,
        paddingVertical: DESIGN_SPACING.sectionGap,
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_SPACING.cardGap,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: { flex: 1 },
    label: {
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    meta: {
        fontSize: Typography.caption.size,
        marginTop: 2,
    },
});
