import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Radius, Spacing, Typography, withAlpha } from '../../constants/theme';
import { getInsetPanelStyle, getShadowStyle } from '../../constants/designSystem';
import { useAppColors } from '../../hooks/useAppColors';
import { useHaptics } from '../../hooks/useHaptics';

type SwipeTone = 'default' | 'info' | 'success' | 'warning' | 'danger';

export type SwipeAction = {
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    onPress: () => void;
    tone?: SwipeTone;
};

export function SwipeableRow({
    children,
    enabled = true,
    leftActions = [],
    rightActions = [],
}: {
    children: ReactNode;
    enabled?: boolean;
    leftActions?: SwipeAction[];
    rightActions?: SwipeAction[];
}) {
    const colors = useAppColors();
    const { selection } = useHaptics();
    const swipeableRef = useRef<Swipeable | null>(null);

    const resolveAccent = (tone: SwipeTone) => {
        if (tone === 'success') return colors.success;
        if (tone === 'warning') return colors.warning;
        if (tone === 'danger') return colors.error;
        if (tone === 'info') return colors.info;
        return colors.primary;
    };

    const renderActionRail = (actions: SwipeAction[], side: 'left' | 'right') => (
        <View
            style={[
                styles.rail,
                side === 'left' ? styles.leftRail : styles.rightRail,
            ]}
        >
            {actions.map((action) => {
                const accent = resolveAccent(action.tone ?? 'default');
                return (
                    <Pressable
                        key={`${side}-${action.label}`}
                        style={[
                            styles.action,
                            getInsetPanelStyle(colors, accent),
                            getShadowStyle(colors, 'soft'),
                            { backgroundColor: withAlpha(accent, colors.isDark ? '18' : '12') },
                        ]}
                        onPress={() => {
                            swipeableRef.current?.close();
                            void selection();
                            action.onPress();
                        }}
                    >
                        <MaterialCommunityIcons name={action.icon} size={18} color={accent} />
                        <Text style={[styles.label, { color: accent }]}>{action.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );

    if (!enabled || (!leftActions.length && !rightActions.length)) {
        return <>{children}</>;
    }

    return (
        <Swipeable
            ref={(instance) => {
                swipeableRef.current = instance;
            }}
            friction={2}
            overshootLeft={false}
            overshootRight={false}
            leftThreshold={32}
            rightThreshold={32}
            renderLeftActions={leftActions.length ? () => renderActionRail(leftActions, 'left') : undefined}
            renderRightActions={rightActions.length ? () => renderActionRail(rightActions, 'right') : undefined}
        >
            {children}
        </Swipeable>
    );
}

const styles = StyleSheet.create({
    rail: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: Spacing.xs,
        paddingVertical: 4,
    },
    leftRail: {
        paddingLeft: Spacing.lg,
        paddingRight: Spacing.xs,
    },
    rightRail: {
        paddingLeft: Spacing.xs,
        paddingRight: Spacing.lg,
    },
    action: {
        minWidth: 86,
        borderRadius: Radius.card,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        gap: 4,
    },
    label: {
        fontSize: Typography.caption.size,
        fontWeight: '700',
    },
});
