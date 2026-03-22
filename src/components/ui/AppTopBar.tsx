import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { useHaptics } from '../../hooks/useHaptics';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useAppDrawer } from '../layout/AppDrawerLayout';
import { openGoToPalette } from '../navigation/GoToPalette';

type AppTopBarProps = {
    title: string;
    subtitle?: string;
    onBackPress?: () => void;
    onMenuPress?: () => void;
    rightAction?: React.ReactNode;
    leftMode?: 'auto' | 'none';
    showSearch?: boolean;
};

export const AppTopBar = memo(function AppTopBar({
    title,
    subtitle,
    onBackPress,
    onMenuPress,
    rightAction,
    leftMode = 'auto',
    showSearch = true,
}: AppTopBarProps) {
    const colors = useAppColors();
    const s = styles(colors);
    const { impact, selection } = useHaptics();
    const drawer = useAppDrawer();
    const syncStatus = useSyncStatus();

    const syncMeta = useMemo(() => {
        if (syncStatus.blockedCount > 0) {
            return { label: `${syncStatus.blockedCount} blocked`, color: colors.warning };
        }
        if (syncStatus.isSyncing) {
            return { label: 'Syncing', color: colors.info };
        }
        if (!syncStatus.isOnline) {
            return { label: 'Offline', color: colors.textSecondary };
        }
        if (syncStatus.pendingCount > 0) {
            return { label: `${syncStatus.pendingCount} queued`, color: colors.primary };
        }
        return { label: 'Synced', color: colors.success };
    }, [
        colors.info,
        colors.primary,
        colors.success,
        colors.textSecondary,
        colors.warning,
        syncStatus.blockedCount,
        syncStatus.isOnline,
        syncStatus.isSyncing,
        syncStatus.pendingCount,
    ]);

    const handleMenuPress = () => {
        void impact();
        if (onMenuPress) {
            onMenuPress();
            return;
        }
        drawer?.toggleDrawer(true);
    };

    return (
        <View style={s.wrap}>
            <View style={s.leftRow}>
                {leftMode === 'none' ? (
                    <View style={s.iconPlaceholder} />
                ) : onBackPress ? (
                    <Pressable
                        style={s.iconBtn}
                        onPress={() => {
                            void selection();
                            onBackPress();
                        }}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                    </Pressable>
                ) : (
                    <Pressable
                        style={s.iconBtn}
                        onPress={handleMenuPress}
                    >
                        <MaterialCommunityIcons name="menu" size={22} color={colors.text} />
                    </Pressable>
                )}

                <View style={s.titleWrap}>
                    {subtitle ? (
                        <Text style={[s.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    ) : null}
                    <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                </View>
            </View>

            <View style={s.rightRow}>
                <View
                    style={[
                        s.syncPill,
                        {
                            borderColor: withAlpha(syncMeta.color, '24'),
                            backgroundColor: withAlpha(syncMeta.color, colors.isDark ? '18' : '10'),
                        },
                    ]}
                >
                    <View style={[s.syncDot, { backgroundColor: syncMeta.color }]} />
                    <Text style={[s.syncText, { color: syncMeta.color }]} numberOfLines={1}>
                        {syncMeta.label}
                    </Text>
                </View>
                {rightAction ? <View>{rightAction}</View> : null}
                {showSearch ? (
                    <Pressable
                        style={s.iconBtn}
                        onPress={() => {
                            void selection();
                            openGoToPalette();
                        }}
                    >
                        <MaterialCommunityIcons name="magnify" size={20} color={colors.text} />
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
});

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        wrap: {
            minHeight: 72,
            borderRadius: Radius.card,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs,
            marginHorizontal: DESIGN_SPACING.screenX,
            marginTop: Spacing.sm,
            marginBottom: Spacing.sm,
            gap: Spacing.md,
            ...getSurfaceStyle(colors, { floating: true }),
        },
        leftRow: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        iconBtn: {
            ...getPillStyle(colors),
            width: 40,
            height: 40,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceRaised,
        },
        iconPlaceholder: {
            width: 40,
            height: 40,
        },
        titleWrap: {
            flex: 1,
            gap: 2,
        },
        rightRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
        },
        title: {
            fontSize: 20,
            fontWeight: '700',
            letterSpacing: -0.4,
        },
        subtitle: {
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.3,
        },
        syncPill: {
            minHeight: 32,
            maxWidth: 100,
            borderRadius: Radius.pill,
            borderWidth: 1,
            paddingHorizontal: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        syncDot: {
            width: 7,
            height: 7,
            borderRadius: Radius.pill,
        },
        syncText: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
    });
