import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColors, Radius, Spacing, Typography } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { canAccessModule, canUsePos } from '../../utils/accessControl';
import { AppSearchBar } from '../ui/AppSearchBar';
import { useHaptics } from '../../hooks/useHaptics';

type DrawerAction = {
    key: string;
    label: string;
    route: Parameters<typeof router.push>[0];
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    module?: 'home' | 'billing' | 'inventory' | 'accounts' | 'reports' | 'parties' | 'settings' | 'operations' | 'staff';
    requiresPos?: boolean;
};

const ACTIONS: DrawerAction[] = [
    { key: 'home', label: 'Dashboard', route: '/(main)' as Parameters<typeof router.push>[0], icon: 'view-dashboard-outline', module: 'home' },
    { key: 'billing', label: 'Billing', route: '/(main)/billing', icon: 'file-document-multiple-outline', module: 'billing' },
    { key: 'invoice', label: 'New Sale Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', icon: 'file-document-plus-outline', module: 'billing' },
    { key: 'pos', label: 'Quick Sale (POS)', route: '/(main)/billing/pos', icon: 'point-of-sale', module: 'billing', requiresPos: true },
    { key: 'inventory', label: 'Inventory', route: '/(main)/inventory', icon: 'archive-outline', module: 'inventory' },
    { key: 'add-item', label: 'Add Item', route: '/(main)/inventory/add-item', icon: 'package-variant-plus', module: 'inventory' },
    { key: 'parties', label: 'Parties', route: '/(main)/parties', icon: 'account-multiple-outline', module: 'parties' },
    { key: 'accounts', label: 'Accounts', route: '/(main)/accounts', icon: 'bank-outline', module: 'accounts' },
    { key: 'reports', label: 'Reports', route: '/(main)/reports', icon: 'chart-line', module: 'reports' },
    { key: 'staff', label: 'Staff and Roles', route: '/(main)/more/staff', icon: 'account-group-outline', module: 'staff' },
    { key: 'settings', label: 'Settings', route: '/(main)/more/settings', icon: 'cog-outline', module: 'settings' },
    { key: 'dir', label: 'Screen Directory', route: '/(main)/more/screen-directory', icon: 'compass-outline' },
];

type SideDrawerContentProps = {
    onClose: () => void;
};

export function SideDrawerContent({ onClose }: SideDrawerContentProps) {
    const scheme = useColorScheme();
    const colors = getColors(scheme);
    const s = styles(colors);
    const insets = useSafeAreaInsets();
    const { selection } = useHaptics();

    const [search, setSearch] = useState('');
    const user = useAuthStore((state) => state.user);
    const business = useAuthStore((state) => state.business);
    const subscription = useAuthStore((state) => state.subscription);
    const role = useAuthStore((state) => state.organizationRole);

    const actions = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        return ACTIONS.filter((action) => {
            if (action.requiresPos && !canUsePos(subscription)) return false;
            if (action.module && !canAccessModule(role, action.module, subscription)) return false;
            if (!normalized) return true;
            return action.label.toLowerCase().includes(normalized);
        });
    }, [role, search, subscription]);

    return (
        <View style={[s.root, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={s.header}>
                <View style={[s.avatarWrap, { backgroundColor: colors.primary }]}>
                    <Text style={s.avatarText}>{(user?.name ?? 'U').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[s.userName, { color: colors.text }]} numberOfLines={1}>{user?.name ?? 'User'}</Text>
                    <Text style={[s.bizName, { color: colors.textSecondary }]} numberOfLines={1}>
                        {business?.name ?? 'Business'}
                    </Text>
                </View>
            </View>

            <View style={s.searchWrap}>
                <AppSearchBar
                    placeholder="Search drawer actions..."
                    value={search}
                    onChangeText={setSearch}
                    showScanAction={false}
                />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {actions.map((action) => (
                    <Pressable
                        key={action.key}
                        style={({ pressed }) => [
                            s.actionRow,
                            { backgroundColor: pressed ? colors.surfaceVariant : 'transparent' },
                        ]}
                        onPress={() => {
                            void selection();
                            onClose();
                            router.push(action.route);
                        }}
                    >
                        <MaterialCommunityIcons name={action.icon} size={20} color={colors.primary} />
                        <Text style={[s.actionText, { color: colors.text }]}>{action.label}</Text>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = (colors: ReturnType<typeof getColors>) =>
    StyleSheet.create({
        root: {
            flex: 1,
            width: 304,
            backgroundColor: colors.surface,
            borderRightWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: Spacing.md,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            marginBottom: Spacing.sm,
        },
        avatarWrap: {
            width: 42,
            height: 42,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarText: {
            color: colors.onPrimary,
            fontSize: Typography.title.size,
            fontWeight: '700',
        },
        userName: {
            fontSize: Typography.body.size,
            fontWeight: '700',
        },
        bizName: {
            marginTop: 2,
            fontSize: Typography.caption.size,
            fontWeight: '500',
        },
        searchWrap: {
            marginBottom: Spacing.sm,
        },
        actionRow: {
            minHeight: 46,
            borderRadius: Radius.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.sm,
            marginBottom: 4,
        },
        actionText: {
            flex: 1,
            fontSize: Typography.body.size,
            fontWeight: '600',
        },
    });
