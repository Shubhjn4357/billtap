import { useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING, getPillStyle, getShadowStyle, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../../constants/theme';
import { AppInput } from './AppInput';
import { useAppColors } from '../../hooks/useAppColors';

export type SelectOption = {
    label: string;
    value: string;
    description?: string;
};

type SelectFieldProps = {
    value?: string | null;
    placeholder?: string;
    title?: string;
    accessibilityLabel?: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    disabled?: boolean;
    searchable?: boolean;
    allowClear?: boolean;
    onClear?: () => void;
};

const normalize = (value: string) => value.trim().toLowerCase();

export function SelectField({
    value,
    placeholder = 'Select',
    title = 'Select option',
    accessibilityLabel,
    options,
    onChange,
    disabled,
    searchable = true,
    allowClear = false,
    onClear,
}: SelectFieldProps) {
    const colors = useAppColors();
    const s = styles(colors);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const selected = useMemo(
        () => options.find((entry) => entry.value === value) ?? null,
        [options, value]
    );

    const filtered = useMemo(() => {
        const query = normalize(search);
        if (!query) return options;
        return options.filter((entry) => {
            const matchLabel = normalize(entry.label).includes(query);
            const matchDesc = normalize(entry.description ?? '').includes(query);
            return matchLabel || matchDesc;
        });
    }, [options, search]);

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel ?? title ?? placeholder}
                style={[
                    s.input,
                    {
                        backgroundColor: colors.surface,
                        borderColor: withAlpha(colors.border, 'C8'),
                    },
                    disabled && { opacity: 0.6 },
                ]}
                onPress={() => {
                    if (disabled) return;
                    setSearch('');
                    setOpen(true);
                }}
            >
                <Text style={[s.inputText, { color: selected ? colors.text : colors.textSecondary }]}>
                    {selected?.label ?? placeholder}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>

            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <View style={s.modalRoot}>
                    <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
                    <View style={s.sheet}>
                        <Text style={[s.title, { color: colors.text }]}>{title}</Text>

                        {searchable ? (
                            <AppInput
                                inputType="search"
                                leadingIcon="magnify"
                                value={search}
                                onChangeText={setSearch}
                                placeholder="Search..."
                                containerStyle={s.searchWrap}
                            />
                        ) : null}

                        <FlatList
                            data={filtered}
                            keyExtractor={(entry) => entry.value}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => {
                                const isSelected = item.value === value;
                                return (
                                    <Pressable
                                        style={[
                                            s.option,
                                            getSurfaceStyle(colors, {
                                                accent: isSelected ? colors.primary : undefined,
                                                muted: isSelected,
                                            }),
                                            isSelected && { backgroundColor: colors.surfaceVariant },
                                        ]}
                                        onPress={() => {
                                            onChange(item.value);
                                            setOpen(false);
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[s.optionLabel, { color: colors.text }]}>{item.label}</Text>
                                            {item.description ? (
                                                <Text style={[s.optionDescription, { color: colors.textSecondary }]}>
                                                    {item.description}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <MaterialCommunityIcons
                                            name={isSelected ? 'check-circle' : 'circle-outline'}
                                            size={18}
                                            color={isSelected ? colors.primary : colors.textSecondary}
                                        />
                                    </Pressable>
                                );
                            }}
                            ListEmptyComponent={(
                                <View style={s.emptyWrap}>
                                    <Text style={[s.emptyText, { color: colors.textSecondary }]}>No options found.</Text>
                                </View>
                            )}
                        />

                        {allowClear ? (
                            <Pressable
                                style={[s.clearBtn, { borderColor: colors.border }]}
                                onPress={() => {
                                    onClear?.();
                                    setOpen(false);
                                }}
                            >
                                <Text style={[s.clearText, { color: colors.error }]}>Clear</Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        input: {
            minHeight: 48,
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Spacing.sm,
            ...getShadowStyle(colors, 'soft'),
        },
        inputText: {
            flex: 1,
            fontSize: Typography.body.size,
            fontWeight: '500',
        },
        inputArrow: {
            fontSize: Typography.body.size,
            fontWeight: '700',
        },
        modalRoot: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: withAlpha(colors.text, '88'),
        },
        sheet: {
            borderTopLeftRadius: Radius.lg,
            borderTopRightRadius: Radius.lg,
            borderBottomWidth: 0,
            maxHeight: '80%',
            paddingHorizontal: DESIGN_SPACING.screenX,
            paddingTop: Spacing.md,
            paddingBottom: Spacing.xl,
            gap: Spacing.sm,
            ...getSurfaceStyle(colors, { floating: true }),
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        title: {
            fontSize: Typography.title.size,
            fontWeight: '700',
        },
        searchWrap: {
            marginBottom: Spacing.xs,
        },
        option: {
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        optionLabel: {
            fontSize: Typography.body.size,
            fontWeight: '600',
        },
        optionDescription: {
            fontSize: Typography.caption.size,
            marginTop: 2,
        },
        emptyWrap: {
            paddingVertical: Spacing.lg,
            alignItems: 'center',
        },
        emptyText: {
            fontSize: Typography.body.size,
        },
        clearBtn: {
            ...getPillStyle(colors),
            alignItems: 'center',
            paddingVertical: Spacing.sm,
        },
        clearText: {
            fontSize: Typography.body.size,
            fontWeight: '700',
        },
    });
