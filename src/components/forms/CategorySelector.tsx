import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { PREDEFINED_CATEGORIES, getCategoryByKey } from '../../constants/categories';
import { SelectorSheet, type SelectorOption } from '../common/SelectorSheet';
import { DesignSystem } from '../../constants/DesignSystem';

interface CategorySelectorProps {
    value?: string; // key from PREDEFINED_CATEGORIES or custom string
    onChange: (key: string, isCustom: boolean) => void;
    label?: string;
    style?: StyleProp<ViewStyle>;
    disabled?: boolean;
}

const CATEGORY_OPTIONS = PREDEFINED_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    prefix: c.emoji,
}));

/**
 * CategorySelector — tappable field that opens a SelectorSheet.
 * All colors from theme.colors.
 */
export const CategorySelector: React.FC<CategorySelectorProps> = ({
    value,
    onChange,
    label = 'Category',
    style,
    disabled = false,
}) => {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    const isCustom = value ? !PREDEFINED_CATEGORIES.some((c) => c.key === value) : false;
    const displayLabel = isCustom
        ? value ?? 'Select category'
        : (value ? `${getCategoryByKey(value).emoji} ${getCategoryByKey(value).label}` : 'Select category');

    const hasValue = !!value;

    return (
        <>
            <View style={[style]}>
                <Text
                    variant="labelSmall"
                    style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                    {label}
                </Text>
                <Pressable
                    onPress={() => !disabled && setOpen(true)}
                    style={[
                        styles.selector,
                        {
                            backgroundColor: theme.colors.surfaceVariant,
                            borderColor: open
                                ? theme.colors.primary
                                : theme.colors.outlineVariant,
                            opacity: disabled ? DesignSystem.opacity.disabledControl : 1,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.selectorText,
                            {
                                color: hasValue
                                    ? theme.colors.onSurface
                                    : theme.colors.onSurfaceVariant,
                            },
                        ]}
                        numberOfLines={1}
                    >
                        {displayLabel}
                    </Text>
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 16 }}>›</Text>
                </Pressable>
            </View>

            <SelectorSheet
                visible={open}
                onDismiss={() => setOpen(false)}
                onSelect={(opt: SelectorOption) => {
                    setOpen(false);
                    onChange(opt.key, false);
                }}
                onSelectCustom={(custom) => {
                    setOpen(false);
                    onChange(custom, true);
                }}
                options={CATEGORY_OPTIONS}
                selectedKey={isCustom ? undefined : value}
                title="Select Category"
                allowCustom
                customPlaceholder="Enter custom category name..."
                searchPlaceholder="Search categories..."
            />
        </>
    );
};

const styles = StyleSheet.create({
    fieldLabel: {
        marginBottom: DesignSystem.spacing.xxs,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1.5,
        borderRadius: DesignSystem.radius.md,
        paddingHorizontal: DesignSystem.spacing.md,
        paddingVertical: DesignSystem.spacing.sm + 2,
        minHeight: 48,
    },
    selectorText: {
        fontSize: 15,
        flex: 1,
    },
});
