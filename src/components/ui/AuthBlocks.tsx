import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';

type AuthHeroProps = {
    eyebrow: string;
    title: string;
    subtitle: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    children?: ReactNode;
};

type AuthPanelProps = {
    title: string;
    description?: string;
    children: ReactNode;
};

export function AuthHero({ eyebrow, title, subtitle, icon, children }: AuthHeroProps) {
    const colors = useAppColors();

    return (
        <View
            style={[
                styles.hero,
                {
                    backgroundColor: colors.card,
                    borderColor: withAlpha(colors.primary, '18'),
                },
            ]}
        >
            <View style={styles.heroHeader}>
                <View style={[styles.heroIconWrap, { backgroundColor: withAlpha(colors.primary, '12') }]}>
                    <MaterialCommunityIcons name={icon} size={28} color={colors.primary} />
                </View>
                <View style={styles.heroCopy}>
                    <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
                </View>
            </View>
            {children ? <View style={styles.heroBody}>{children}</View> : null}
        </View>
    );
}

export function AuthPanel({ title, description, children }: AuthPanelProps) {
    const colors = useAppColors();

    return (
        <View
            style={[
                styles.panel,
                {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                },
            ]}
        >
            <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, { color: colors.text }]}>{title}</Text>
                {description ? (
                    <Text style={[styles.panelDescription, { color: colors.textSecondary }]}>{description}</Text>
                ) : null}
            </View>
            {children}
        </View>
    );
}

export function AuthChip({ icon, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }) {
    const colors = useAppColors();

    return (
        <View
            style={[
                styles.chip,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: withAlpha(colors.primary, '16'),
                },
            ]}
        >
            <MaterialCommunityIcons name={icon} size={14} color={colors.primary} />
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    hero: {
        borderWidth: 1,
        borderRadius: 28,
        padding: Spacing.lg,
        gap: Spacing.md,
        shadowColor: '#000000',
        shadowOpacity: 0.06,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
    },
    heroHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
    },
    heroIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCopy: {
        flex: 1,
        gap: 2,
    },
    eyebrow: {
        fontSize: Typography.caption.size,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.8,
    },
    subtitle: {
        fontSize: Typography.body.size,
        lineHeight: 22,
    },
    heroBody: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    panel: {
        borderWidth: 1,
        borderRadius: Radius.card,
        padding: Spacing.md,
        gap: Spacing.sm,
        shadowColor: '#000000',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    panelHeader: {
        gap: 2,
    },
    panelTitle: {
        fontSize: Typography.title.size,
        fontWeight: '700',
    },
    panelDescription: {
        fontSize: Typography.caption.size,
        lineHeight: 18,
    },
    chip: {
        minHeight: 32,
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    chipText: {
        fontSize: Typography.caption.size,
        fontWeight: '600',
    },
});
