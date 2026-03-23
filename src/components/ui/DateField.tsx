import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';

type DateFieldProps = {
    value?: string | null;
    placeholder?: string;
    title?: string;
    accessibilityLabel?: string;
    onChange: (value: string | null) => void;
    disabled?: boolean;
    allowClear?: boolean;
    includeTime?: boolean;
};

const toDateOnly = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const formatPreview = (value?: string | null, includeTime = false) => {
    const parsed = parseDate(value);
    if (!parsed) return '';
    if (!includeTime) return parsed.toLocaleDateString('en-IN');
    return `${parsed.toLocaleDateString('en-IN')} ${parsed.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
    })}`;
};

export function DateField({
    value,
    placeholder = 'Select date',
    title = 'Pick date',
    accessibilityLabel,
    onChange,
    disabled = false,
    allowClear = true,
    includeTime = false,
}: DateFieldProps) {
    const colors = useAppColors();
    const s = styles(colors);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<Date>(() => parseDate(value) ?? new Date());

    const preview = useMemo(() => formatPreview(value, includeTime), [includeTime, value]);
    const isAndroid = Platform.OS === 'android';

    const openPicker = () => {
        if (disabled) return;
        setDraft(parseDate(value) ?? new Date());
        setOpen(true);
    };

    const commitValue = (nextValue: Date) => {
        if (includeTime) {
            onChange(nextValue.toISOString());
        } else {
            onChange(toDateOnly(nextValue));
        }
        setOpen(false);
    };

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
                onPress={openPicker}
            >
                <Text style={[s.inputText, { color: preview ? colors.text : colors.textSecondary }]}>
                    {preview || placeholder}
                </Text>
                <MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.textSecondary} />
            </Pressable>

            {isAndroid && open ? (
                <DateTimePicker
                    value={draft}
                    mode={includeTime ? 'datetime' : 'date'}
                    display="default"
                    onChange={(event, selected) => {
                        if (event.type === 'dismissed') {
                            setOpen(false);
                            return;
                        }
                        if (!selected) return;
                        setDraft(selected);
                        commitValue(selected);
                    }}
                />
            ) : null}

            {!isAndroid ? (
                <Modal
                    visible={open}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setOpen(false)}
                >
                    <View style={s.modalRoot}>
                        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
                        <View style={s.sheet}>
                            <View style={s.handle} />
                            <Text style={[s.title, { color: colors.text }]}>{title}</Text>

                            <DateTimePicker
                                value={draft}
                                mode={includeTime ? 'datetime' : 'date'}
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, selected) => {
                                    if (event.type === 'dismissed') {
                                        setOpen(false);
                                        return;
                                    }
                                    if (!selected) return;
                                    setDraft(selected);
                                    commitValue(selected);
                                }}
                            />

                            {allowClear ? (
                                <Pressable
                                    style={s.clearBtn}
                                    onPress={() => {
                                        onChange(null);
                                        setOpen(false);
                                    }}
                                >
                                    <Text style={[s.clearText, { color: colors.error }]}>Clear date</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    </View>
                </Modal>
            ) : null}
        </>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        input: {
            minHeight: 44,
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        inputText: {
            fontSize: Typography.body.size,
            fontWeight: '500',
        },
        modalRoot: {
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: DESIGN_SPACING.screenX,
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: withAlpha(colors.text, '4D'),
        },
        sheet: {
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.md,
            paddingBottom: Spacing.md,
            gap: Spacing.md,
            ...getSurfaceStyle(colors, { floating: true }),
        },
        handle: {
            alignSelf: 'center',
            width: 44,
            height: 5,
            borderRadius: Radius.pill,
            backgroundColor: colors.border,
        },
        title: {
            fontSize: Typography.title.size,
            fontWeight: '700',
        },
        clearBtn: {
            alignSelf: 'flex-start',
            paddingVertical: Spacing.xs,
        },
        clearText: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
    });
