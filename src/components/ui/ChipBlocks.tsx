import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getPillStyle, getShadowStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';

type ChipTone = 'default' | 'info' | 'success' | 'warning' | 'danger';
type ChipVariant = 'filter' | 'action';

const toneColor = (tone: ChipTone, colors: ReturnType<typeof useAppColors>) => {
    if (tone === 'info') return colors.info;
    if (tone === 'success') return colors.success;
    if (tone === 'warning') return colors.warning;
    if (tone === 'danger') return colors.error;
    return colors.primary;
};

export function ChipButton({
    label,
    selected = false,
    icon,
    onPress,
    tone = 'default',
    variant = 'filter',
    disabled = false,
}: {
    label: string;
    selected?: boolean;
    icon?: keyof typeof MaterialCommunityIcons.glyphMap;
    onPress: () => void;
    tone?: ChipTone;
    variant?: ChipVariant;
    disabled?: boolean;
}) {
    const colors = useAppColors();
    const accent = toneColor(tone, colors);
    const backgroundColor = selected
        ? withAlpha(accent, colors.isDark ? '2A' : '14')
        : variant === 'action'
            ? colors.card
            : colors.surfaceRaised;
    const borderColor = selected
        ? accent
        : variant === 'action'
            ? withAlpha(accent, '18')
            : withAlpha(colors.border, 'C4');
    const textColor = selected ? accent : tone === 'default' ? colors.textSecondary : accent;

    return (
        <Pressable
            style={[
                styles.wrap,
                variant === 'action' ? styles.actionWrap : styles.filterWrap,
                variant === 'action' ? getShadowStyle(colors, 'soft') : null,
                {
                    ...getPillStyle(colors, selected ? accent : undefined),
                    backgroundColor,
                    borderColor,
                },
                disabled ? styles.disabled : null,
            ]}
            onPress={onPress}
            disabled={disabled}
        >
            {icon ? (
                <View
                    style={[
                        styles.iconWrap,
                        {
                            backgroundColor: selected ? withAlpha(accent, colors.isDark ? '24' : '12') : withAlpha(accent, '12'),
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={icon}
                        size={13}
                        color={accent}
                    />
                </View>
            ) : null}
            <Text
                style={[
                    styles.label,
                    {
                        color: textColor,
                        fontWeight: selected ? '700' : '600',
                    },
                ]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrap: {
        minHeight: 34,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    filterWrap: {
        paddingVertical: 6,
    },
    actionWrap: {
        paddingVertical: 7,
    },
    iconWrap: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: Typography.caption.size,
    },
    disabled: {
        opacity: 0.55,
    },
});
