import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DESIGN_SPACING, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';

export type AppDialogAction = {
    label: string;
    onPress?: () => void;
    variant?: 'default' | 'cancel' | 'destructive';
    disabled?: boolean;
};

type AppDialogProps = {
    visible: boolean;
    title: string;
    message?: string;
    actions?: AppDialogAction[];
    onClose: () => void;
};

export function AppDialog({
    visible,
    title,
    message,
    actions = [{ label: 'OK' }],
    onClose,
}: AppDialogProps) {
    const colors = useAppColors();
    const s = styles(colors);
    const hasDestructive = actions.some((action) => action.variant === 'destructive');
    const hasCancelOnly = actions.every((action) => action.variant === 'cancel');

    const resolveActionStyle = (variant: AppDialogAction['variant']) => {
        if (variant === 'destructive') {
            return {
                borderColor: colors.error,
                backgroundColor: withAlpha(colors.error, '12'),
                textColor: colors.error,
            };
        }
        if (variant === 'cancel') {
            return {
                borderColor: colors.border,
                backgroundColor: colors.surfaceVariant,
                textColor: colors.text,
            };
        }
        return {
            borderColor: colors.primary,
            backgroundColor: colors.primary,
            textColor: colors.onPrimary,
        };
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={s.root}>
                <Pressable style={[s.backdrop, { backgroundColor: withAlpha(colors.text, '66') }]} onPress={onClose} />
                <View style={s.sheet}>
                    <View style={s.handle} />
                    <Text style={[s.eyebrow, { color: hasDestructive ? colors.error : hasCancelOnly ? colors.textSecondary : colors.primary }]}>
                        {hasDestructive ? 'Confirmation required' : 'Vahi'}
                    </Text>
                    <Text style={s.title}>{title}</Text>
                    {message ? <Text style={s.message}>{message}</Text> : null}
                    <View style={s.actions}>
                        {actions.map((action, index) => {
                            const variant = resolveActionStyle(action.variant);
                            return (
                                <Pressable
                                    key={`${action.label}-${index}`}
                                    style={[
                                        s.actionBtn,
                                        {
                                            borderColor: variant.borderColor,
                                            backgroundColor: variant.backgroundColor,
                                            opacity: action.disabled ? 0.6 : 1,
                                        },
                                    ]}
                                    disabled={action.disabled}
                                    onPress={() => {
                                        onClose();
                                        action.onPress?.();
                                    }}
                                >
                                    <Text style={[s.actionText, { color: variant.textColor }]}>
                                        {action.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        root: {
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: DESIGN_SPACING.screenX,
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
        },
        sheet: {
            borderRadius: 24,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            gap: Spacing.sm,
            ...getSurfaceStyle(colors, { floating: true, elevated: true }),
        },
        handle: {
            alignSelf: 'center',
            width: 42,
            height: 5,
            borderRadius: Radius.pill,
            backgroundColor: colors.border,
            marginBottom: 2,
        },
        eyebrow: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
        },
        title: {
            color: colors.text,
            fontSize: Typography.title.size,
            fontWeight: '700',
        },
        message: {
            color: colors.textSecondary,
            fontSize: Typography.body.size,
            lineHeight: Typography.body.lineHeight,
        },
        actions: {
            marginTop: Spacing.xs,
            flexDirection: 'row',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: Spacing.sm,
        },
        actionBtn: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            minWidth: 84,
            alignItems: 'center',
        },
        actionText: {
            fontSize: Typography.label.size,
            fontWeight: '700',
        },
    });
