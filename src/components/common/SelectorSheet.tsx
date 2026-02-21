import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { Text, useTheme, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DesignSystem } from '../../constants/DesignSystem';
import { COMMON_TEXT } from '../../constants/staticText';

export interface SelectorOption {
    key: string;
    label: string;
    /** Optional emoji or icon string displayed before label */
    prefix?: string;
    /** Optional short abbreviation shown on right side */
    abbr?: string;
}

interface SelectorSheetProps {
    visible: boolean;
    onDismiss: () => void;
    onSelect: (option: SelectorOption) => void;
    onSelectCustom?: (customValue: string) => void;
    /** Options list */
    options: SelectorOption[];
    /** Currently selected key */
    selectedKey?: string;
    title: string;
    /** Allow user to add a custom value not in the list */
    allowCustom?: boolean;
    customPlaceholder?: string;
    searchPlaceholder?: string;
}

export const SelectorSheet: React.FC<SelectorSheetProps> = ({
    visible,
    onDismiss,
    onSelect,
    onSelectCustom,
    options,
    selectedKey,
    title,
    allowCustom = true,
    customPlaceholder = 'Enter custom value...',
    searchPlaceholder = 'Search...',
}) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();
    const [query, setQuery] = useState('');
    const [customMode, setCustomMode] = useState(false);
    const [customValue, setCustomValue] = useState('');
    const slideAnim = useRef(new Animated.Value(300)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    const filtered = query.trim()
        ? options.filter((o) =>
            o.label.toLowerCase().includes(query.toLowerCase()) ||
            (o.abbr?.toLowerCase().includes(query.toLowerCase()))
        )
        : options;

    const handleShow = useCallback(() => {
        Animated.parallel([
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
    }, [slideAnim, opacityAnim]);

    const handleHide = useCallback((cb?: () => void) => {
        Animated.parallel([
            Animated.spring(slideAnim, { toValue: 400, useNativeDriver: true, tension: 70, friction: 12 }),
            Animated.timing(opacityAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]).start(() => cb?.());
    }, [slideAnim, opacityAnim]);

    const dismiss = () => {
        handleHide(() => {
            setQuery('');
            setCustomMode(false);
            setCustomValue('');
            onDismiss();
        });
    };

    const selectOption = (opt: SelectorOption) => {
        dismiss();
        setTimeout(() => onSelect(opt), 120);
    };

    const submitCustom = () => {
        if (!customValue.trim()) return;
        dismiss();
        setTimeout(() => onSelectCustom?.(customValue.trim()), 120);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={dismiss}
            onShow={handleShow}
            statusBarTranslucent={Platform.OS === 'android'}
        >
            {/* Backdrop */}
            <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
            </Animated.View>

            {/* Sheet */}
            <Animated.View
                style={[
                    styles.sheet,
                    {
                        backgroundColor: theme.colors.surface,
                        maxHeight: screenHeight * 0.75,
                        paddingBottom: insets.bottom + DesignSystem.spacing.md,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                {/* Handle bar */}
                <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />

                {/* Title */}
                <Text
                    variant="titleMedium"
                    style={[styles.sheetTitle, { color: theme.colors.onSurface }]}
                >
                    {title}
                </Text>
                <Divider />

                {/* Search */}
                <View
                    style={[
                        styles.searchRow,
                        {
                            backgroundColor: theme.colors.surfaceVariant,
                            borderColor: theme.colors.outlineVariant,
                        },
                    ]}
                >
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder={searchPlaceholder}
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                        style={[styles.searchInput, { color: theme.colors.onSurface }]}
                        returnKeyType="search"
                    />
                </View>

                {/* Custom mode */}
                {customMode ? (
                    <View style={styles.customRow}>
                        <TextInput
                            value={customValue}
                            onChangeText={setCustomValue}
                            placeholder={customPlaceholder}
                            placeholderTextColor={theme.colors.onSurfaceVariant}
                            style={[
                                styles.customInput,
                                {
                                    color: theme.colors.onSurface,
                                    borderColor: theme.colors.primary,
                                    backgroundColor: theme.colors.surfaceVariant,
                                },
                            ]}
                            autoFocus
                            returnKeyType="done"
                            onSubmitEditing={submitCustom}
                        />
                        <Pressable
                            onPress={submitCustom}
                            style={[styles.customBtn, { backgroundColor: theme.colors.primary }]}
                        >
                            <Text style={{ color: theme.colors.onPrimary, fontWeight: '600' }}>Add</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setCustomMode(false)}
                            style={[styles.customCancelBtn, { borderColor: theme.colors.outline }]}
                        >
                            <Text style={{ color: theme.colors.onSurfaceVariant }}>{COMMON_TEXT.actions.cancel}</Text>
                        </Pressable>
                    </View>
                ) : null}

                {/* Options list */}
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.key}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                        const isSelected = item.key === selectedKey;
                        return (
                            <Pressable
                                onPress={() => selectOption(item)}
                                style={[
                                    styles.optionRow,
                                    isSelected && {
                                        backgroundColor: theme.colors.primaryContainer,
                                    },
                                ]}
                            >
                                {item.prefix ? (
                                    <Text style={styles.optionPrefix}>{item.prefix}</Text>
                                ) : null}
                                <Text
                                    style={[
                                        styles.optionLabel,
                                        {
                                            color: isSelected
                                                ? theme.colors.onPrimaryContainer
                                                : theme.colors.onSurface,
                                            fontWeight: isSelected ? '600' : '400',
                                        },
                                    ]}
                                >
                                    {item.label}
                                </Text>
                                {item.abbr ? (
                                    <Text
                                        style={[
                                            styles.optionAbbr,
                                            { color: theme.colors.onSurfaceVariant },
                                        ]}
                                    >
                                        {item.abbr}
                                    </Text>
                                ) : null}
                                {isSelected ? (
                                    <Text style={{ color: theme.colors.primary, marginLeft: 4 }}>✓</Text>
                                ) : null}
                            </Pressable>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyRow}>
                            <Text style={{ color: theme.colors.onSurfaceVariant }}>No results</Text>
                        </View>
                    }
                    ListFooterComponent={
                        allowCustom && !customMode ? (
                            <>
                                <Divider />
                                <Pressable
                                    onPress={() => setCustomMode(true)}
                                    style={styles.optionRow}
                                >
                                    <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                                        + Add Custom...
                                    </Text>
                                </Pressable>
                            </>
                        ) : null
                    }
                />
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: DesignSystem.radius.xxl,
        borderTopRightRadius: DesignSystem.radius.xxl,
        overflow: 'hidden',
        ...DesignSystem.shadow.modal,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: DesignSystem.spacing.sm,
        marginBottom: DesignSystem.spacing.xs,
    },
    sheetTitle: {
        fontWeight: '700',
        paddingHorizontal: DesignSystem.spacing.xl,
        paddingVertical: DesignSystem.spacing.sm,
    },
    searchRow: {
        margin: DesignSystem.spacing.md,
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
        paddingHorizontal: DesignSystem.spacing.md,
        paddingVertical: Platform.OS === 'ios' ? DesignSystem.spacing.sm : 2,
    },
    searchInput: {
        fontSize: 15,
        height: 36,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: DesignSystem.spacing.md,
        paddingHorizontal: DesignSystem.spacing.xl,
        gap: DesignSystem.spacing.sm,
    },
    optionPrefix: {
        fontSize: 20,
        width: 28,
    },
    optionLabel: {
        fontSize: 15,
        flex: 1,
    },
    optionAbbr: {
        fontSize: 12,
        minWidth: 36,
        textAlign: 'right',
    },
    emptyRow: {
        padding: DesignSystem.spacing.xl,
        alignItems: 'center',
    },
    customRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: DesignSystem.spacing.md,
        paddingBottom: DesignSystem.spacing.sm,
        gap: DesignSystem.spacing.xs,
    },
    customInput: {
        flex: 1,
        borderWidth: 1.5,
        borderRadius: DesignSystem.radius.md,
        paddingHorizontal: DesignSystem.spacing.md,
        paddingVertical: DesignSystem.spacing.sm,
        fontSize: 15,
    },
    customBtn: {
        paddingHorizontal: DesignSystem.spacing.md,
        paddingVertical: DesignSystem.spacing.sm,
        borderRadius: DesignSystem.radius.md,
    },
    customCancelBtn: {
        paddingHorizontal: DesignSystem.spacing.md,
        paddingVertical: DesignSystem.spacing.sm,
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
    },
});
