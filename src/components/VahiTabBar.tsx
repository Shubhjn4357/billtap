// @ts-nocheck
import { View, Text, Pressable, StyleSheet, useColorScheme, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Typography } from '../constants/theme';

const TABS = [
    { name: 'index', icon: '🏠', label: 'Home' },
    { name: 'billing', icon: '🧾', label: 'Billing' },
    { name: 'inventory', icon: '📦', label: 'Items' },
    { name: 'parties', icon: '👥', label: 'Parties' },
    { name: 'accounts', icon: '💰', label: 'Accounts' },
    { name: 'more', icon: '⋯', label: 'More' },
] as const;

export function VahiTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];

    return (
        <View style={[styles.bar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }]}>
            {state.routes.map((route, index) => {
                const tab = TABS[index];
                if (!tab) return null;
                const isFocused = state.index === index;
                const { options } = descriptors[route.key];

                const onPress = () => {
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                return (
                    <Pressable
                        key={route.key}
                        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
                        onPress={onPress}
                        accessibilityRole="tab"
                        accessibilityLabel={options.tabBarAccessibilityLabel ?? tab.label}
                        accessibilityState={{ selected: isFocused }}
                    >
                        <Text style={[styles.icon, isFocused && { transform: [{ scale: 1.1 }] }]}>
                            {tab.icon}
                        </Text>
                        <Text style={[
                            styles.label,
                            { color: isFocused ? colors.primary : colors.textSecondary },
                            isFocused && styles.labelActive,
                        ]}>
                            {tab.label}
                        </Text>
                        {isFocused && (
                            <View style={[styles.indicator, { backgroundColor: colors.primary }]} />
                        )}
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        borderTopWidth: 1,
        paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        paddingTop: Spacing.sm,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
        position: 'relative',
        paddingTop: Spacing.xs,
    },
    tabPressed: { opacity: 0.7 },
    icon: { fontSize: 22 },
    label: {
        fontSize: 10,
        fontWeight: '500',
    },
    labelActive: {
        fontWeight: '700',
    },
    indicator: {
        position: 'absolute',
        top: -8,
        height: 2,
        width: 28,
        borderRadius: 2,
    },
});


