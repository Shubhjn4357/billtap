
import React from 'react';
import { View, StyleSheet, StatusBar, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COMMON_TEXT } from '../../constants/staticText';
import { useNetworkStore } from '../../store';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children, style }) => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const { isConnected, isInternetReachable } = useNetworkStore();
    const isOffline = isConnected === false || isInternetReachable === false;
    const horizontalPadding = width >= 900 ? 24 : 16;
    const constrainContent = width >= 1100;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
            <StatusBar 
                barStyle={theme.dark ? 'light-content' : 'dark-content'} 
                backgroundColor={theme.colors.background}
            />
            <View
                pointerEvents="none"
                style={[
                    styles.backgroundOrbTop,
                    { backgroundColor: theme.colors.primaryContainer, opacity: theme.dark ? 0.18 : 0.44 },
                ]}
            />
            <View
                pointerEvents="none"
                style={[
                    styles.backgroundOrbBottom,
                    { backgroundColor: theme.colors.secondaryContainer, opacity: theme.dark ? 0.16 : 0.4 },
                ]}
            />
            {isOffline && (
                <View style={[styles.offlineBanner, { backgroundColor: theme.colors.errorContainer }]}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onErrorContainer }}>
                        {COMMON_TEXT.messages.offlineMode}
                    </Text>
                </View>
            )}
            <View style={[styles.viewport, { paddingHorizontal: horizontalPadding }]}>
                <View style={[styles.content, constrainContent && styles.contentConstrained]}>
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
    offlineBanner: {
        paddingHorizontal: 16,
        paddingVertical: 8,
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
