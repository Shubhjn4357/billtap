import { Alert, View, Text, Pressable, StyleSheet, useColorScheme, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getColors, Spacing } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { canAccessModule } from '../utils/accessControl';

const TAB_META = {
    index: { icon: 'HM', label: 'Home', module: 'home' as const },
    billing: { icon: 'BL', label: 'Billing', module: 'billing' as const },
    inventory: { icon: 'IN', label: 'Inventory', module: 'inventory' as const },
    accounts: { icon: 'AC', label: 'Accounts', module: 'accounts' as const },
    reports: { icon: 'RP', label: 'Reports', module: 'reports' as const },
    more: { icon: 'MO', label: 'More', module: 'home' as const },
    parties: { icon: 'PT', label: 'Parties', module: 'parties' as const },
} as const;

export function VahiTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const scheme = useColorScheme();
    const colors = getColors(scheme);
    const role = useAuthStore((s) => s.organizationRole);
    const subscription = useAuthStore((s) => s.subscription);

    return (
        <View style={[styles.bar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }]}> 
            {state.routes.map((route, index) => {
                const tab = TAB_META[route.name as keyof typeof TAB_META];
                if (!tab) return null;

                const isFocused = state.index === index;
                const { options } = descriptors[route.key];
                const expoRouterOptions = options as typeof options & { href?: string | null };
                if (expoRouterOptions.href === null) return null;
                const hasAccess = canAccessModule(role, tab.module, subscription);

                const onPress = () => {
                    if (!hasAccess) {
                        Alert.alert('Access limited', 'This section is not enabled for your role or plan.');
                        return;
                    }

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
                        <Text
                            style={[
                                styles.label,
                                { color: isFocused ? colors.primary : (hasAccess ? colors.textSecondary : colors.border) },
                                isFocused && styles.labelActive,
                            ]}
                        >
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
    icon: { fontSize: 12, fontWeight: '700' },
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

