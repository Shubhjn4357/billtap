import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { Avatar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore, useUserStore } from '../../store';

export const TopProfilePill: React.FC = () => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const user = useUserStore((state) => state.user);
    const { isConnected, isInternetReachable } = useNetworkStore();
    const isOffline = isConnected === false || isInternetReachable === false;

    const initials = React.useMemo(() => {
        const source = user?.displayName?.trim() || user?.phoneNumber || 'U';
        const parts = source.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }, [user?.displayName, user?.phoneNumber]);

    return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <MotiView
                style={[
                    styles.container,
                    {
                        top: insets.top + 6,
                        backgroundColor: theme.dark ? 'rgba(15, 23, 42, 0.86)' : 'rgba(255, 255, 255, 0.86)',
                        borderColor: theme.dark ? 'rgba(148,163,184,0.3)' : 'rgba(30,41,59,0.14)',
                    },
                ]}
                from={{ opacity: 0, translateY: -12, scale: 0.96 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                transition={{ type: 'timing', duration: 240 }}
            >
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open profile settings"
                    onPress={() => router.push('/profile')}
                    style={styles.pressable}
                >
                    {user?.photoURL ? (
                        <Avatar.Image size={36} source={{ uri: user.photoURL }} />
                    ) : (
                        <Avatar.Text size={36} label={initials} />
                    )}
                    <MotiView
                        style={[
                            styles.statusDot,
                            {
                                backgroundColor: isOffline ? theme.colors.error : '#16a34a',
                                borderColor: theme.colors.background,
                            },
                        ]}
                        animate={isOffline ? { scale: 1, opacity: 1 } : { scale: 1.16, opacity: 0.86 }}
                        transition={isOffline
                            ? { type: 'timing', duration: 120 }
                            : {
                                type: 'timing',
                                duration: 900,
                                loop: true,
                                repeatReverse: true,
                            }}
                    />
                    <Text variant="labelSmall" style={{ marginLeft: 8, color: theme.colors.onSurfaceVariant }}>
                        {isOffline ? 'Offline' : 'Online'}
                    </Text>
                </Pressable>
            </MotiView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 14,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 3,
        alignItems: 'center',
        flexDirection: 'row',
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 8,
    },
    pressable: {
        height: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    statusDot: {
        position: 'absolute',
        left: 31,
        bottom: 4,
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
    },
});
