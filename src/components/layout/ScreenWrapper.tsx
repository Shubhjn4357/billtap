import { type ReactNode } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESIGN_SPACING } from '../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';

type ScreenWrapperProps = {
    title?: string;
    children: ReactNode;
    onBack?: () => void;
    scrollable?: boolean;
    safeEdges?: Edge[];
    contentContainerStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
    keyboardAware?: boolean;
    rightAction?: ReactNode;
};

export function ScreenWrapper({
    title,
    children,
    onBack,
    scrollable = true,
    safeEdges = ['top', 'bottom'],
    contentContainerStyle,
    style,
    keyboardAware = true,
    rightAction,
}: ScreenWrapperProps) {
    const colors = useAppColors();
    const insets = useSafeAreaInsets();
    const s = styles(colors);

    const content = (
        <>
            {title ? (
                <View style={s.header}>
                    <View style={s.headerLeft}>
                        {onBack ? (
                            <Pressable onPress={onBack} style={s.backBtn}>
                                <Text style={[s.backText, { color: colors.primary }]}>Back</Text>
                            </Pressable>
                        ) : null}
                        <Text style={s.title}>{title}</Text>
                    </View>
                    {rightAction}
                </View>
            ) : null}
            {scrollable ? (
                <ScrollView
                    contentContainerStyle={[
                        s.scrollContent,
                        { paddingBottom: Spacing.xl + Math.max(insets.bottom, Spacing.sm) },
                        contentContainerStyle,
                    ]}
                    keyboardShouldPersistTaps="handled"
                >
                    {children}
                </ScrollView>
            ) : (
                <View
                    style={[
                        s.nonScrollContent,
                        { paddingBottom: Spacing.lg + Math.max(insets.bottom, Spacing.sm) },
                        contentContainerStyle,
                    ]}
                >
                    {children}
                </View>
            )}
        </>
    );

    const wrapped = keyboardAware ? (
        <KeyboardAvoidingView
            style={s.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {content}
        </KeyboardAvoidingView>
    ) : (
        content
    );

    return (
        <SafeAreaView style={[s.safe, style]} edges={safeEdges}>
            {wrapped}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.background,
        },
        flex: { flex: 1 },
        header: {
            minHeight: 52,
            paddingHorizontal: DESIGN_SPACING.screenX,
            paddingVertical: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Spacing.sm,
        },
        headerLeft: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        backBtn: {
            paddingHorizontal: Spacing.xs,
            paddingVertical: Spacing.xs,
            borderRadius: Radius.pill,
        },
        backText: {
            fontWeight: '700',
            fontSize: Typography.body.size,
        },
        title: {
            flex: 1,
            color: colors.text,
            fontSize: Typography.title.size,
            fontWeight: '700',
        },
        scrollContent: {
            paddingHorizontal: DESIGN_SPACING.screenX,
            gap: Spacing.sm,
        },
        nonScrollContent: {
            flex: 1,
            paddingHorizontal: DESIGN_SPACING.screenX,
            gap: Spacing.sm,
        },
    });
