import type { BottomTabNavigationOptions, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ExtendedOptions extends BottomTabNavigationOptions {
    tabBarTestID?: string;
}

const getTabLabel = (options: ExtendedOptions, routeName: string) => {
    if (typeof options.tabBarLabel === 'string') {
        return options.tabBarLabel;
    }
    if (typeof options.title === 'string') {
        return options.title;
    }
    return routeName;
};

export const CurvedBottomBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
            <View style={[styles.content, { backgroundColor: theme.colors.elevation.level2 }]}>
                {state.routes.map((route, index) => {
                    const options = descriptors[route.key].options as ExtendedOptions;
                    const isFocused = state.index === index;
                    const label = getTabLabel(options, route.name);

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

                    const activeBackground = isFocused ? theme.colors.primaryContainer : 'transparent';
                    const activeColor = isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant;

                    return (
                        <Pressable
                            key={route.key}
                            accessibilityRole="tab"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            testID={options.tabBarTestID}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            style={({ pressed }) => [
                                styles.tab,
                                { backgroundColor: activeBackground, opacity: pressed ? 0.8 : 1 },
                            ]}
                        >
                            {options.tabBarIcon && options.tabBarIcon({
                                focused: isFocused,
                                color: activeColor,
                                size: 22,
                            })}
                            <Text
                                variant="labelSmall"
                                style={{ color: activeColor, marginTop: 2, fontWeight: isFocused ? '700' : '500' }}
                                numberOfLines={1}
                            >
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
    },
    content: {
        flexDirection: 'row',
        width: '94%',
        height: 72,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
        elevation: 8,
    },
    tab: {
        flex: 1,
        marginHorizontal: 4,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        paddingHorizontal: 4,
    },
});