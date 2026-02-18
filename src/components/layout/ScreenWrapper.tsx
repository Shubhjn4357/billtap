import React from 'react';
import { View, StyleSheet, StatusBar, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSegments } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabAwareBottomSpacing, getTabAwareLeftSpacing, shouldUseSidebarNavigation } from './tabBarMetrics';
import { DesignSystem } from '../../constants/DesignSystem';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    disableTabPadding?: boolean;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children, style, disableTabPadding = false }) => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const segments = useSegments() as string[];
    const horizontalPadding = width >= 1440 ? 34 : width >= 1100 ? 26 : width >= 900 ? 20 : DesignSystem.spacing.sm;
    const constrainContent = width >= 960;
    const insideTabs = segments.includes('(tabs)');
    const sidebarLayout = insideTabs && shouldUseSidebarNavigation(width);
    const bottomSpacing = !disableTabPadding && insideTabs && !sidebarLayout
        ? getTabAwareBottomSpacing(insets.bottom)
        : 0;
    const leftSpacing = !disableTabPadding && sidebarLayout ? getTabAwareLeftSpacing(insets.left) : 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
            <StatusBar
                barStyle={theme.dark ? 'light-content' : 'dark-content'}
                backgroundColor={theme.colors.background}
            />
            <View
                style={[
                    styles.viewport,
                    {
                        paddingLeft: horizontalPadding + leftSpacing,
                        paddingRight: horizontalPadding,
                        paddingBottom: bottomSpacing,
                    },
                ]}
            >
                <View
                    style={[
                        styles.content,
                        constrainContent && styles.contentConstrained,
                        {
                            backgroundColor: theme.colors.background,
                        },
                    ]}
                >
                    {children}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    viewport: {
        flex: 1,
        paddingTop: 4,
    },
    content: {
        flex: 1,
        borderRadius: 0,
        borderWidth: 0,
        paddingHorizontal: DesignSystem.spacing.sm,
        shadowOpacity: 0,
        elevation: 0,
    },
    contentConstrained: {
        width: '100%',
        maxWidth: DesignSystem.layout.dashboardMaxWidth,
        alignSelf: 'center',
    },
});
