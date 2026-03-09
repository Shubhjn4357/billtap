import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { getInsetPanelStyle, getShadowStyle, getSurfaceStyle } from '../../constants/designSystem';
import { useI18n } from '../../hooks/useI18n';

export function AppBiometricLockOverlay({
    busy,
    supported,
    onUnlock,
}: {
    busy: boolean;
    supported: boolean;
    onUnlock: () => void;
}) {
    const colors = useAppColors();
    const { t } = useI18n();
    const s = styles(colors);

    return (
        <View style={s.root}>
            <View style={s.backdrop} />
            <View style={s.card}>
                <View style={s.badge}>
                    <MaterialCommunityIcons
                        name={supported ? 'fingerprint' : 'shield-lock-outline'}
                        size={28}
                        color={colors.primary}
                    />
                </View>
                <Text style={s.title}>{t('lock.title')}</Text>
                <Text style={s.subtitle}>
                    {supported ? t('lock.subtitle') : t('lock.unavailable')}
                </Text>
                <Pressable
                    style={({ pressed }) => [
                        s.button,
                        { opacity: busy || pressed ? 0.88 : 1 },
                    ]}
                    onPress={onUnlock}
                    disabled={busy}
                >
                    {busy ? (
                        <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="lock-open-outline" size={18} color={colors.onPrimary} />
                            <Text style={s.buttonText}>{supported ? t('lock.unlock') : t('lock.retry')}</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        root: {
            ...StyleSheet.absoluteFillObject,
            alignItems: 'center',
            justifyContent: 'center',
            padding: Spacing.xl,
            zIndex: 999,
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: withAlpha(colors.backdrop, colors.isDark ? 'E8' : 'CC'),
        },
        card: {
            width: '100%',
            maxWidth: 360,
            padding: Spacing.xl,
            alignItems: 'center',
            gap: Spacing.sm,
            ...getSurfaceStyle(colors, { floating: true, elevated: true }),
        },
        badge: {
            width: 72,
            height: 72,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            ...getInsetPanelStyle(colors, colors.primary),
            ...getShadowStyle(colors, 'raised'),
        },
        title: {
            marginTop: Spacing.xs,
            fontSize: Typography.headline.size,
            fontWeight: '800',
            color: colors.text,
        },
        subtitle: {
            fontSize: Typography.body.size,
            lineHeight: Typography.body.lineHeight,
            color: colors.textSecondary,
            textAlign: 'center',
        },
        button: {
            marginTop: Spacing.sm,
            minHeight: 48,
            minWidth: 160,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            backgroundColor: colors.primary,
        },
        buttonText: {
            color: colors.onPrimary,
            fontSize: Typography.body.size,
            fontWeight: '700',
        },
    });
