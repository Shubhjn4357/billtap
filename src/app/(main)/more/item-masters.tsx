import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toUserMessage } from '../../../api/client';
import { settingsApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';
import {
    DEFAULT_ITEM_CATEGORIES,
    DEFAULT_ITEM_UNITS,
    getCustomItemCategories,
    getCustomItemUnits,
    withCustomItemCategories,
    withCustomItemUnits,
} from '../../../utils/itemMasters';

const unique = (values: string[]) => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const raw of values) {
        const value = raw.trim();
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(value);
    }

    return result;
};

export default function ItemMastersScreen() {
    const { focus } = useLocalSearchParams<{ focus?: string }>();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const queryClient = useQueryClient();

    const [newCategory, setNewCategory] = useState('');
    const [newUnit, setNewUnit] = useState('');
    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [customUnits, setCustomUnits] = useState<string[]>([]);

    const { data, isLoading } = useQuery({
        queryKey: ['settings-section', 'ITEM_SETTINGS'],
        queryFn: () => settingsApi.get('ITEM_SETTINGS'),
    });

    const itemSettings = useMemo(
        () => (data?.data ?? {}) as Record<string, unknown>,
        [data?.data]
    );

    useEffect(() => {
        setCustomCategories(getCustomItemCategories(itemSettings));
        setCustomUnits(getCustomItemUnits(itemSettings));
    }, [itemSettings]);

    const mergedCategoryCount = useMemo(
        () => unique([...DEFAULT_ITEM_CATEGORIES, ...customCategories]).length,
        [customCategories]
    );
    const mergedUnitCount = useMemo(
        () => unique([...DEFAULT_ITEM_UNITS, ...customUnits]).length,
        [customUnits]
    );

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            let next: Record<string, unknown> = withCustomItemCategories(itemSettings, customCategories);
            next = withCustomItemUnits(next, customUnits);
            return settingsApi.update('ITEM_SETTINGS', { data: next });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['settings-section', 'ITEM_SETTINGS'] });
            Alert.alert('Saved', 'Item categories and units updated.');
        },
        onError: (error) => {
            Alert.alert('Save failed', toUserMessage(error, 'Unable to save item masters.'));
        },
    });

    const addCategory = () => {
        const value = newCategory.trim();
        if (!value) return;
        setCustomCategories((current) => unique([...current, value]));
        setNewCategory('');
    };

    const addUnit = () => {
        const value = newUnit.trim();
        if (!value) return;
        setCustomUnits((current) => unique([...current, value]));
        setNewUnit('');
    };

    const removeCategory = (value: string) => {
        setCustomCategories((current) => current.filter((entry) => entry.toLowerCase() !== value.toLowerCase()));
    };

    const removeUnit = (value: string) => {
        setCustomUnits((current) => current.filter((entry) => entry.toLowerCase() !== value.toLowerCase()));
    };

    if (isLoading) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Item Masters</Text>
                <Pressable onPress={() => save()} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.save, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.content}>
                <View style={[s.card, focus === 'categories' ? s.focusedCard : null]}>
                    <Text style={s.cardTitle}>Categories</Text>
                    <Text style={s.meta}>
                        Preset: {DEFAULT_ITEM_CATEGORIES.length} | Total available: {mergedCategoryCount}
                    </Text>
                    <View style={s.inputRow}>
                        <TextInput
                            style={[s.input, { borderColor: colors.border, color: colors.text }]}
                            value={newCategory}
                            onChangeText={setNewCategory}
                            placeholder="Add custom category"
                            placeholderTextColor={colors.textSecondary}
                        />
                        <Pressable style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={addCategory}>
                            <Text style={s.addBtnText}>Add</Text>
                        </Pressable>
                    </View>
                    <View style={s.tagsWrap}>
                        {customCategories.length === 0 ? (
                            <Text style={s.emptyText}>No custom categories yet.</Text>
                        ) : (
                            customCategories.map((entry) => (
                                <Pressable
                                    key={entry}
                                    style={[s.tag, { backgroundColor: colors.surfaceVariant }]}
                                    onPress={() => removeCategory(entry)}
                                >
                                    <Text style={[s.tagText, { color: colors.text }]}>{entry} x</Text>
                                </Pressable>
                            ))
                        )}
                    </View>
                </View>

                <View style={[s.card, focus === 'units' ? s.focusedCard : null]}>
                    <Text style={s.cardTitle}>Units</Text>
                    <Text style={s.meta}>
                        Preset: {DEFAULT_ITEM_UNITS.length} | Total available: {mergedUnitCount}
                    </Text>
                    <View style={s.inputRow}>
                        <TextInput
                            style={[s.input, { borderColor: colors.border, color: colors.text }]}
                            value={newUnit}
                            onChangeText={setNewUnit}
                            placeholder="Add custom unit"
                            placeholderTextColor={colors.textSecondary}
                        />
                        <Pressable style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={addUnit}>
                            <Text style={s.addBtnText}>Add</Text>
                        </Pressable>
                    </View>
                    <View style={s.tagsWrap}>
                        {customUnits.length === 0 ? (
                            <Text style={s.emptyText}>No custom units yet.</Text>
                        ) : (
                            customUnits.map((entry) => (
                                <Pressable
                                    key={entry}
                                    style={[s.tag, { backgroundColor: colors.surfaceVariant }]}
                                    onPress={() => removeUnit(entry)}
                                >
                                    <Text style={[s.tagText, { color: colors.text }]}>{entry} x</Text>
                                </Pressable>
                            ))
                        )}
                    </View>
                </View>
                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        back: { fontWeight: '600', fontSize: 14 },
        title: {
            fontSize: Typography.title.size,
            fontWeight: '700',
            color: colors.text,
        },
        save: { fontSize: 14, fontWeight: '700' },
        content: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
        card: {
            backgroundColor: colors.card,
            borderRadius: Radius.card,
            padding: Spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            gap: Spacing.sm,
        },
        focusedCard: {
            borderColor: colors.primary,
            borderWidth: 2,
        },
        cardTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
        },
        meta: {
            fontSize: 12,
            color: colors.textSecondary,
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        input: {
            flex: 1,
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            fontSize: 14,
        },
        addBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            minWidth: 72,
            alignItems: 'center',
        },
        addBtnText: {
            color: '#fff',
            fontWeight: '700',
            fontSize: 12,
        },
        tagsWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.xs,
        },
        tag: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        tagText: {
            fontSize: 12,
            fontWeight: '600',
        },
        emptyText: {
            fontSize: 12,
            color: colors.textSecondary,
        },
    });
