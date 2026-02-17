import React from 'react';
import { View, StyleSheet, StatusBar, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSegments } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { getTabAwareBottomSpacing } from './tabBarMetrics';

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
    const horizontalPadding = width >= 900 ? 20 : 14;
    const constrainContent = width >= 1100;
    const insideTabs = segments.includes('(tabs)');
    const bottomSpacing = !disableTabPadding && insideTabs ? getTabAwareBottomSpacing(insets.bottom) : 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
            <StatusBar
                barStyle={theme.dark ? 'light-content' : 'dark-content'}
                backgroundColor={theme.colors.background}
            />
            <MotiView
                pointerEvents="none"
                style={[
                    styles.backgroundOrbTop,
                    { backgroundColor: theme.colors.primaryContainer, opacity: theme.dark ? 0.18 : 0.44 },
                ]}
                from={{ translateX: 20, translateY: -10 }}
                animate={{ translateX: -8, translateY: 10 }}
                transition={{
                    type: 'timing',
                    duration: 6000,
                    loop: true,
                    repeatReverse: true,
                }}
            />
            <MotiView
                pointerEvents="none"
                style={[
                    styles.backgroundOrbBottom,
                    { backgroundColor: theme.colors.secondaryContainer, opacity: theme.dark ? 0.16 : 0.4 },
                ]}
                from={{ translateX: -12, translateY: 16 }}
                animate={{ translateX: 10, translateY: -10 }}
                transition={{
                    type: 'timing',
                    duration: 6400,
                    loop: true,
                    repeatReverse: true,
                }}
            />
            <View style={[styles.viewport, { paddingHorizontal: horizontalPadding, paddingBottom: bottomSpacing }]}>
                <MotiView
                    style={[styles.content, constrainContent && styles.contentConstrained]}
                    from={{ opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 220 }}
                >
                    {children}
                </MotiView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backgroundOrbTop: {
        position: 'absolute',
        top: -84,
        right: -68,
        width: 240,
        height: 240,
        borderRadius: 120,
    },
    backgroundOrbBottom: {
        position: 'absolute',
        bottom: -120,
        left: -80,
        width: 280,
        height: 280,
        borderRadius: 140,
    },
    viewport: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    contentConstrained: {
        width: '100%',
        maxWidth: 1120,
        alignSelf: 'center',
    },
});
