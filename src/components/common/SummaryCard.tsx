import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';

interface SummaryCardProps {
    label: string;
    value: string;
    icon?: string;
    /** Use 'positive', 'negative', 'neutral', or 'warning' to tint the value */
    tone?: 'positive' | 'negative' | 'neutral' | 'warning';
    style?: StyleProp<ViewStyle>;
}

/**
 * SummaryCard — compact stat display card.
 * Used in Dashboard, Reports, and Accounting screens.
 * All colors from theme.colors.
 */
export const SummaryCard: React.FC<SummaryCardProps> = ({
    label,
    value,
    icon,
    tone = 'neutral',
    style,
}) => {
    const theme = useTheme();

    const toneColor = (() => {
        switch (tone) {
            case 'positive': return theme.colors.secondary;
            case 'negative': return theme.colors.error;
            case 'warning': return theme.colors.tertiary;
            default: return theme.colors.primary;
        }
    })();

    const toneBg = (() => {
        switch (tone) {
            case 'positive': return theme.colors.secondaryContainer;
            case 'negative': return theme.colors.errorContainer;
            case 'warning': return theme.colors.tertiaryContainer;
            default: return theme.colors.primaryContainer;
        }
    })();

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                    ...DesignSystem.shadow.card,
                },
                style,
            ]}
        >
            {icon ? (
                <View style={[styles.iconContainer, { backgroundColor: toneBg }]}>
                    <Text style={{ fontSize: 20 }}>{icon}</Text>
                </View>
            ) : null}
            <Text
                variant="bodySmall"
                numberOfLines={1}
                style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
            >
                {label}
            </Text>
            <Text
                variant="titleMedium"
                numberOfLines={1}
                style={[styles.value, { color: toneColor }]}
            >
                {value}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        flex: 1,
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
        padding: DesignSystem.spacing.md,
        gap: DesignSystem.spacing.xs,
        minWidth: 100,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: DesignSystem.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: DesignSystem.spacing.xs,
    },
    label: {
        fontWeight: '500',
    },
    value: {
        fontWeight: '700',
    },
});
