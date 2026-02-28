// @ts-nocheck
import { Alert, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';

export default function MoreScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const { user, business, subscription, signOut } = useAuthStore();
    const s = styles(colors);

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
    };

    const sections = [
        {
            title: 'Billing',
            items: [
                { icon: 'POS', label: 'POS Mode', route: '/(main)/billing/pos' },
                { icon: 'SAL', label: 'New Sale Invoice', route: '/(main)/billing/create?type=TAX_INVOICE' },
                { icon: 'PUR', label: 'New Purchase Bill', route: '/(main)/billing/create?type=PURCHASE_BILL' },
            ],
        },
        {
            title: 'Accounts',
            items: [
                { icon: 'CB', label: 'Cash & Bank', route: '/(main)/accounts/cash-bank' },
                { icon: 'EXP', label: 'Expenses', route: '/(main)/accounts/expenses' },
                { icon: 'LOAN', label: 'Loans', route: '/(main)/accounts/loans' },
            ],
        },
        {
            title: 'Inventory',
            items: [
                { icon: 'GD', label: 'Godowns', route: '/(main)/more/godowns' },
            ],
        },
        {
            title: 'Reports',
            items: [
                { icon: 'RPT', label: 'Profit & Loss', route: '/(main)/more/reports/pnl' },
            ],
        },
        {
            title: 'Business',
            items: [
                { icon: 'SET', label: 'Settings', route: '/(main)/more/settings' },
                { icon: 'SUB', label: 'Subscription Plan', route: '/(main)/more/subscription' },
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

                {sections.map((section) => (
                    <View key={section.title} style={s.section}>
                        <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>{section.title.toUpperCase()}</Text>
                        <View style={[s.menuGroup, { backgroundColor: colors.card }]}>
                            {section.items.map((item, idx) => (
                                <Pressable
                                    key={item.label}
                                    style={({ pressed }) => [
                                        s.menuItem,
                                        idx < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                                        pressed && { backgroundColor: colors.backgroundSelected },
                                    ]}
                                    onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
                                >
                                    <Text style={s.menuIcon}>{item.icon}</Text>
                                    <Text style={[s.menuLabel, { color: colors.text }]}>{item.label}</Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{'>'}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                ))}

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

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    title: { fontSize: Typography.headline.size, fontWeight: '700', color: colors.text },
    profileCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.xl, borderRadius: Radius.card, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    profileAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ffffff44', alignItems: 'center', justifyContent: 'center' },
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
    menuIcon: { fontSize: 12, width: 34, fontWeight: '700', color: colors.textSecondary },
    menuLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
    signOutBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.md, alignItems: 'center' },
    signOutText: { fontWeight: '700', fontSize: 14 },
});


