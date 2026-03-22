import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getInsetPanelStyle, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';

type UtilityTone = 'default' | 'info' | 'success' | 'warning' | 'danger';
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const toneColor = (tone: UtilityTone, colors: ReturnType<typeof useAppColors>) => {
    if (tone === 'info') return colors.info;
    if (tone === 'success') return colors.success;
    if (tone === 'warning') return colors.warning;
    if (tone === 'danger') return colors.error;
    return colors.primary;
};

export function UtilitySection({
    title,
    count,
    children,
}: {
    title: string;
    count?: number | null;
    children: ReactNode;
}) {
    const colors = useAppColors();
    return (
        <View style={styles.section}>
            <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
                {typeof count === 'number' ? (
                    <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>{count}</Text>
                ) : null}
            </View>
            {children}
        </View>
    );
}

export function UtilityHero({
    title,
    subtitle,
    icon = 'star-four-points-outline',
    tone = 'info',
    right,
    footer,
}: {
    title: string;
    subtitle: string;
    icon?: IconName;
    tone?: UtilityTone;
    right?: ReactNode;
    footer?: ReactNode;
}) {
    const colors = useAppColors();
    const accent = toneColor(tone, colors);
    return (
        <View
            style={[
                styles.hero,
                {
                    ...getSurfaceStyle(colors, { accent, elevated: true }),
                    ...getInsetPanelStyle(colors, accent),
                },
            ]}
        >
            <View style={styles.heroTop}>
                <View style={[styles.heroIconWrap, { backgroundColor: withAlpha(accent, '18') }]}>
                    <MaterialCommunityIcons name={icon} size={18} color={accent} />
                </View>
                <View style={styles.heroTextWrap}>
                    <Text style={[styles.heroTitle, { color: colors.text }]}>{title}</Text>
                    <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
                </View>
                {right}
            </View>
            {footer ? <View style={styles.heroFooter}>{footer}</View> : null}
        </View>
    );
}

export function UtilityPanel({
    children,
    tone = 'default',
}: {
    children: ReactNode;
    tone?: UtilityTone;
}) {
    const colors = useAppColors();
    const accent = toneColor(tone, colors);
    return (
        <View
            style={[
                styles.panel,
                {
                    ...getSurfaceStyle(colors, {
                        accent: tone === 'default' ? undefined : accent,
                        elevated: true,
                        muted: tone !== 'default',
                    }),
                },
            ]}
        >
            {children}
        </View>
    );
}

export function UtilityRow({
    label,
    description,
    icon,
    onPress,
    right,
    accent = 'default',
}: {
    label: string;
    description?: string | null;
    icon?: IconName;
    onPress?: () => void;
    right?: ReactNode;
    accent?: UtilityTone;
}) {
    const colors = useAppColors();
    const accentColor = toneColor(accent, colors);
    const content = (
        <>
            {icon ? (
                <View style={[styles.rowIconWrap, { backgroundColor: withAlpha(accentColor, '14') }]}>
                    <MaterialCommunityIcons name={icon} size={16} color={accentColor} />
                </View>
            ) : null}
            <View style={styles.rowTextWrap}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
                {description ? (
                    <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>{description}</Text>
                ) : null}
            </View>
            {right ?? <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />}
        </>
    );

    if (!onPress) {
        return <View style={styles.row}>{content}</View>;
    }

    return (
        <Pressable
            style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.backgroundSelected },
            ]}
            onPress={onPress}
        >
            {content}
        </Pressable>
    );
}

export function UtilityBanner({
    icon = 'information-outline',
    message,
    tone = 'info',
}: {
    icon?: IconName;
    message: string;
    tone?: UtilityTone;
}) {
    const colors = useAppColors();
    const accent = toneColor(tone, colors);
    return (
        <View
            style={[
                styles.banner,
                {
                    ...getSurfaceStyle(colors, {
                        accent,
                        elevated: true,
                        muted: true,
                    }),
                },
            ]}
        >
            <MaterialCommunityIcons name={icon} size={16} color={accent} />
            <Text style={[styles.bannerText, { color: colors.textSecondary }]}>{message}</Text>
        </View>
    );
}

export function UtilityEmptyState({
    icon,
    title,
    description,
}: {
    icon: IconName;
    title: string;
    description: string;
}) {
    const colors = useAppColors();
    return (
        <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name={icon} size={28} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>{description}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.sm },
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: Typography.caption.size,
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    sectionCount: {
        fontSize: Typography.caption.size,
        fontWeight: '700',
    },
    hero: {
        borderRadius: Radius.card,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
    },
    heroIconWrap: {
        width: 42,
        height: 42,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroTextWrap: {
        flex: 1,
        gap: 2,
    },
    heroTitle: {
        fontSize: Typography.headline.size,
        fontWeight: '700',
    },
    heroSubtitle: {
        fontSize: Typography.body.size,
        lineHeight: 22,
    },
    heroFooter: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    panel: {
        borderRadius: Radius.card,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 14,
        backgroundColor: 'transparent',
    },
    rowIconWrap: {
        width: 32,
        height: 32,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowTextWrap: { flex: 1 },
    rowLabel: {
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    rowDescription: {
        fontSize: Typography.caption.size,
        marginTop: 2,
    },
    banner: {
        borderRadius: Radius.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    bannerText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '500',
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.xxl,
        gap: Spacing.sm,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    emptyDescription: {
        fontSize: Typography.body.size,
        textAlign: 'center',
    },
});
