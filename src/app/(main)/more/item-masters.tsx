import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { toUserMessage } from '../../../api/client';
import { SettingsSection } from '../../../constants/enums';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { useSettingsSelector } from '../../../hooks/useSettingsSelector';
import { selectItemSettings } from '../../../selectors/settingsSelectors';
import {
    DEFAULT_ITEM_CATEGORIES,
    DEFAULT_ITEM_UNITS,
    withCustomItemCategories,
    withCustomItemUnits,
} from '../../../utils/itemMasters';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { settingsSectionQueryKey } from '../../../state/settingsQueryKeys';
import { useSettingsSectionMutation } from '../../../hooks/useSettingsSectionMutation';

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
    const dialog = useAppDialog();
    const { focus } = useLocalSearchParams<{ focus?: string }>();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
    const queryClient = useQueryClient();

    const [newCategory, setNewCategory] = useState('');
    const [newUnit, setNewUnit] = useState('');
    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [customUnits, setCustomUnits] = useState<string[]>([]);

    const { sectionData: itemSettings, selected: itemSettingsView, isLoading, isRefetching, refetch } = useSettingsSelector(
        SettingsSection.ITEM_SETTINGS,
        selectItemSettings
    );

    useEffect(() => {
        setCustomCategories(itemSettingsView.customCategories);
        setCustomUnits(itemSettingsView.customUnits);
    }, [itemSettingsView.customCategories, itemSettingsView.customUnits]);

    const mergedCategoryCount = useMemo(
        () => unique([...DEFAULT_ITEM_CATEGORIES, ...customCategories]).length,
        [customCategories]
    );
    const mergedUnitCount = useMemo(
        () => unique([...DEFAULT_ITEM_UNITS, ...customUnits]).length,
        [customUnits]
    );

    const { mutate: save, isPending } = useSettingsSectionMutation('ITEM_SETTINGS', {
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: settingsSectionQueryKey('ITEM_SETTINGS') });
            dialog.alert('Saved', 'Item categories and units updated.');
        },
        onError: (error) => {
            dialog.alert('Save failed', toUserMessage(error, 'Unable to save item masters.'));
        },
    });

    const saveItemMasters = () => {
        let next: Record<string, unknown> = withCustomItemCategories(itemSettings, customCategories);
        next = withCustomItemUnits(next, customUnits);
        save(next);
    };

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
                <AppTopBar title="Item Masters" onBackPress={smartBack} />
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Item Masters"
                subtitle="Categories and units"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={saveItemMasters} disabled={isPending}>
                        {isPending ? (
                            <ActivityIndicator size="small" color={colors.onPrimary} />
                        ) : (
                            <MaterialCommunityIcons name="content-save-outline" size={16} color={colors.onPrimary} />
                        )}
                    </Pressable>
                )}
            />

            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefetching}
                        onRefresh={() => {
                            refetch();
                        }}
                    />
                )}
            >
                <View style={[s.card, focus === 'categories' ? s.focusedCard : null]}>
                    <Text style={s.cardTitle}>Categories</Text>
                    <Text style={s.meta}>
                        Preset: {DEFAULT_ITEM_CATEGORIES.length} | Total available: {mergedCategoryCount}
                    </Text>
                    <View style={s.inputRow}>
                        <AppInput
                            inputType="text"
                            value={newCategory}
                            onChangeText={setNewCategory}
                            placeholder="Add custom category"
                            containerStyle={s.inputWrap}
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
                        <AppInput
                            inputType="text"
                            value={newUnit}
                            onChangeText={setNewUnit}
                            placeholder="Add custom unit"
                            containerStyle={s.inputWrap}
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
        saveBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 7,
            alignItems: 'center',
            minWidth: 44,
            justifyContent: 'center',
        },
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
        inputWrap: { flex: 1 },
        addBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            minWidth: 72,
            alignItems: 'center',
        },
        addBtnText: {
            color: colors.onPrimary,
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
