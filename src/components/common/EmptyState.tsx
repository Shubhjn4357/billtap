import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';

interface EmptyStateProps {
    emoji?: string;
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * EmptyState — unified empty / zero-data display.
 * All colors from theme.colors.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    emoji = '📭',
    title,
    subtitle,
    action,
    style,
}) => {
    const theme = useTheme();
    return (
        <View style={[styles.container, style]}>
            <Text style={styles.emoji}>{emoji}</Text>
            <Text
                variant="titleMedium"
                style={[styles.title, { color: theme.colors.onSurface }]}
            >
                {title}
            </Text>
            {subtitle ? (
                <Text
                    variant="bodySmall"
                    style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                >
                    {subtitle}
                </Text>
            ) : null}
            {action ? <View style={styles.actionContainer}>{action}</View> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: DesignSystem.spacing.xxl,
        gap: DesignSystem.spacing.sm,
    },
    emoji: {
        fontSize: 48,
        marginBottom: DesignSystem.spacing.md,
    },
    title: {
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        opacity: 0.75,
    },
    actionContainer: {
        marginTop: DesignSystem.spacing.lg,
    },
});
