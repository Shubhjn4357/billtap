import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text, useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';

type StatusType = 'paid' | 'pending' | 'overdue' | 'partial' | 'active' | 'inactive' | 'expired' | 'draft';

interface StatusBadgeProps {
    status: StatusType;
    /** Override label text */
    label?: string;
    compact?: boolean;
}

const STATUS_CONFIG: Record<StatusType, { label: string; emoji: string }> = {
    paid: { label: 'Paid', emoji: '✅' },
    pending: { label: 'Pending', emoji: '🕐' },
    overdue: { label: 'Overdue', emoji: '⚠️' },
    partial: { label: 'Partial', emoji: '⬛' },
    active: { label: 'Active', emoji: '🟢' },
    inactive: { label: 'Inactive', emoji: '⚫' },
    expired: { label: 'Expired', emoji: '🔴' },
    draft: { label: 'Draft', emoji: '📝' },
};

/**
 * StatusBadge — pill-style status indicator.
 * All colors from theme.colors — no hardcoded hex.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, compact = false }) => {
    const theme = useTheme();
    const config = STATUS_CONFIG[status];
    const displayLabel = label ?? config.label;

    const bgColor = (() => {
        switch (status) {
            case 'paid':
            case 'active': return theme.colors.secondaryContainer;
            case 'overdue':
            case 'expired': return theme.colors.errorContainer;
            case 'pending':
            case 'draft': return theme.colors.surfaceVariant;
            case 'partial': return theme.colors.tertiaryContainer;
            case 'inactive': return theme.colors.surfaceVariant;
        }
    })();

    const textColor = (() => {
        switch (status) {
            case 'paid':
            case 'active': return theme.colors.onSecondaryContainer;
            case 'overdue':
            case 'expired': return theme.colors.onErrorContainer;
            case 'pending':
            case 'draft': return theme.colors.onSurfaceVariant;
            case 'partial': return theme.colors.onTertiaryContainer;
            case 'inactive': return theme.colors.onSurfaceVariant;
        }
    })();

    if (compact) {
        return (
            <View
                style={[
                    styles.compactBadge,
                    { backgroundColor: bgColor },
                ]}
            >
                <Text style={[styles.compactText, { color: textColor }]}>{displayLabel}</Text>
            </View>
        );
    }

    return (
        <Chip
            compact
            style={[styles.chip, { backgroundColor: bgColor }]}
            textStyle={{ color: textColor, fontSize: 11, fontWeight: '600' }}
        >
            {`${config.emoji} ${displayLabel}`}
        </Chip>
    );
};

const styles = StyleSheet.create({
    chip: {
        alignSelf: 'flex-start',
        borderRadius: DesignSystem.radius.pill,
        height: 26,
    },
    compactBadge: {
        borderRadius: DesignSystem.radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: 'flex-start',
    },
    compactText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
});
