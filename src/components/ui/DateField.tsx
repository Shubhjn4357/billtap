import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

    const openPicker = () => {
        if (disabled) return;
        setDraft(parseDate(value) ?? new Date());
        setOpen(true);
    };

    const applyValue = () => {
        if (includeTime) {
            onChange(draft.toISOString());
        } else {
            onChange(toDateOnly(draft));
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
                    { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                    disabled && { opacity: 0.6 },
                ]}
                onPress={openPicker}
            >
                <Text style={[s.inputText, { color: preview ? colors.text : colors.textSecondary }]}>
                    {preview || placeholder}
                </Text>
                <MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.textSecondary} />
            </Pressable>

            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <View style={s.modalRoot}>
                    <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
                    <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={s.handle} />
                        <Text style={[s.title, { color: colors.text }]}>{title}</Text>

                        <DateTimePicker
                            value={draft}
                            mode={includeTime ? 'datetime' : 'date'}
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            onChange={(_, selected) => {
                                if (selected) {
                                    setDraft(selected);
                                }
                            }}
                        />

                        <View style={s.actions}>
                            {allowClear ? (
                                <Pressable
                                    style={[s.actionBtn, { borderColor: colors.border }]}
                                    onPress={() => {
                                        onChange(null);
                                        setOpen(false);
                                    }}
                                >
                                    <Text style={[s.actionText, { color: colors.error }]}>Clear</Text>
                                </Pressable>
                            ) : null}
                            <Pressable
                                style={[s.actionBtn, { borderColor: colors.border }]}
                                onPress={() => setOpen(false)}
                            >
                                <Text style={[s.actionText, { color: colors.textSecondary }]}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[s.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                onPress={applyValue}
                            >
                                <Text style={[s.actionText, { color: colors.onPrimary }]}>Apply</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
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
            justifyContent: 'flex-end',
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: withAlpha(colors.text, '88'),
        },
        sheet: {
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderBottomWidth: 0,
            backgroundColor: colors.card,
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: Spacing.xl,
            gap: Spacing.md,
            shadowColor: colors.text,
            shadowOpacity: 0.08,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: -8 },
            elevation: 10,
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
        actions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: Spacing.sm,
        },
        actionBtn: {
            minWidth: 72,
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            alignItems: 'center',
        },
        actionText: {
            fontSize: Typography.body.size,
            fontWeight: '700',
        },
    });
