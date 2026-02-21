import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { PREDEFINED_UNITS, getUnitByKey } from '../../constants/units';
import { SelectorSheet, type SelectorOption } from '../common/SelectorSheet';
import { DesignSystem } from '../../constants/DesignSystem';

interface UnitSelectorProps {
    value?: string; // key or custom string
    onChange: (key: string, isCustom: boolean) => void;
    label?: string;
    style?: StyleProp<ViewStyle>;
    disabled?: boolean;
}

const UNIT_OPTIONS = PREDEFINED_UNITS.map((u) => ({
    key: u.key,
    label: u.label,
    abbr: u.abbr,
}));

/**
 * UnitSelector — tappable field that opens a SelectorSheet for unit selection.
 * All colors from theme.colors.
 */
export const UnitSelector: React.FC<UnitSelectorProps> = ({
    value,
    onChange,
    label = 'Unit',
    style,
    disabled = false,
}) => {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    const isCustom = value ? !PREDEFINED_UNITS.some((u) => u.key === value) : false;
    const unit = !isCustom && value ? getUnitByKey(value) : null;
    const displayLabel = isCustom
        ? value ?? 'Select unit'
        : (unit ? `${unit.label} (${unit.abbr})` : 'Select unit');

    const hasValue = !!value;

    return (
        <>
            <View style={style}>
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
                            borderColor: open ? theme.colors.primary : theme.colors.outlineVariant,
                            opacity: disabled ? DesignSystem.opacity.disabledControl : 1,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.selectorText,
                            { color: hasValue ? theme.colors.onSurface : theme.colors.onSurfaceVariant },
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
                onSelectCustom={(custom: string) => {
                    setOpen(false);
                    onChange(custom, true);
                }}
                options={UNIT_OPTIONS}
                selectedKey={isCustom ? undefined : value}
                title="Select Unit"
                allowCustom
                customPlaceholder="Enter custom unit (e.g. Crate)..."
                searchPlaceholder="Search units..."
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
