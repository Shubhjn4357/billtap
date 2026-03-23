import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { DESIGN_SPACING, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';

export const FormSkeleton = memo(function FormSkeleton() {
    const colors = useAppColors();
    const s = styles(colors);

    return (
        <View style={s.wrap}>
            <View style={[s.hero, getSurfaceStyle(colors, { elevated: true })]}>
                <View style={s.icon} />
                <View style={s.heroTitle} />
                <View style={s.heroSubtitle} />
            </View>

            <View style={[s.section, getSurfaceStyle(colors, { elevated: true })]}>
                <View style={s.sectionHeader} />
                <View style={s.fieldLabel} />
                <View style={s.fieldInput} />
                <View style={s.fieldLabel} />
                <View style={s.fieldInput} />
            </View>
        </View>
    );
});

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        wrap: {
            paddingHorizontal: DESIGN_SPACING.screenX,
            gap: Spacing.md,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.xl,
        },
        hero: {
            borderRadius: Radius.card,
            padding: Spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
        },
        icon: {
            width: 48,
            height: 48,
            borderRadius: Radius.card,
            backgroundColor: withAlpha(colors.text, '0A'),
            marginBottom: Spacing.xs,
        },
        heroTitle: {
            width: '40%',
            height: 14,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.text, '14'),
        },
        heroSubtitle: {
            width: '70%',
            height: 10,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.text, '0F'),
        },
        section: {
            borderRadius: Radius.card,
            padding: Spacing.lg,
            gap: Spacing.md,
        },
        sectionHeader: {
            width: '30%',
            height: 12,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.text, '14'),
            marginBottom: Spacing.xs,
        },
        fieldLabel: {
            width: '20%',
            height: 10,
            borderRadius: Radius.pill,
            backgroundColor: withAlpha(colors.text, '0F'),
        },
        fieldInput: {
            width: '100%',
            height: 48,
            borderRadius: Radius.md,
            backgroundColor: withAlpha(colors.text, '05'),
        },
    });
