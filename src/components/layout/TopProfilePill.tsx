import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MotionView } from '../motion/Motion';
import { Avatar, Divider, Menu, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore, useUserStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { DesignSystem } from '../../constants/DesignSystem';

export const TopProfilePill: React.FC = () => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { signOut } = useAuth();
    const user = useUserStore((state) => state.user);
    const { isConnected, isInternetReachable } = useNetworkStore();
    const [menuVisible, setMenuVisible] = React.useState(false);
    const isOffline = isConnected === false || isInternetReachable === false;

    const initials = React.useMemo(() => {
        const source = user?.displayName?.trim() || user?.phoneNumber || 'U';
        const parts = source.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }, [user?.displayName, user?.phoneNumber]);

    const handleLogout = async () => {
        setMenuVisible(false);
        await signOut();
        router.replace('/(auth)/login');
    };

    return (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlay]}>
            <MotionView
                style={[
                    styles.container,
                    {
                        top: insets.top + 6,
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.outlineVariant,
                    },
                ]}
                from={{ opacity: 0, translateY: -12, scale: 0.96 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                transition={{ type: 'timing', duration: 240 }}
            >
                <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchorPosition="bottom"
                    contentStyle={[
                        styles.menuContent,
                        {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.outlineVariant,
                        },
                    ]}
                    anchor={(
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Open profile menu"
                            onPress={() => setMenuVisible(true)}
                            style={styles.pressable}
                        >
                            {user?.photoURL ? (
                                <Avatar.Image size={34} source={{ uri: user.photoURL }} />
                            ) : (
                                <Avatar.Text size={34} label={initials} />
                            )}
                            <MotionView
                                style={[
                                    styles.statusDot,
                                    {
                                        backgroundColor: isOffline ? theme.colors.error : theme.colors.secondary,
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
                        </Pressable>
                    )}
                >
                    <Menu.Item
                        leadingIcon="account-circle-outline"
                        title="Profile"
                        onPress={() => {
                            setMenuVisible(false);
                            router.push('/profile');
                        }}
                    />
                    <Menu.Item
                        leadingIcon="cog-outline"
                        title="Settings"
                        onPress={() => {
                            setMenuVisible(false);
                            router.push('/(main)/(tabs)/settings');
                        }}
                    />
                    <Divider />
                    <Menu.Item
                        leadingIcon="logout"
                        title="Logout"
                        onPress={() => { void handleLogout(); }}
                    />
                </Menu>
            </MotionView>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        zIndex: 1200,
        elevation: 40,
    },
    container: {
        position: 'absolute',
        right: 14,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        paddingHorizontal: 4,
        alignItems: 'center',
        flexDirection: 'row',
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 10,
        zIndex: 2,
    },
    pressable: {
        height: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    statusDot: {
        position: 'absolute',
        right: 0,
        bottom: 4,
        width: 9,
        height: 9,
        borderRadius: 4.5,
        borderWidth: 2,
    },
    menuContent: {
        marginTop: 6,
        borderWidth: 1,
        borderRadius: DesignSystem.radius.md,
    },
});
