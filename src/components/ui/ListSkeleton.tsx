import { memo } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { getColors, Radius, Spacing, withAlpha } from '../../constants/theme';

type ListSkeletonProps = {
    rows?: number;
    compact?: boolean;
};

export const ListSkeleton = memo(function ListSkeleton({ rows = 5, compact = false }: ListSkeletonProps) {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors, compact);

    return (
        <View style={s.wrap}>
            {Array.from({ length: rows }).map((_, index) => (
                <View key={`skeleton-${index}`} style={s.row}>
                    <View style={s.avatar} />
                    <View style={s.body}>
                        <View style={s.linePrimary} />
                        <View style={s.lineSecondary} />
                        {!compact ? <View style={s.lineTertiary} /> : null}
                    </View>
                    <View style={s.trailing} />
                </View>
            ))}
        </View>
    );
});

const styles = (colors: ReturnType<typeof getColors>, compact: boolean) =>
    StyleSheet.create({
        wrap: {
            paddingHorizontal: Spacing.lg,
            gap: Spacing.sm,
            paddingBottom: Spacing.xl,
        },
        row: {
            borderRadius: Radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: compact ? Spacing.sm : Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        avatar: {
            width: compact ? 28 : 34,
            height: compact ? 28 : 34,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.text, '14'),
        },
        body: {
            flex: 1,
            gap: 6,
        },
        linePrimary: {
            width: '65%',
            height: compact ? 8 : 10,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.text, '14'),
        },
        lineSecondary: {
            width: '50%',
            height: compact ? 7 : 8,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.text, '0F'),
        },
        lineTertiary: {
            width: '35%',
            height: 7,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.text, '0C'),
        },
        trailing: {
            width: compact ? 48 : 62,
            height: compact ? 20 : 26,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.text, '10'),
        },
    });
