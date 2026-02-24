import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    LayoutAnimation,
    Platform,
    Pressable,
    StyleSheet,
    UIManager,
    View,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface AppAccordionProps {
    title: string;
    icon?: IconName;
    expanded?: boolean;
    defaultExpanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    disabled?: boolean;
    children: React.ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
    headerStyle?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
}

let androidLayoutAnimationEnabled = false;

const enableAndroidLayoutAnimation = () => {
    if (Platform.OS !== 'android') return;
    if (androidLayoutAnimationEnabled) return;
    if (typeof UIManager.setLayoutAnimationEnabledExperimental !== 'function') return;
    UIManager.setLayoutAnimationEnabledExperimental(true);
    androidLayoutAnimationEnabled = true;
};

export const AppAccordion: React.FC<AppAccordionProps> = ({
    title,
    icon,
    expanded,
    defaultExpanded = false,
    onExpandedChange,
    disabled = false,
    children,
    containerStyle,
    headerStyle,
    contentStyle,
    titleStyle,
}) => {
    const theme = useTheme();
    const isControlled = typeof expanded === 'boolean';
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
    const isExpanded = isControlled ? Boolean(expanded) : internalExpanded;
    const chevronAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

    useEffect(() => {
        enableAndroidLayoutAnimation();
    }, []);

    useEffect(() => {
        Animated.timing(chevronAnim, {
            toValue: isExpanded ? 1 : 0,
            duration: 180,
            useNativeDriver: true,
        }).start();
    }, [chevronAnim, isExpanded]);

    const toggleExpanded = () => {
        if (disabled) return;

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const next = !isExpanded;

        if (!isControlled) {
            setInternalExpanded(next);
        }
        onExpandedChange?.(next);
    };

    const chevronRotation = chevronAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                },
                containerStyle,
            ]}
        >
            <Pressable
                onPress={toggleExpanded}
                disabled={disabled}
                style={({ pressed }) => [
                    styles.header,
                    headerStyle,
                    pressed && !disabled ? styles.headerPressed : null,
                ]}
            >
                <View style={styles.leading}>
                    {icon ? (
                        <MaterialCommunityIcons
                            name={icon}
                            size={20}
                            color={theme.colors.primary}
                            style={styles.leadingIcon}
                        />
                    ) : null}
                    <Text
                        variant="titleSmall"
                        style={[
                            styles.title,
                            { color: theme.colors.onSurfaceVariant },
                            titleStyle,
                        ]}
                    >
                        {title}
                    </Text>
                </View>

                <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
                    <MaterialCommunityIcons
                        name="chevron-down"
                        size={22}
                        color={theme.colors.onSurfaceVariant}
                    />
                </Animated.View>
            </Pressable>

            {isExpanded ? (
                <View style={[styles.content, contentStyle]}>
                    {children}
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: DesignSystem.radius.sm,
        borderWidth: 1,
        overflow: 'hidden',
    },
    header: {
        minHeight: 44,
        paddingHorizontal: DesignSystem.spacing.sm,
        paddingVertical: DesignSystem.spacing.xs,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerPressed: {
        opacity: 0.9,
    },
    leading: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    leadingIcon: {
        marginRight: DesignSystem.spacing.xs,
    },
    title: {
        fontWeight: '600',
    },
    content: {
        paddingHorizontal: DesignSystem.spacing.sm,
        paddingBottom: DesignSystem.spacing.sm,
    },
});
