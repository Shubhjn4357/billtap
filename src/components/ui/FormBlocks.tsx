import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { UtilityTone } from '../../constants/utilityNavigation';
import { getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { UtilityHero } from './UtilityBlocks';

const toneColor = (tone: UtilityTone, colors: ReturnType<typeof useAppColors>) => {
    if (tone === 'info') return colors.info;
    if (tone === 'success') return colors.success;
    if (tone === 'warning') return colors.warning;
    if (tone === 'danger') return colors.error;
    return colors.primary;
};

export function FormHero({
    title,
    subtitle,
    icon,
    tone = 'info',
}: {
    title: string;
    subtitle: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    tone?: UtilityTone;
}) {
    return <UtilityHero title={title} subtitle={subtitle} icon={icon} tone={tone} />;
}

export function FormSectionCard({
    title,
    description,
    tone = 'default',
    children,
}: {
    title: string;
    description?: string;
    tone?: UtilityTone;
    children: ReactNode;
}) {
    const colors = useAppColors();
    const accent = toneColor(tone, colors);

    return (
        <View
            style={[
                styles.sectionCard,
                {
                    ...getSurfaceStyle(colors, {
                        accent: tone === 'default' ? undefined : accent,
                        elevated: true,
                        muted: tone !== 'default',
                    }),
                    backgroundColor: tone === 'default' ? colors.card : withAlpha(accent, '0c'),
                },
            ]}
        >
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                {description ? (
                    <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
                ) : null}
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    sectionCard: {
        borderRadius: Radius.card,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    header: {
        gap: 2,
    },
    title: {
        fontSize: Typography.title.size,
        fontWeight: '700',
    },
    description: {
        fontSize: Typography.caption.size,
        lineHeight: Typography.caption.lineHeight,
    },
});
