import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../../store/authStore';
import { FeatureFlag } from '../../../constants/enums';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { canAccessModule, getEffectiveFeatureFlags } from '../../../utils/accessControl';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppDialog } from '@/components/providers/DialogProvider';

export default function MoreScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const s = styles(colors);

    const user = useAuthStore((state) => state.user);
    const business = useAuthStore((state) => state.business);
    const subscription = useAuthStore((state) => state.subscription);
    const role = useAuthStore((state) => state.organizationRole);
    const signOut = useAuthStore((state) => state.signOut);
    const [search, setSearch] = useState('');
    const { selection } = useHaptics();

    const featureFlags = getEffectiveFeatureFlags(subscription);
    const roleLabel = (role ?? 'staff').toUpperCase();
    const syncLabel = subscription?.cloudSyncAllowed ? 'Cloud Sync' : 'Offline First';

    const handleSignOut = () => {
        dialog.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
    };

    const sections = useMemo(() => [
        {
            title: 'Main',
            items: [
                { label: 'Screen Directory', route: '/(main)/more/screen-directory', visible: true },
                { label: 'Parties', route: '/(main)/parties', visible: canAccessModule(role, 'parties', subscription) },
                { label: 'Party Recycle Bin', route: '/(main)/parties/recycle-bin', visible: canAccessModule(role, 'parties', subscription) },
                { label: 'Item Recycle Bin', route: '/(main)/inventory/recycle-bin', visible: canAccessModule(role, 'inventory', subscription) },
                { label: 'Reports', route: '/(main)/reports', visible: canAccessModule(role, 'reports', subscription) },
                { label: 'Quick Sale (POS)', route: '/(main)/billing/pos', visible: featureFlags.includes(FeatureFlag.POS_MODE) },
            ],
        },
        {
            title: 'Accounts',
            items: [
                { label: 'Cash and Bank', route: '/(main)/accounts/cash-bank', visible: canAccessModule(role, 'accounts', subscription) },
                { label: 'Expenses', route: '/(main)/accounts/expenses', visible: canAccessModule(role, 'accounts', subscription) },
                { label: 'Expense Recycle Bin', route: '/(main)/accounts/expenses/recycle-bin', visible: canAccessModule(role, 'accounts', subscription) },
                { label: 'Loans', route: '/(main)/accounts/loans', visible: canAccessModule(role, 'accounts', subscription) },
            ],
        },
        {
            title: 'Control',
            items: [
                { label: 'Staff and Roles', route: '/(main)/more/staff', visible: true },
                { label: 'Role Access Control', route: '/(main)/more/role-access', visible: role === 'owner' && canAccessModule(role, 'settings', subscription) },
                { label: 'Operations', route: '/(main)/more/operations', visible: canAccessModule(role, 'operations', subscription) },
                { label: 'Announcements', route: '/(main)/more/announcements', visible: canAccessModule(role, 'operations', subscription) },
                { label: 'Godowns', route: '/(main)/more/godowns', visible: featureFlags.includes(FeatureFlag.MULTI_GODOWN) },
                { label: 'Offline Sync Diagnostics', route: '/(main)/more/sync', visible: true },
            ],
        },
        {
            title: 'Business',
            items: [
                { label: 'Settings', route: '/(main)/more/settings', visible: canAccessModule(role, 'settings', subscription) },
                { label: 'App Preferences', route: '/(main)/more/app-preferences', visible: true },
                { label: 'Item Masters', route: '/(main)/more/item-masters', visible: canAccessModule(role, 'inventory', subscription) },
                { label: 'Thermal Printer Profiles', route: '/(main)/more/thermal-printers', visible: canAccessModule(role, 'settings', subscription) },
                { label: 'Subscription', route: '/(main)/more/subscription', visible: true },
            ],
        },
        {
            title: 'Legal',
            items: [
                { label: 'Legal Center', route: '/legal', visible: true },
                { label: 'Terms of Service', route: '/legal/terms', visible: true },
                { label: 'Privacy Policy', route: '/legal/privacy', visible: true },
                { label: 'Version and Changelog', route: '/legal/changelog', visible: true },
            ],
        },
    ], [featureFlags, role, subscription]);

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

                <View style={[s.profileCard, { backgroundColor: colors.primary }]}> 
                    <View style={s.profileAvatar}>
                        <Text style={s.profileAvatarText}>{user?.name?.charAt(0) ?? '?'}</Text>
                    </View>
                    <View style={s.profileInfo}>
                        <Text style={s.profileName}>{user?.name ?? 'User'}</Text>
                        <Text style={s.profileEmail}>{user?.email ?? ''}</Text>
                        <Text style={s.profileBiz}>{business?.name ?? 'My Business'}</Text>
                    </View>
                    <View style={[s.tierChip, { backgroundColor: withAlpha(colors.onPrimary, '33') }]}>
                        <Text style={s.tierChipText}>{subscription?.tier ?? 'FREE'}</Text>
                    </View>
                </View>
                <View style={s.profileMetaRow}>
                    <View style={[s.metaChip, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="shield-account-outline" size={14} color={colors.primary} />
                        <Text style={[s.metaChipText, { color: colors.text }]}>{roleLabel}</Text>
                    </View>
                    <View style={[s.metaChip, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="sync" size={14} color={colors.primary} />
                        <Text style={[s.metaChipText, { color: colors.text }]}>{syncLabel}</Text>
                    </View>
                </View>

                {filteredSections.map((section) => {
                    const visibleItems = section.items.filter((item) => item.visible);
                    if (visibleItems.length === 0) return null;

                    return (
                        <View key={section.title} style={s.section}>
                            <View style={s.sectionHead}>
                                <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>{section.title.toUpperCase()}</Text>
                                <Text style={[s.sectionCount, { color: colors.textSecondary }]}>{visibleItems.length}</Text>
                            </View>
                            <View style={[s.menuGroup, { backgroundColor: colors.card }]}> 
                                {visibleItems.map((item, index) => (
                                    <Pressable
                                        key={item.label}
                                        style={({ pressed }) => [
                                            s.menuItem,
                                            index < visibleItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                                            pressed && { backgroundColor: colors.backgroundSelected },
                                        ]}
                                        onPress={() => {
                                            void selection();
                                            router.push(item.route as Parameters<typeof router.push>[0]);
                                        }}
                                    >
                                        <Text style={[s.menuLabel, { color: colors.text }]}>{item.label}</Text>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    );
                })}

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
        profileCard: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
            padding: Spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
        },
        profileAvatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: withAlpha(colors.onPrimary, '44'),
            alignItems: 'center',
            justifyContent: 'center',
        },
        profileAvatarText: { color: colors.onPrimary, fontWeight: '700', fontSize: 22 },
        profileInfo: { flex: 1 },
        profileName: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
        profileEmail: { color: withAlpha(colors.onPrimary, 'aa'), fontSize: 12 },
        profileBiz: { color: withAlpha(colors.onPrimary, 'cc'), fontSize: 12, marginTop: 2 },
        tierChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
        tierChipText: { color: colors.onPrimary, fontWeight: '700', fontSize: 11 },
        profileMetaRow: {
            paddingHorizontal: Spacing.lg,
            marginBottom: Spacing.lg,
            flexDirection: 'row',
            gap: Spacing.sm,
        },
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
        sectionHead: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: Spacing.sm,
        },
        sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
        sectionCount: { fontSize: Typography.caption.size, fontWeight: '700' },
        menuGroup: { borderRadius: Radius.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
        menuItem: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 12, paddingHorizontal: Spacing.md, gap: Spacing.md },
        menuLabel: { flex: 1, fontSize: Typography.body.size, fontWeight: '600' },
        signOutBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.md, alignItems: 'center' },
        signOutText: { fontWeight: '700', fontSize: 14 },
    });
