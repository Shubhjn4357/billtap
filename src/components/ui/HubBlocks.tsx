import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getInsetPanelStyle, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import type { UtilityTone } from '../../constants/utilityNavigation';

type HubIconName = keyof typeof MaterialCommunityIcons.glyphMap;

const toneColor = (tone: UtilityTone, colors: ReturnType<typeof useAppColors>) => {
    if (tone === 'info') return colors.info;
    if (tone === 'success') return colors.success;
    if (tone === 'warning') return colors.warning;
    if (tone === 'danger') return colors.error;
    return colors.primary;
};

export function HubMetricCard({
    label,
    value,
    meta,
    tone = 'default',
}: {
    label: string;
    value: string;
    meta?: string;
    tone?: UtilityTone;
}) {
    const colors = useAppColors();
    const accent = toneColor(tone, colors);

    return (
        <View
            style={[
                styles.metricCard,
                {
                    ...getSurfaceStyle(colors, { accent, elevated: true }),
                    ...getInsetPanelStyle(colors, accent),
                },
            ]}
        >
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
            {meta ? <Text style={[styles.metricMeta, { color: colors.textSecondary }]}>{meta}</Text> : null}
        </View>
    );
}

export function HubActionCard({
    title,
    subtitle,
    icon,
    tone = 'default',
    onPress,
}: {
    title: string;
    subtitle: string;
    icon: HubIconName;
    tone?: UtilityTone;
    onPress: (event: GestureResponderEvent) => void;
}) {
    const colors = useAppColors();
    const accent = toneColor(tone, colors);

    return (
        <Pressable
            style={({ pressed }) => [
                styles.actionCard,
                {
                    ...getSurfaceStyle(colors, { accent, elevated: true }),
                    opacity: pressed ? 0.85 : 1,
                },
            ]}
            onPress={onPress}
        >
            <View style={[styles.actionIconWrap, { backgroundColor: withAlpha(accent, '16') }]}>
                <MaterialCommunityIcons name={icon} size={18} color={accent} />
            </View>
            <View style={styles.actionBody}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textSecondary} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    metricCard: {
        flex: 1,
        minWidth: '30%',
        borderRadius: Radius.card,
        borderWidth: 1,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        gap: 2,
    },
    metricLabel: {
        fontSize: Typography.caption.size,
        fontWeight: '700',
    },
    metricValue: {
        fontSize: Typography.title.size,
        fontWeight: '800',
    },
    metricMeta: {
        fontSize: 11,
        fontWeight: '500',
    },
    actionCard: {
        minWidth: '47%',
        flex: 1,
        borderWidth: 1,
        borderRadius: Radius.card,
        padding: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    actionIconWrap: {
        width: 36,
        height: 36,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBody: {
        flex: 1,
        gap: 2,
    },
    actionTitle: {
        fontSize: 13,
        fontWeight: '700',
    },
    actionSubtitle: {
        fontSize: 11,
    },
});
