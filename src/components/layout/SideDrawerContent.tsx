import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESIGN_SPACING, getInsetPanelStyle, getPillStyle, getSurfaceStyle } from '../../constants/designSystem';
import { SIDE_DRAWER_ACTIONS } from '../../constants/navigationOptions';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { useI18n } from '../../hooks/useI18n';
import { useAuthStore } from '../../store/authStore';
import { canAccessModule, canUsePos } from '../../utils/accessControl';
import { AppSearchBar } from '../ui/AppSearchBar';
import { useHaptics } from '../../hooks/useHaptics';

type SideDrawerContentProps = {
    onClose: () => void;
};

export function SideDrawerContent({ onClose }: SideDrawerContentProps) {
    const colors = useAppColors();
    const s = styles(colors);
    const insets = useSafeAreaInsets();
    const { selection } = useHaptics();
    const { t } = useI18n();

    const [search, setSearch] = useState('');
    const user = useAuthStore((state) => state.user);
    const business = useAuthStore((state) => state.business);
    const subscription = useAuthStore((state) => state.subscription);
    const role = useAuthStore((state) => state.organizationRole);

    const actions = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        return SIDE_DRAWER_ACTIONS.filter((action) => {
            if (action.requiresPos && !canUsePos(subscription)) return false;
            if (action.module && !canAccessModule(role, action.module, subscription, business)) return false;
            if (!normalized) return true;
            return action.label.toLowerCase().includes(normalized);
        });
    }, [business, role, search, subscription]);

    return (
        <View style={[s.root, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={s.headerCard}>
                <View style={s.headerTop}>
                    <View style={{ flex: 1 }}>
                        <Text style={[s.eyebrow, { color: colors.primary }]}>{t('drawer.workspace')}</Text>
                        <Text style={[s.headerTitle, { color: colors.text }]}>{t('drawer.navigate_faster')}</Text>
                    </View>
                    <Pressable
                        style={({ pressed }) => [
                            s.closeButton,
                            { backgroundColor: pressed ? colors.backgroundSelected : colors.card },
                        ]}
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Close drawer"
                    >
                        <MaterialCommunityIcons name="close" size={18} color={colors.text} />
                    </Pressable>
                </View>

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

                <View style={s.metaRow}>
                    <View style={[s.metaChip, { backgroundColor: colors.backgroundElement, borderColor: withAlpha(colors.primary, '20') }]}>
                        <MaterialCommunityIcons name="storefront-outline" size={14} color={colors.primary} />
                        <Text style={[s.metaText, { color: colors.textSecondary }]}>{t('drawer.active_business')}</Text>
                    </View>
                    <View style={[s.metaChip, { backgroundColor: colors.backgroundElement, borderColor: withAlpha(colors.primary, '20') }]}>
                        <MaterialCommunityIcons name="lightning-bolt-outline" size={14} color={colors.primary} />
                        <Text style={[s.metaText, { color: colors.textSecondary }]}>{t('drawer.shortcuts', { count: actions.length })}</Text>
                    </View>
                </View>
            </View>

            <View style={s.searchWrap}>
                <AppSearchBar
                    placeholder={t('drawer.search_placeholder')}
                    value={search}
                    onChangeText={setSearch}
                    showScanAction={false}
                />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
                {actions.map((action) => (
                    <Pressable
                        key={action.key}
                        style={({ pressed }) => [
                            s.actionRow,
                            {
                                backgroundColor: pressed ? colors.backgroundSelected : colors.card,
                                borderColor: pressed ? withAlpha(colors.primary, '34') : withAlpha(colors.primary, '18'),
                            },
                        ]}
                        onPress={() => {
                            void selection();
                            onClose();
                            router.push(action.route as Parameters<typeof router.push>[0]);
                        }}
                    >
                        <View style={[s.actionIconWrap, { backgroundColor: withAlpha(colors.primary, '12') }]}>
                            <MaterialCommunityIcons name={action.icon} size={20} color={colors.primary} />
                        </View>
                        <View style={s.actionCopy}>
                            <Text style={[s.actionText, { color: colors.text }]}>{action.label}</Text>
                            <Text style={[s.actionSubtext, { color: colors.textSecondary }]}>{t('drawer.open_workflow')}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        root: {
            flex: 1,
            width: '100%',
            backgroundColor: colors.surfaceRaised,
            borderRadius: 32,
            paddingHorizontal: Spacing.md,
            ...getSurfaceStyle(colors, { floating: true }),
        },
        headerCard: {
            padding: Spacing.lg,
            marginBottom: Spacing.md,
            gap: Spacing.md,
            borderRadius: Radius.xl,
            ...getSurfaceStyle(colors, { accent: colors.primary }),
        },
        headerTop: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        eyebrow: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
        },
        headerTitle: {
            marginTop: 2,
            fontSize: Typography.title.size,
            fontWeight: '700',
        },
        closeButton: {
            ...getPillStyle(colors, colors.primary),
            width: 36,
            height: 36,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        avatarWrap: {
            width: 46,
            height: 46,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 6,
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
        metaRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.xs,
        },
        metaChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
            ...getInsetPanelStyle(colors, colors.primary),
        },
        metaText: {
            fontSize: Typography.caption.size,
            fontWeight: '600',
        },
        searchWrap: {
            marginBottom: Spacing.sm,
        },
        scrollContent: {
            paddingBottom: DESIGN_SPACING.sectionGap,
        },
        actionRow: {
            minHeight: 62,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.xs,
            ...getSurfaceStyle(colors),
        },
        actionIconWrap: {
            width: 40,
            height: 40,
            borderRadius: Radius.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        actionCopy: {
            flex: 1,
        },
        actionText: {
            fontSize: Typography.body.size,
            fontWeight: '600',
        },
        actionSubtext: {
            marginTop: 2,
            fontSize: Typography.caption.size,
            fontWeight: '500',
        },
    });
