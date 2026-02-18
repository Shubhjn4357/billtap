import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Divider, Menu, Text, useTheme } from 'react-native-paper';
import { COUNTRY_DIAL_CODES, type CountryDialCode } from '../../constants/countryDialCodes';
import { DesignSystem } from '../../constants/DesignSystem';
import { AppInput } from '../common/AppInput';

type CountryCodePickerProps = {
    value: string;
    onChange: (dialCode: string) => void;
    disabled?: boolean;
};

export const CountryCodePicker: React.FC<CountryCodePickerProps> = ({
    value,
    onChange,
    disabled = false,
}) => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const [visible, setVisible] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const menuWidth = Math.min(360, Math.max(260, width - 24));

    const selected = React.useMemo<CountryDialCode | null>(() => {
        return COUNTRY_DIAL_CODES.find((entry) => entry.dialCode === value) ?? null;
    }, [value]);

    const filteredCodes = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return COUNTRY_DIAL_CODES;
        return COUNTRY_DIAL_CODES.filter((entry) =>
            entry.iso2.toLowerCase().includes(needle)
            || entry.name.toLowerCase().includes(needle)
            || entry.dialCode.includes(needle)
        );
    }, [query]);

    return (
        <Menu
            visible={visible}
            onDismiss={() => setVisible(false)}
            contentStyle={[
                styles.menu,
                {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outline,
                    width: menuWidth,
                },
            ]}
            anchor={(
                <Pressable
                    disabled={disabled}
                    onPress={() => setVisible(true)}
                    style={[
                        styles.trigger,
                        {
                            borderColor: theme.colors.outline,
                            backgroundColor: theme.colors.surfaceVariant,
                            opacity: disabled ? 0.6 : 1,
                        },
                    ]}
                >
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {selected?.iso2 ?? 'CC'}
                    </Text>
                    <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                        {value}
                    </Text>
                </Pressable>
            )}
        >
            <View style={styles.searchWrap}>
                <AppInput
                    label="Country code"
                    inputType="search"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search country or code"
                    style={styles.searchInput}
                />
            </View>
            <Divider />
            <ScrollView style={styles.listWrap}>
                {filteredCodes.map((entry) => (
                    <Menu.Item
                        key={`${entry.iso2}-${entry.dialCode}`}
                        title={`${entry.iso2} ${entry.name}`}
                        leadingIcon="earth"
                        trailingIcon={entry.dialCode === value ? 'check' : undefined}
                        onPress={() => {
                            onChange(entry.dialCode);
                            setVisible(false);
                        }}
                    />
                ))}
            </ScrollView>
        </Menu>
    );
};

const styles = StyleSheet.create({
    trigger: {
        minWidth: 94,
        borderWidth: 1,
        borderRadius: DesignSystem.radius.md,
        paddingHorizontal: DesignSystem.spacing.xs + 2,
        paddingVertical: 7,
        justifyContent: 'center',
        gap: 2,
    },
    menu: {
        borderWidth: 1,
        borderRadius: DesignSystem.radius.md,
    },
    searchWrap: {
        paddingHorizontal: DesignSystem.spacing.xs,
        paddingTop: DesignSystem.spacing.xs,
    },
    searchInput: {
        marginBottom: 0,
    },
    listWrap: {
        maxHeight: 320,
    },
});
