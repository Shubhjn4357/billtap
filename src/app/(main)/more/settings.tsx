/**
 * Settings — unified, tabbed settings hub.
 *
 * Five tabs group every setting in one place, eliminating the old
 * "App Preferences" separate screen and the INVOICE_PRINT duplication.
 *
 * Tab 1 — App          : Theme, haptics, rich motion, offline mode, currency
 * Tab 2 — Invoicing    : Invoice format, taxes & GST, payment reminders,
 *                        transaction SMS, transaction header, item table,
 *                        more transaction features
 * Tab 3 — Inventory    : Item settings, party settings, godown & stock,
 *                        item masters link
 * Tab 4 — Business     : General, multi-firm, backup, security, printing link
 * Tab 5 — Notifications: Any SMS/reminder sections + digital signature
 *
 * Rules enforced:
 *  - INVOICE_PRINT is hidden from the API section list (handled by Printing page)
 *  - App Preferences page (theme/haptics) is inlined into Tab 1 — no redirect
 *  - Every API section is assigned to exactly one tab — no duplication
 */

import { useEffect, useMemo, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../../../api/endpoints';
import { Radius, Spacing, type ColorPalette, type ThemePreference, withAlpha } from '../../../constants/theme';
import { getSettingsSectionLabel } from '../../../constants/settingsSchema';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ListSkeleton } from '../../../components/ui/ListSkeleton';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppColors } from '../../../hooks/useAppColors';
import { useThemeStore } from '../../../store/themeStore';
import {
    DEFAULT_LOCAL_PREFERENCES,
    getLocalPreferences,
    patchLocalPreferences,
    type LocalPreferences,
} from '../../../services/localPreferences';


type TabKey = 'app' | 'invoicing' | 'inventory' | 'business' | 'notifications';
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS: { key: TabKey; label: string; icon: IconName }[] = [
    { key: 'app', label: 'App', icon: 'tune-variant' },
    { key: 'invoicing', label: 'Invoicing', icon: 'file-document-outline' },
    { key: 'inventory', label: 'Inventory', icon: 'cube-outline' },
    { key: 'business', label: 'Business', icon: 'office-building-outline' },
    { key: 'notifications', label: 'Alerts', icon: 'bell-outline' },
];

// ── Which API sections go in which tab ────────────────────────────────────────
const SECTION_TAB_MAP: Record<string, TabKey> = {
    TAXES_AND_GST: 'invoicing',
    TRANSACTION_SMS: 'notifications',
    TRANSACTION_HEADER: 'invoicing',
    ITEM_TABLE: 'invoicing',
    TAX_DISCOUNT_TOTAL: 'invoicing',
    MORE_TRANSACTION_FEATURES: 'invoicing',
    PAYMENT_REMINDERS: 'notifications',
    ITEM_SETTINGS: 'inventory',
    PARTY_SETTINGS: 'inventory',
    GODOWN_AND_STOCK_TRANSFER: 'inventory',
    GENERAL: 'business',
    MULTI_FIRM: 'business',
    BACKUP_SETTINGS: 'business',
    SECURITY: 'business',
// INVOICE_PRINT excluded — redirected to Printing page
};

const SECTION_ICON: Record<string, IconName> = {
    GENERAL: 'cog-outline',
    SECURITY: 'shield-lock-outline',
    TAXES_AND_GST: 'file-percent-outline',
    BACKUP_SETTINGS: 'cloud-upload-outline',
    PARTY_SETTINGS: 'account-group-outline',
    ITEM_SETTINGS: 'cube-outline',
    MULTI_FIRM: 'office-building-outline',
    PAYMENT_REMINDERS: 'bell-ring-outline',
    TRANSACTION_SMS: 'message-text-outline',
    TRANSACTION_HEADER: 'card-text-outline',
    ITEM_TABLE: 'table-large',
    TAX_DISCOUNT_TOTAL: 'percent-outline',
    MORE_TRANSACTION_FEATURES: 'dots-horizontal',
    GODOWN_AND_STOCK_TRANSFER: 'warehouse',
};

// ── Static items always shown in tabs (not from API) ─────────────────────────
const STATIC_ITEMS: Record<TabKey, { label: string; subtitle: string; icon: IconName; route: string }[]> = {
    app: [],
    invoicing: [
        { label: 'Printing & Templates', subtitle: 'Thermal, PDF layouts and preview', icon: 'printer-outline', route: '/(main)/more/printing' },
    ],
    inventory: [
        { label: 'Item Masters', subtitle: 'Manage item groups and HSN codes', icon: 'format-list-group', route: '/(main)/more/item-masters' },
    ],
    business: [
        { label: 'Staff and Roles', subtitle: 'Invite staff and manage role access', icon: 'account-multiple-outline', route: '/(main)/more/staff' },
        { label: 'Role Access Control', subtitle: 'Fine-grained module permissions', icon: 'shield-account-outline', route: '/(main)/more/role-access' },
        { label: 'Subscription', subtitle: 'Manage plan and billing', icon: 'crown-outline', route: '/(main)/more/subscription' },
        { label: 'Legal Center', subtitle: 'Terms, privacy, changelog', icon: 'file-document-outline', route: '/legal' },
    ],
    notifications: [],
};

const THEME_OPTIONS: { key: ThemePreference; label: string; icon: IconName }[] = [
    { key: 'system', label: 'System', icon: 'brightness-auto' },
    { key: 'light', label: 'Light', icon: 'white-balance-sunny' },
    { key: 'dark', label: 'Dark', icon: 'weather-night' },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function SettingsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
    const { selection } = useHaptics();
    const themeStore = useThemeStore();

    const [activeTab, setActiveTab] = useState<TabKey>('app');
    const [search, setSearch] = useState('');

    // Local preferences (theme / haptics / motion) for App tab
    const [prefs, setPrefs] = useState<LocalPreferences>(DEFAULT_LOCAL_PREFERENCES);
    const [prefsLoading, setPrefsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        void getLocalPreferences().then((local) => {
            if (!active) return;
            setPrefs(local);
            setPrefsLoading(false);
        });
        return () => { active = false; };
    }, []);

    const updatePrefs = async (patch: Partial<LocalPreferences>) => {
        const next = await patchLocalPreferences(patch);
        setPrefs(next);
        if (patch.themeMode !== undefined) themeStore.setThemeMode(patch.themeMode);
        if (patch.hapticsEnabled !== undefined) themeStore.setHapticsEnabled(patch.hapticsEnabled);
        if (patch.richMotionEnabled !== undefined) themeStore.setRichMotionEnabled(patch.richMotionEnabled);
    };

    // API sections schema
    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['settings-schema'],
        queryFn: () => settingsApi.getSchema(),
        staleTime: 30 * 60_000,
    });

    const apiSectionsByTab = useMemo(() => {
        const apiSections = data?.sections ?? [];
        const schema = data?.schema ?? {};
        const EXCLUDED = ['INVOICE_PRINT'];

        const result: Record<TabKey, { key: string; label: string; fieldCount: number; icon: IconName }[]> = {
            app: [], invoicing: [], inventory: [], business: [], notifications: [],
        };

        for (const section of apiSections) {
            if (EXCLUDED.includes(section)) continue;
            const tab: TabKey = SECTION_TAB_MAP[section] ?? 'business';
            result[tab].push({
                key: section,
                label: getSettingsSectionLabel(section),
                fieldCount: (schema[section] ?? []).length,
                icon: SECTION_ICON[section] ?? 'tune-variant',
            });
        }
        return result;
    }, [data]);

    // Global search across all tabs
    const searchResults = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return null;
        const results: { key: string; label: string; fieldCount: number; icon: IconName; tab: TabKey }[] = [];

        (Object.keys(apiSectionsByTab) as TabKey[]).forEach((tab) => {
            for (const section of apiSectionsByTab[tab]) {
                if (`${section.label} ${section.key}`.toLowerCase().includes(needle)) {
                    results.push({ ...section, tab });
                }
            }
            for (const si of STATIC_ITEMS[tab]) {
                if (`${si.label} ${si.subtitle}`.toLowerCase().includes(needle)) {
                    results.push({ key: si.label, label: si.label, fieldCount: 0, icon: si.icon, tab });
                }
            }
        });
        return results;
    }, [search, apiSectionsByTab]);

    const navigateToSection = (key: string) =>
        router.push(`/(main)/more/settings/${key}` as Parameters<typeof router.push>[0]);

    const ActiveTabContent = () => {
        if (activeTab === 'app') {
            return (
                <ScrollView contentContainerStyle={s.tabContent} refreshControl={<RefreshControl tintColor={colors.primary} refreshing={false} onRefresh={() => { }} />}>
                    <AppBlock colors={colors} prefs={prefs} loading={prefsLoading} onUpdate={updatePrefs} />
                </ScrollView>
            );
        }

        const apiRows = apiSectionsByTab[activeTab] ?? [];
        const staticRows = STATIC_ITEMS[activeTab] ?? [];

        return (
            <ScrollView contentContainerStyle={s.tabContent} refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isRefetching && !isLoading} onRefresh={() => { void refetch(); }} />}>
                {isLoading ? <ListSkeleton rows={5} /> : (
                    <>
                        {apiRows.map((section) => (
                            <SettingRow
                                key={section.key}
                                icon={section.icon}
                                label={section.label}
                                meta={`${section.fieldCount} fields`}
                                colors={colors}
                                onPress={() => { void selection(); navigateToSection(section.key); }}
                            />
                        ))}
                        {staticRows.map((si) => (
                            <SettingRow
                                key={si.label}
                                icon={si.icon}
                                label={si.label}
                                meta={si.subtitle}
                                colors={colors}
                                onPress={() => { void selection(); router.push(si.route as Parameters<typeof router.push>[0]); }}
                            />
                        ))}
                        {apiRows.length === 0 && staticRows.length === 0 ? (
                            <View style={s.empty}>
                                <MaterialCommunityIcons name="tune-variant" size={32} color={colors.textSecondary} />
                                <Text style={[s.emptyTitle, { color: colors.text }]}>No settings here</Text>
                                <Text style={[s.emptyMeta, { color: colors.textSecondary }]}>This category has no configurable options.</Text>
                            </View>
                        ) : null}
                    </>
                )}
            </ScrollView>
        );
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar title="Settings" subtitle="All preferences in one place" onBackPress={smartBack} />

            {/* Search bar */}
            <View style={s.searchWrap}>
                <AppSearchBar value={search} onChangeText={setSearch} placeholder="Search any setting..." />
            </View>

            {/* Global search results */}
            {searchResults ? (
                <ScrollView contentContainerStyle={s.tabContent}>
                    {searchResults.length === 0 ? (
                        <View style={s.empty}>
                            <MaterialCommunityIcons name="file-search-outline" size={28} color={colors.textSecondary} />
                            <Text style={[s.emptyTitle, { color: colors.text }]}>No results</Text>
                        </View>
                    ) : searchResults.map((r) => (
                        <SettingRow
                            key={r.key + r.tab}
                            icon={r.icon}
                            label={r.label}
                            meta={TABS.find((t) => t.key === r.tab)?.label ?? r.tab}
                            colors={colors}
                            onPress={() => { void selection(); navigateToSection(r.key); }}
                        />
                    ))}
                </ScrollView>
            ) : (
                <>
                    {/* Tab Bar */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarScroll} contentContainerStyle={s.tabBar}>
                        {TABS.map((tab) => {
                            const sel = activeTab === tab.key;
                            return (
                                <Pressable key={tab.key} style={[s.tabChip, sel && { backgroundColor: colors.primary }]}
                                    onPress={() => { void selection(); setActiveTab(tab.key); }}>
                                    <MaterialCommunityIcons name={tab.icon} size={13} color={sel ? colors.onPrimary : colors.textSecondary} />
                                    <Text style={[s.tabChipText, { color: sel ? colors.onPrimary : colors.textSecondary, fontWeight: sel ? '700' : '500' }]}>{tab.label}</Text>
                                </Pressable>
                            );
                        })}
                        </ScrollView>

                        {/* Tab indicator dot */}
                        <View style={s.tabUnderline}>
                            {TABS.map((tab) => (
                                <View key={tab.key} style={[s.tabDot, { backgroundColor: activeTab === tab.key ? colors.primary : 'transparent' }]} />
                            ))}
                    </View>

                    <ActiveTabContent />
                </>
            )}
        </SafeAreaView>
    );
}

// ── App Tab ────────────────────────────────────────────────────────────────────
function AppBlock({ colors, prefs, loading, onUpdate }: { colors: ColorPalette; prefs: LocalPreferences; loading: boolean; onUpdate: (patch: Partial<LocalPreferences>) => void }) {
    const s = blockStyles(colors);

    if (loading) return <ListSkeleton rows={3} />;

    return (
        <>
            {/* Theme */}
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>THEME MODE</Text>
                <View style={s.chipRow}>
                    {THEME_OPTIONS.map((opt) => {
                        const sel = prefs.themeMode === opt.key;
                        return (
                            <Pressable key={opt.key} style={[s.themeChip, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? withAlpha(colors.primary, '18') : 'transparent' }]}
                                onPress={() => onUpdate({ themeMode: opt.key })}>
                                <MaterialCommunityIcons name={opt.icon} size={15} color={sel ? colors.primary : colors.textSecondary} />
                                <Text style={{ color: sel ? colors.primary : colors.textSecondary, fontWeight: sel ? '700' : '500', fontSize: 12 }}>{opt.label}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* Interaction */}
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>INTERACTION</Text>
                {[
                    { label: 'Rich Motion', sub: 'Richer transitions and animations', key: 'richMotionEnabled' as const },
                    { label: 'Haptics', sub: 'Tactile feedback on taps and actions', key: 'hapticsEnabled' as const },
                ].map((item) => (
                    <View key={item.key} style={s.toggleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.toggleLabel, { color: colors.text }]}>{item.label}</Text>
                            <Text style={[s.toggleSub, { color: colors.textSecondary }]}>{item.sub}</Text>
                        </View>
                        <Switch
                            value={prefs[item.key] as boolean}
                            onValueChange={(v) => onUpdate({ [item.key]: v })}
                            trackColor={{ true: colors.primary, false: colors.border }}
                            thumbColor={colors.onPrimary}
                        />
                    </View>
                ))}
            </View>

            {/* Info note */}
            <View style={[s.infoCard, { backgroundColor: withAlpha(colors.info, '12'), borderColor: withAlpha(colors.info, '30') }]}>
                <MaterialCommunityIcons name="information-outline" size={15} color={colors.info} />
                <Text style={[s.infoText, { color: colors.textSecondary }]}>Theme and interaction preferences are stored locally on this device only.</Text>
            </View>
        </>
    );
}

// ── Shared Row Component ───────────────────────────────────────────────────────
function SettingRow({ icon, label, meta, colors, onPress }: { icon: IconName; label: string; meta: string; colors: ColorPalette; onPress: () => void }) {
    return (
        <Pressable style={({ pressed }) => [rowStyles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]} onPress={onPress}>
            <View style={[rowStyles.iconWrap, { backgroundColor: withAlpha(colors.primary, '16') }]}>
                <MaterialCommunityIcons name={icon} size={16} color={colors.primary} />
            </View>
            <View style={rowStyles.info}>
                <Text style={[rowStyles.label, { color: colors.text }]}>{label}</Text>
                <Text style={[rowStyles.meta, { color: colors.textSecondary }]} numberOfLines={1}>{meta}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
        </Pressable>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    searchWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs },
    tabBarScroll: { flexGrow: 0 },
    tabBar: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
    tabChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: Spacing.md, borderRadius: Radius.pill, backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border },
    tabChipText: { fontSize: 12 },
    tabUnderline: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: Spacing.sm },
    tabDot: { width: 6, height: 6, borderRadius: 3 },
    tabContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: 120 },
    empty: { paddingTop: 60, alignItems: 'center', gap: 8 },
    emptyTitle: { fontWeight: '700', fontSize: 15 },
    emptyMeta: { fontSize: 12, textAlign: 'center' },
});

const blockStyles = (colors: ColorPalette) => StyleSheet.create({
    card: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.md, gap: Spacing.sm },
    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    chipRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    themeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 7 },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 },
    toggleLabel: { fontSize: 14, fontWeight: '700' },
    toggleSub: { fontSize: 12, marginTop: 2 },
    infoCard: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.sm, flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    infoText: { flex: 1, fontSize: 12, fontWeight: '500' },
});

const rowStyles = StyleSheet.create({
    row: { borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    iconWrap: { width: 34, height: 34, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1 },
    label: { fontSize: 14, fontWeight: '600' },
    meta: { fontSize: 12, marginTop: 2 },
});
