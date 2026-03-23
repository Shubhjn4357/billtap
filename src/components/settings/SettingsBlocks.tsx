
import { memo, type ReactNode, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, type ScrollViewProps } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTopBar } from '../ui/AppTopBar';
import { DESIGN_SPACING, getIconAccentStyle, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { useHaptics } from '../../hooks/useHaptics';

type SettingsPageShellProps = {
    title: string;
    subtitle: string;
    onBackPress?: () => void;
    children: ReactNode;
    contextChip?: {
        label: string;
        accent?: string;
    };
    scrollProps?: Omit<ScrollViewProps, 'children'>;
};

type SettingsStatusTone = 'neutral' | 'success' | 'warning' | 'info';

type SettingsStatusPillProps = {
    label: string;
    tone?: SettingsStatusTone;
};

type SettingsCategoryCardProps = {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle: string;
    status?: string;
    accent?: string;
    onPress: () => void;
};

type SettingsLinkRowProps = {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle: string;
    value?: string;
    accent?: string;
    onPress: () => void;
};

type SettingsToggleRowProps = {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    accent?: string;
};

type SettingsSectionGroupProps = {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: ReactNode;
};

type SettingsFieldCardProps = {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle: string;
    accent?: string;
    children: ReactNode;
};

const toneColor = (colors: ColorPalette, tone: SettingsStatusTone) => {
    switch (tone) {
        case 'success':
            return colors.success;
        case 'warning':
            return colors.warning;
        case 'info':
            return colors.info;
        case 'neutral':
        default:
            return colors.textSecondary;
    }
};

export const SettingsPageShell = memo(function SettingsPageShell({
    title,
    subtitle,
    onBackPress,
    children,
    contextChip,
    scrollProps,
}: SettingsPageShellProps) {
    const colors = useAppColors();
    const insets = useSafeAreaInsets();
    const s = styles(colors);
    const scrollContentStyle = [
        s.content,
        { paddingBottom: Math.max(120, insets.bottom + 88) },
        scrollProps?.contentContainerStyle,
    ];

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
            <AppTopBar
                title={title}
                subtitle={subtitle}
                onBackPress={onBackPress}
                contextChip={contextChip}
            />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={scrollContentStyle}
                keyboardShouldPersistTaps="handled"
                {...scrollProps}
            >
                {children}
            </ScrollView>
        </SafeAreaView>
    );
});

export const SettingsStatusPill = memo(function SettingsStatusPill({
    label,
    tone = 'neutral',
}: SettingsStatusPillProps) {
    const colors = useAppColors();
    const color = toneColor(colors, tone);
    const s = styles(colors);

    return (
        <View
            style={[
                s.statusPill,
                {
                    borderColor: withAlpha(color, colors.isDark ? '32' : '20'),
                    backgroundColor: withAlpha(color, colors.isDark ? '20' : '10'),
                },
            ]}
        >
            <View style={[s.statusDot, { backgroundColor: color }]} />
            <Text style={[s.statusText, { color }]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
});

export const SettingsCategoryCard = memo(function SettingsCategoryCard({
    icon,
    title,
    subtitle,
    status,
    accent,
    onPress,
}: SettingsCategoryCardProps) {
    const colors = useAppColors();
    const s = styles(colors);
    const { selection } = useHaptics();
    const resolvedAccent = accent ?? colors.primary;

    return (
        <Pressable
            style={({ pressed }) => [
                s.categoryCard,
                getSurfaceStyle(colors, { elevated: true }),
                pressed ? { opacity: 0.9 } : null,
            ]}
            onPress={() => {
                void selection();
                onPress();
            }}
        >
            <View style={[s.categoryIconWrap, getIconAccentStyle(colors, resolvedAccent, { mediumGlow: true })]}>
                <MaterialCommunityIcons name={icon} size={20} color={resolvedAccent} />
            </View>
            <View style={s.categoryCopy}>
                <View style={s.rowTitleLine}>
                    <Text style={s.categoryTitle}>{title}</Text>
                    {status ? <SettingsStatusPill label={status} tone="info" /> : null}
                </View>
                <Text style={s.categorySubtitle}>{subtitle}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
        </Pressable>
    );
});

export const SettingsLinkRow = memo(function SettingsLinkRow({
    icon,
    title,
    subtitle,
    value,
    accent,
    onPress,
}: SettingsLinkRowProps) {
    const colors = useAppColors();
    const s = styles(colors);
    const { selection } = useHaptics();
    const resolvedAccent = accent ?? colors.primary;

    return (
        <Pressable
            style={({ pressed }) => [
                s.rowCard,
                getSurfaceStyle(colors, { elevated: true }),
                pressed ? { opacity: 0.9 } : null,
            ]}
            onPress={() => {
                void selection();
                onPress();
            }}
        >
            <View style={[s.rowIconWrap, getIconAccentStyle(colors, resolvedAccent, { mediumGlow: true })]}>
                <MaterialCommunityIcons name={icon} size={18} color={resolvedAccent} />
            </View>
            <View style={s.rowCopy}>
                <Text style={s.rowTitle}>{title}</Text>
                <Text style={s.rowSubtitle}>{subtitle}</Text>
            </View>
            <View style={s.rowMeta}>
                {value ? <Text style={s.rowValue}>{value}</Text> : null}
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
            </View>
        </Pressable>
    );
});

export const SettingsToggleRow = memo(function SettingsToggleRow({
    icon,
    title,
    subtitle,
    value,
    onValueChange,
    disabled = false,
    accent,
}: SettingsToggleRowProps) {
    const colors = useAppColors();
    const s = styles(colors);
    const { selection } = useHaptics();
    const resolvedAccent = accent ?? colors.primary;

    const handleChange = useCallback((next: boolean) => {
        void selection();
        onValueChange(next);
    }, [onValueChange, selection]);

    return (
        <View style={[s.rowCard, getSurfaceStyle(colors, { elevated: true }), disabled ? { opacity: 0.55 } : null]}>
            <View style={[s.rowIconWrap, getIconAccentStyle(colors, resolvedAccent, { mediumGlow: true })]}>
                <MaterialCommunityIcons name={icon} size={18} color={resolvedAccent} />
            </View>
            <View style={s.rowCopy}>
                <Text style={s.rowTitle}>{title}</Text>
                <Text style={s.rowSubtitle}>{subtitle}</Text>
            </View>
            <Switch
                disabled={disabled}
                value={value}
                onValueChange={handleChange}
                trackColor={{ true: resolvedAccent, false: withAlpha(colors.border, 'D0') }}
                thumbColor={colors.onPrimary}
            />
        </View>
    );
});

export const SettingsSectionGroup = memo(function SettingsSectionGroup({
    title,
    subtitle,
    action,
    children,
}: SettingsSectionGroupProps) {
    const colors = useAppColors();
    const s = styles(colors);

    return (
        <View style={s.groupWrap}>
            <View style={s.groupHeader}>
                <View style={s.groupHeaderCopy}>
                    <Text style={s.groupTitle}>{title}</Text>
                    {subtitle ? <Text style={s.groupSubtitle}>{subtitle}</Text> : null}
                </View>
                {action}
            </View>
            {children}
        </View>
    );
});

export const SettingsFieldCard = memo(function SettingsFieldCard({
    icon,
    title,
    subtitle,
    accent,
    children,
}: SettingsFieldCardProps) {
    const colors = useAppColors();
    const s = styles(colors);
    const resolvedAccent = accent ?? colors.primary;

    return (
        <View style={[s.fieldCard, getSurfaceStyle(colors, { elevated: true })]}>
            <View style={s.fieldHeader}>
                <View style={[s.rowIconWrap, getIconAccentStyle(colors, resolvedAccent, { mediumGlow: true })]}>
                    <MaterialCommunityIcons name={icon} size={18} color={resolvedAccent} />
                </View>
                <View style={s.fieldCopy}>
                    <Text style={s.rowTitle}>{title}</Text>
                    <Text style={s.rowSubtitle}>{subtitle}</Text>
                </View>
            </View>
            <View style={s.fieldBody}>{children}</View>
        </View>
    );
});

export const SettingsHeroCard = memo(function SettingsHeroCard({
    title,
    subtitle,
    primaryLabel,
    secondaryLabel,
}: {
    title: string;
    subtitle: string;
    primaryLabel?: string;
    secondaryLabel?: string;
}) {
    const colors = useAppColors();
    const s = styles(colors);

    return (
        <View style={[s.heroCard, getSurfaceStyle(colors, { accent: colors.primary, elevated: true })]}>
            <View style={s.heroHeader}>
                <View style={[s.heroOrb, getIconAccentStyle(colors, colors.primary, { mediumGlow: true })]}>
                    <MaterialCommunityIcons name="cog-outline" size={22} color={colors.primary} />
                </View>
                <View style={s.heroCopy}>
                    <Text style={s.heroTitle}>{title}</Text>
                    <Text style={s.heroSubtitle}>{subtitle}</Text>
                </View>
            </View>
            <View style={s.heroMetaRow}>
                {primaryLabel ? <SettingsStatusPill label={primaryLabel} tone="success" /> : null}
                {secondaryLabel ? <SettingsStatusPill label={secondaryLabel} tone="info" /> : null}
            </View>
        </View>
    );
});

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.background,
        },
        content: {
            paddingHorizontal: DESIGN_SPACING.screenX,
            paddingBottom: 120,
            gap: DESIGN_SPACING.sectionGap,
        },
        heroCard: {
            padding: DESIGN_SPACING.sectionGap,
            gap: Spacing.md,
        },
        heroHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
        },
        heroOrb: {
            width: 52,
            height: 52,
            borderRadius: Radius.card,
            alignItems: 'center',
            justifyContent: 'center',
        },
        heroCopy: {
            flex: 1,
            gap: 4,
        },
        heroTitle: {
            color: colors.text,
            fontSize: 20,
            fontWeight: '700',
            letterSpacing: -0.3,
        },
        heroSubtitle: {
            color: colors.textSecondary,
            fontSize: Typography.body.size,
            lineHeight: 20,
            fontWeight: '500',
        },
        heroMetaRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.xs,
        },
        statusPill: {
            minHeight: 30,
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        statusDot: {
            width: 7,
            height: 7,
            borderRadius: Radius.pill,
        },
        statusText: {
            fontSize: Typography.caption.size,
            fontWeight: '800',
        },
        groupWrap: {
            gap: Spacing.sm,
        },
        groupHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: Spacing.sm,
            paddingHorizontal: 2,
        },
        groupHeaderCopy: {
            flex: 1,
            gap: 4,
        },
        groupTitle: {
            color: colors.text,
            fontSize: 18,
            fontWeight: '700',
            letterSpacing: -0.2,
        },
        groupSubtitle: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
        },
        categoryCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
            paddingHorizontal: DESIGN_SPACING.sectionGap,
            paddingVertical: DESIGN_SPACING.sectionGap,
        },
        categoryIconWrap: {
            width: 46,
            height: 46,
            borderRadius: Radius.card,
            alignItems: 'center',
            justifyContent: 'center',
        },
        categoryCopy: {
            flex: 1,
            gap: 4,
        },
        categoryTitle: {
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '800',
        },
        categorySubtitle: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
        },
        rowTitleLine: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Spacing.sm,
        },
        rowCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
            paddingHorizontal: DESIGN_SPACING.sectionGap,
            paddingVertical: DESIGN_SPACING.cardGap,
        },
        rowIconWrap: {
            width: 40,
            height: 40,
            borderRadius: Radius.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        rowCopy: {
            flex: 1,
            gap: 3,
        },
        rowTitle: {
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '700',
        },
        rowSubtitle: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
        },
        rowMeta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
            maxWidth: 108,
        },
        rowValue: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            fontWeight: '700',
            textAlign: 'right',
            flexShrink: 1,
        },
        fieldCard: {
            paddingHorizontal: DESIGN_SPACING.sectionGap,
            paddingVertical: DESIGN_SPACING.cardGap,
            gap: Spacing.sm,
        },
        fieldHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: Spacing.md,
        },
        fieldCopy: {
            flex: 1,
            gap: 3,
            paddingTop: 2,
        },
        fieldBody: {
            gap: Spacing.sm,
        },
    });
