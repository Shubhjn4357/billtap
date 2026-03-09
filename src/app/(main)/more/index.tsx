import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FeatureFlag } from '../../../constants/enums';
import { MORE_SCREEN_SECTIONS } from '../../../constants/utilityNavigation';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { canAccessModule, getEffectiveFeatureFlags } from '../../../utils/accessControl';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { UtilityEmptyState, UtilityHero, UtilityPanel, UtilityRow, UtilitySection } from '../../../components/ui/UtilityBlocks';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useAppColors } from '../../../hooks/useAppColors';
import { useAuthStore } from '../../../store/authStore';

export default function MoreScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);

    const user = useAuthStore((state) => state.user);
    const business = useAuthStore((state) => state.business);
    const subscription = useAuthStore((state) => state.subscription);
    const role = useAuthStore((state) => state.organizationRole);
    const signOut = useAuthStore((state) => state.signOut);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const [search, setSearch] = useState('');
    const { selection } = useHaptics();

    // Refresh on mount to catch stale subscription tier
    useEffect(() => {
        void refreshUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const featureFlags = getEffectiveFeatureFlags(subscription);
    const roleLabel = (role ?? 'staff').toUpperCase();
    const syncLabel = subscription?.cloudSyncAllowed ? 'Cloud Sync' : 'Offline First';

    const handleSignOut = () => {
        dialog.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
    };

    const sections = useMemo(() => MORE_SCREEN_SECTIONS.map((section) => ({
        title: section.title,
        items: section.items.map((item) => ({
            ...item,
            visible: item.requiresPos
                ? featureFlags.includes(FeatureFlag.POS_MODE)
                : item.requiresFeature
                    ? featureFlags.includes(item.requiresFeature)
                    : item.module
                        ? canAccessModule(role, item.module, subscription)
                        : true,
        })),
    })), [featureFlags, role, subscription]);

    const filteredSections = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return sections;
        return sections
            .map((section) => ({
                ...section,
                items: section.items.filter((item) => item.label.toLowerCase().includes(needle)),
            }))
            .filter((section) => section.items.length > 0);
    }, [search, sections]);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <AppTopBar
                    title="More"
                    subtitle="Utilities, controls, legal and admin tools"
                    rightAction={(
                        <Pressable onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}>
                            <MaterialCommunityIcons name="compass-outline" size={20} color={colors.primary} />
                        </Pressable>
                    )}
                />

                <View style={s.searchWrap}>
                    <AppSearchBar
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search settings, utilities, legal..."
                    />
                </View>

                <View style={s.heroWrap}>
                    <UtilityHero
                        title={business?.name ?? 'My Business'}
                        subtitle={`${user?.name ?? 'User'}${user?.email ? ` · ${user.email}` : ''}`}
                        icon="view-grid-plus-outline"
                        tone="info"
                        right={(
                            <View style={[s.tierChip, { backgroundColor: withAlpha(colors.primary, '18'), borderColor: withAlpha(colors.primary, '42') }]}>
                                <Text style={[s.tierChipText, { color: colors.primary }]}>{subscription?.tier ?? 'FREE'}</Text>
                            </View>
                        )}
                        footer={(
                            <>
                                <View style={[s.metaChip, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                                    <MaterialCommunityIcons name="shield-account-outline" size={14} color={colors.primary} />
                                    <Text style={[s.metaChipText, { color: colors.text }]}>{roleLabel}</Text>
                                </View>
                                <View style={[s.metaChip, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                                    <MaterialCommunityIcons name="sync" size={14} color={colors.primary} />
                                    <Text style={[s.metaChipText, { color: colors.text }]}>{syncLabel}</Text>
                                </View>
                            </>
                        )}
                    />
                </View>

                {filteredSections.map((section) => {
                    const visibleItems = section.items.filter((item) => item.visible);
                    if (visibleItems.length === 0) return null;

                    return (
                        <UtilitySection key={section.title} title={section.title} count={visibleItems.length}>
                            <UtilityPanel>
                                {visibleItems.map((item, index) => (
                                    <View
                                        key={item.label}
                                        style={index < visibleItems.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}
                                    >
                                        <UtilityRow
                                            label={item.label}
                                            description={item.description}
                                            icon={item.icon}
                                            accent={item.tone}
                                            onPress={() => {
                                                void selection();
                                                router.push(item.route as Parameters<typeof router.push>[0]);
                                            }}
                                        />
                                    </View>
                                ))}
                            </UtilityPanel>
                        </UtilitySection>
                    );
                })}

                {filteredSections.length === 0 ? (
                    <View style={s.section}>
                        <UtilityEmptyState
                            icon="file-search-outline"
                            title="No matches"
                            description="No utility or admin screen matches the current search."
                        />
                    </View>
                ) : null}

                <View style={s.section}>
                    <Pressable style={[s.signOutBtn, { borderColor: colors.error }]} onPress={handleSignOut}>
                        <Text style={[s.signOutText, { color: colors.error }]}>Sign Out</Text>
                    </Pressable>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
        title: { fontSize: Typography.headline.size, fontWeight: '700', color: colors.text },
        searchWrap: {
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
        },
        heroWrap: {
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.lg,
        },
        tierChip: {
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
            borderRadius: Radius.pill,
            borderWidth: 1,
        },
        tierChipText: { fontWeight: '800', fontSize: 11 },
        metaChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        metaChipText: {
            fontSize: Typography.caption.size,
            fontWeight: '600',
        },
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
        signOutBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.md, alignItems: 'center' },
        signOutText: { fontWeight: '700', fontSize: 14 },
    });
