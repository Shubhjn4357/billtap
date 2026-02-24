import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const BOTTOM_PADDING = 10;
const DOT_SIZE = 60; // width of the active background pill

export const AnimatedTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [dimensions, setDimensions] = useState({ width: Dimensions.get('window').width });
    const [animatedPos] = useState(() => new Animated.Value(0));

    // Calculate dynamic layout values
    const totalTabs = state.routes.length;
    const tabWidth = dimensions.width / totalTabs;

    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setDimensions({ width: window.width });
        });
        return () => subscription?.remove();
    }, []);

    useEffect(() => {
        Animated.spring(animatedPos, {
            toValue: state.index * tabWidth + (tabWidth / 2) - (DOT_SIZE / 2),
            useNativeDriver: true,
            bounciness: 5,
        }).start();
    }, [state.index, tabWidth, animatedPos]);

    return (
        <Surface
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.surface,
                    paddingBottom: Math.max(insets.bottom, BOTTOM_PADDING)
                }
            ]}
            elevation={2}
        >
            {/* Animated Pill Background */}
            <Animated.View
                style={[
                    styles.activePill,
                    {
                        backgroundColor: theme.colors.primaryContainer,
                        transform: [{ translateX: animatedPos }],
                    }
                ]}
            />

            <View style={styles.tabRow}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
                    };

                    const activeColor = isFocused ? theme.colors.primary : theme.colors.outline;
                    const label =
                        options.tabBarLabel !== undefined
                            ? options.tabBarLabel
                            : options.title !== undefined
                                ? options.title
                                : route.name;

                    return (
                        <Pressable
                            key={route.key}
                            accessibilityRole="tab"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            testID={(options as any).tabBarTestID}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            style={styles.tabItem}
                        >
                            {options.tabBarIcon && options.tabBarIcon({
                                focused: isFocused,
                                color: activeColor,
                                size: 24,
                            })}
                            <Text style={[styles.tabLabel, { color: activeColor, fontWeight: isFocused ? '600' : '400' }]}>
                                {typeof label === 'string' ? label : typeof label === 'function' ? label({ focused: isFocused, color: activeColor, position: 'below-icon', children: '' }) : ''}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </Surface>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',

        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    tabRow: {
        flexDirection: 'row',
        height: 80,
    },
    tabItem: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activePill: {
        position: 'absolute',
        top: 10,
        width: DOT_SIZE,
        height: 60,
        paddingTop:10,
        borderRadius: 10,
        zIndex: 0,
    },
    tabLabel: {
        fontSize: 11,
        marginTop: 2,
    }
});
