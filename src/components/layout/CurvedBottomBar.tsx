
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useTheme, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* 
 * A simplified custom tab bar. 
 * Real "Curved" implementation typically involves complex SVG paths tailored to screen width.
 * For now, implementing a floating style bar which is cleaner and safer to get right quickly.
 */
interface ExtendedOptions extends BottomTabNavigationOptions {
  tabBarTestID?: string;
}

export const CurvedBottomBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.content, { backgroundColor: theme.colors.elevation.level2 }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

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

          return (
            <TouchableOpacity
              key={index}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={(options as ExtendedOptions).tabBarTestID}
              onPress={onPress}
              style={styles.tab}
            >
              {/* Icon rendering logic would go here, relying on options.tabBarIcon */}
              {options.tabBarIcon && options.tabBarIcon({
                focused: isFocused,
                color: isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant,
                size: 24
              })}
              {/* <Text style={{ color: isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant, fontSize: 10 }}>
                {label.toString()}
              </Text> */}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    marginBottom: 20
  },
  content: {
    flexDirection: 'row',
    width: '90%',
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
  }
});
