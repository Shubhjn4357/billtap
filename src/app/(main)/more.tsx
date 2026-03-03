import { Alert, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { FeatureFlag } from '../../constants/enums';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { canAccessModule, getEffectiveFeatureFlags } from '../../utils/accessControl';

export default function MoreScreen() {
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const s = styles(colors);

    const user = useAuthStore((state) => state.user);
    const business = useAuthStore((state) => state.business);
    const subscription = useAuthStore((state) => state.subscription);
    const role = useAuthStore((state) => state.organizationRole);
    const signOut = useAuthStore((state) => state.signOut);

    const featureFlags = getEffectiveFeatureFlags(subscription);

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
    };

    const sections = [
        {
            title: 'Main',
            items: [
                { label: 'Parties', route: '/(main)/parties', visible: canAccessModule(role, 'parties', subscription) },
                { label: 'Reports', route: '/(main)/reports', visible: canAccessModule(role, 'reports', subscription) },
                { label: 'POS Mode', route: '/(main)/billing/pos', visible: featureFlags.includes(FeatureFlag.POS_MODE) },
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
                { label: 'Staff and Roles', route: '/(main)/more/staff', visible: canAccessModule(role, 'staff', subscription) },
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
    ];

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.header}>
                    <Text style={s.title}>More</Text>
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
                    <View style={[s.tierChip, { backgroundColor: '#ffffff33' }]}>
                        <Text style={s.tierChipText}>{subscription?.tier ?? 'FREE'}</Text>
                    </View>
                </View>

                {sections.map((section) => {
                    const visibleItems = section.items.filter((item) => item.visible);
                    if (visibleItems.length === 0) return null;

                    return (
                        <View key={section.title} style={s.section}>
                            <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>{section.title.toUpperCase()}</Text>
                            <View style={[s.menuGroup, { backgroundColor: colors.card }]}> 
                                {visibleItems.map((item, index) => (
                                    <Pressable
                                        key={item.label}
                                        style={({ pressed }) => [
                                            s.menuItem,
                                            index < visibleItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                                            pressed && { backgroundColor: colors.backgroundSelected },
                                        ]}
                                        onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
                                    >
                                        <Text style={[s.menuLabel, { color: colors.text }]}>{item.label}</Text>
                                        <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{'>'}</Text>
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
        profileCard: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.xl,
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
            backgroundColor: '#ffffff44',
            alignItems: 'center',
            justifyContent: 'center',
        },
        profileAvatarText: { color: '#fff', fontWeight: '700', fontSize: 22 },
        profileInfo: { flex: 1 },
        profileName: { color: '#fff', fontWeight: '700', fontSize: 16 },
        profileEmail: { color: '#ffffffaa', fontSize: 12 },
        profileBiz: { color: '#ffffffcc', fontSize: 12, marginTop: 2 },
        tierChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
        tierChipText: { color: '#fff', fontWeight: '700', fontSize: 11 },
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
        sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
        menuGroup: { borderRadius: Radius.card, overflow: 'hidden' },
        menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing.md, gap: Spacing.md },
        menuLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
        signOutBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.md, alignItems: 'center' },
        signOutText: { fontWeight: '700', fontSize: 14 },
    });
