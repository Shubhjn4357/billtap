
import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenWrapperProps {
    children: React.ReactNode;
    withScrollView?: boolean;
    style?: any;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children, style }) => {
    const theme = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
            <StatusBar 
                barStyle={theme.dark ? 'light-content' : 'dark-content'} 
                backgroundColor={theme.colors.background}
            />
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
