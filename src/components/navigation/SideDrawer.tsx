import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme, Divider, Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// Defines the drawer config
const DRAWER_WIDTH = Dimensions.get('window').width * 0.75;

interface SideDrawerProps {
    visible: boolean;
    onClose: () => void;
    actions: { key: string, label: string, icon: string, route: string, subtitle?: string }[];
}

export const SideDrawer: React.FC<SideDrawerProps> = ({ visible, onClose, actions }) => {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [animatedPos] = useState(() => new Animated.Value(-DRAWER_WIDTH));
    const [fadeAnim] = useState(() => new Animated.Value(0));

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(animatedPos, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0.5,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(animatedPos, {
                    toValue: -DRAWER_WIDTH,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [visible, animatedPos, fadeAnim]);

    // Do not mount/unmount the portal completely immediately to allow exit animations. 
    // Simply rely on pointerEvents for the backdrop.

    return (
        <Portal>
            <View
                style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
                pointerEvents={visible ? 'auto' : 'none'}
            >
                {/* Backdrop */}
                <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: fadeAnim }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                </Animated.View>

                {/* Drawer Content */}
                <Animated.View
                    style={[
                        styles.drawer,
                        {
                            backgroundColor: theme.colors.surface,
                            width: DRAWER_WIDTH,
                            borderRightColor: theme.colors.outlineVariant,
                            paddingTop: Math.max(insets.top, 24),
                            paddingBottom: insets.bottom,
                            transform: [{ translateX: animatedPos }],
                        }
                    ]}
                >
                    <View style={styles.header}>
                        <View style={[styles.iconBox, { backgroundColor: theme.colors.primaryContainer }]}>
                            <MaterialCommunityIcons name="briefcase" size={28} color={theme.colors.onPrimaryContainer} />
                        </View>
                        <Text variant="titleMedium" style={{ fontWeight: '700', marginTop: 12 }}>
                            Business Controls
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            Manage your daily operations
                        </Text>
                    </View>

                    <Divider />

                    <View style={styles.actionList}>
                        {actions.map((action) => (
                            <Pressable
                                key={action.key}
                                onPress={() => {
                                    onClose();
                                    router.push(action.route as never);
                                }}
                                style={({ pressed }) => [
                                    styles.actionItem,
                                    { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' }
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name={action.icon as any}
                                    size={24}
                                    color={theme.colors.onSurfaceVariant}
                                />
                                <View style={styles.actionTextWrapper}>
                                    <Text variant="titleSmall" style={{ fontWeight: '600' }}>{action.label}</Text>
                                    {action.subtitle && (
                                        <Text variant="bodySmall" style={{ color: theme.colors.outline, fontSize: 11 }}>
                                            {action.subtitle}
                                        </Text>
                                    )}
                                </View>
                            </Pressable>
                        ))}
                    </View>
                </Animated.View>
            </View>
        </Portal>
    );
};

const styles = StyleSheet.create({
    drawer: {
        flex: 1,
        borderRightWidth: 1,
        borderTopRightRadius: 24,
        borderBottomRightRadius: 24,
        elevation: 16,
        shadowColor: '#000',
        shadowOffset: { width: 5, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    header: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionList: {
        flex: 1,
        paddingTop: 16,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    actionTextWrapper: {
        marginLeft: 16,
        flex: 1,
    }
});
