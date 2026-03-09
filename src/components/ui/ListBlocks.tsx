import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';

export function EmptyStateCard({
    icon,
    title,
    subtitle,
    actionLabel,
    onActionPress,
    tone = 'default',
    footer,
}: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onActionPress?: () => void;
    tone?: 'default' | 'info' | 'success' | 'warning' | 'danger';
    footer?: ReactNode;
}) {
    const colors = useAppColors();
    const accent =
        tone === 'info' ? colors.info :
            tone === 'success' ? colors.success :
                tone === 'warning' ? colors.warning :
                    tone === 'danger' ? colors.error :
                        colors.primary;

    return (
        <View
            style={[
                styles.wrap,
                {
                    backgroundColor: colors.card,
                    borderColor: withAlpha(accent, '20'),
                },
            ]}
        >
            <View style={[styles.iconWrap, { backgroundColor: withAlpha(accent, '12') }]}>
                <MaterialCommunityIcons name={icon} size={26} color={accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
            {actionLabel && onActionPress ? (
                <Pressable
                    style={[styles.action, { backgroundColor: accent }]}
                    onPress={onActionPress}
                >
                    <Text style={[styles.actionText, { color: colors.onPrimary }]}>{actionLabel}</Text>
                </Pressable>
            ) : null}
            {footer}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 24,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xl,
        gap: Spacing.sm,
        marginHorizontal: Spacing.lg,
        marginTop: 56,
        shadowColor: '#000000',
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: Typography.title.size,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: Typography.body.size,
        lineHeight: 20,
        textAlign: 'center',
    },
    action: {
        marginTop: Spacing.xs,
        minHeight: 44,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    actionText: {
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
});
