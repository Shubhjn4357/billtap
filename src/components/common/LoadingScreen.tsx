import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

interface LoadingScreenProps {
    message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading...' }) => {
    const theme = useTheme();
    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View
                pointerEvents="none"
                style={[
                    styles.orb,
                    {
                        backgroundColor: theme.colors.primaryContainer,
                        opacity: theme.dark ? 0.24 : 0.42,
                    },
                ]}
            />
            <View
                style={[
                    styles.panel,
                    {
                        backgroundColor: theme.dark ? 'rgba(17,26,45,0.82)' : 'rgba(255,255,255,0.8)',
                        borderColor: theme.dark ? 'rgba(148,163,184,0.18)' : 'rgba(30,41,59,0.12)',
                    },
                ]}
            >
                <ActivityIndicator size="large" />
                {message && <Text style={{ color: theme.colors.onSurface, ...styles.message }}>{message}</Text>}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    orb: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        top: '18%',
        right: -40,
    },
    panel: {
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 24,
        paddingVertical: 20,
        alignItems: 'center',
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 6,
    },
    message: {
        marginTop: 8,
        opacity: 0.8,
    },
});
