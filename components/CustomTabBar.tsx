import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useTheme, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Layout } from '../constants/Colors';

// Fallback type extraction if import fails or for convenience
type TabOptions = BottomTabBarProps['descriptors'][string]['options'];

// Animated Icon Component
const AnimatedIcon = ({ name, color, focused }: { name: React.ComponentProps<typeof MaterialCommunityIcons>['name'], color: string, focused: boolean }) => {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.2 : 1, { damping: 10 });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }]
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <MaterialCommunityIcons name={name} size={24} color={color} />
    </Animated.View>
  );
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 50}
        tint={theme.dark ? 'dark' : 'light'}
        style={[styles.blurView, { paddingBottom: insets.bottom + 10 }]}
      >
        <View style={styles.content}>
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            let iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'] = 'circle';
            if (route.name === 'home') iconName = isFocused ? 'home' : 'home-outline';
            if (route.name === 'stock') iconName = isFocused ? 'package-variant' : 'package-variant-closed';
            if (route.name === 'billing') iconName = 'plus'; // Special case
            if (route.name === 'reports') iconName = isFocused ? 'chart-box' : 'chart-box-outline';
            if (route.name === 'settings') iconName = isFocused ? 'cog' : 'cog-outline';

            const color = isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant;

            // Special Center Button for Billing
            if (route.name === 'billing') {
              return (
                <TouchableOpacity
                  key={index}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel}
                  testID={(options as TabOptions & { tabBarTestID?: string }).tabBarTestID}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={styles.fabContainer}
                >
                  <View style={[styles.fab, { backgroundColor: theme.colors.primary }]}>
                    <MaterialCommunityIcons name="plus" size={32} color={theme.colors.onPrimary} />
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={index}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={(options as TabOptions & { tabBarTestID?: string }).tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tabItem}
              >
                <AnimatedIcon name={iconName} color={color} focused={isFocused} />
                <Text style={{ fontSize: 10, color: color, marginTop: 4 }}>
                  {options.title || route.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  blurView: {
    width: '100%',
    paddingTop: 15,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabContainer: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  }
});
