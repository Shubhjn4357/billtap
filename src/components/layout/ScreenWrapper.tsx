
import React from 'react';
import { View, StyleSheet, StatusBar, type StyleProp, type ViewStyle } from 'react-native';
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
    const { isConnected, isInternetReachable } = useNetworkStore();
    const isOffline = isConnected === false || isInternetReachable === false;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
            <StatusBar 
                barStyle={theme.dark ? 'light-content' : 'dark-content'} 
                backgroundColor={theme.colors.background}
            />
            {isOffline && (
                <View style={[styles.offlineBanner, { backgroundColor: theme.colors.errorContainer }]}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onErrorContainer }}>
                        {COMMON_TEXT.messages.offlineMode}
                    </Text>
                </View>
            )}
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    offlineBanner: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
});
