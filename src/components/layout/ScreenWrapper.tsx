import React from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { useSegments } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    getTabAwareBottomSpacing,
    getTabAwareLeftSpacing,
    shouldUseSidebarNavigation,
} from './tabBarMetrics';
import { DesignSystem } from '../../constants/DesignSystem';
import { useWindowDimensions } from 'react-native';

/**
 * ScreenWrapper
 *
 * Modern safe-area implementation using `useSafeAreaInsets()` + manual padding.
 * We do NOT wrap with `<SafeAreaView>` — that component is deprecated in favour
 * of inset-based padding in contemporary Expo + React Navigation setups.
 *
 * The wrapper automatically accounts for:
 *   • The floating TopProfilePill header (pillTopOffset) when inside tabs
 *   • Bottom tab bar spacing (getTabAwareBottomSpacing)
 *   • Sidebar nav offset on wide layouts (getTabAwareLeftSpacing)
 *   • Responsive horizontal padding based on screen width
 */

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Set true to opt-out of automatic tab bar padding (e.g. for full-bleed screens) */
    disableTabPadding?: boolean;
    /** Extra top padding beyond the pill offset — for screens that need additional spacing */
    extraTopPadding?: number;
}

const HORIZONTAL_PADDING_FN = (width: number): number => {
    if (width >= 1440) return 40;
    if (width >= 1100) return 32;
    if (width >= 900) return 24;
    if (width >= 600) return 16;
    return DesignSystem.spacing.sm;
};

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
    children,
    style,
    disableTabPadding = false,
    extraTopPadding = 0,
}) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const segments = useSegments() as string[];

    const horizontalPadding = HORIZONTAL_PADDING_FN(width);
    const constrainContent = width >= 960;
    const insideTabs = segments.includes('(tabs)');
    const sidebarLayout = insideTabs && shouldUseSidebarNavigation(width);

    // Top padding: when inside tabs, account for the floating pill header
    const topPadding = insideTabs
        ? DesignSystem.layout.pillTopOffset + insets.top + extraTopPadding
        : insets.top + extraTopPadding;

    const bottomPadding = !disableTabPadding && insideTabs && !sidebarLayout
        ? getTabAwareBottomSpacing(insets.bottom)
        : insets.bottom;

    const leftPadding = horizontalPadding + (!disableTabPadding && sidebarLayout
        ? getTabAwareLeftSpacing(insets.left)
        : insets.left);

    const rightPadding = horizontalPadding + insets.right;

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.background,
                    paddingTop: topPadding,
                    paddingBottom: bottomPadding,
                    paddingLeft: leftPadding,
                    paddingRight: rightPadding,
                },
                style,
            ]}
        >
            <View
                style={[
                    styles.content,
                    constrainContent && {
                        maxWidth: DesignSystem.layout.dashboardMaxWidth,
                        alignSelf: 'center' as const,
                        width: '100%' as const,
                    },
                ]}
            >
                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {children}
                </KeyboardAvoidingView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
});
