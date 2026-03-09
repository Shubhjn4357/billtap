import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { useHaptics } from '../../hooks/useHaptics';
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
                    <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                    {subtitle ? (
                        <Text style={[s.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
            </View>

            <View style={s.rightRow}>
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
            minHeight: 60,
            borderRadius: Radius.card,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.sm,
            marginHorizontal: DESIGN_SPACING.screenX,
            marginTop: Spacing.sm,
            marginBottom: Spacing.sm,
            gap: Spacing.sm,
            ...getSurfaceStyle(colors, { floating: true, elevated: true }),
        },
        leftRow: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
        },
        iconBtn: {
            ...getPillStyle(colors, colors.primary),
            width: 38,
            height: 38,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: withAlpha(colors.primary, colors.isDark ? '12' : '0A'),
        },
        iconPlaceholder: {
            width: 36,
            height: 36,
        },
        titleWrap: {
            flex: 1,
        },
        rightRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
        },
        title: {
            fontSize: Typography.title.size,
            fontWeight: '700',
            letterSpacing: -0.2,
        },
        subtitle: {
            marginTop: 1,
            fontSize: Typography.caption.size,
            fontWeight: '500',
        },
    });
