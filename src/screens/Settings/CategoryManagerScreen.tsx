import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Keyboard,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Text, useTheme, IconButton, Divider } from 'react-native-paper';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppButton } from '../../components/common/AppButton';
import { EmptyState } from '../../components/common/EmptyState';
import { DesignSystem } from '../../constants/DesignSystem';
import { PREDEFINED_CATEGORIES, type CategoryOption } from '../../constants/categories';
import { apiClient } from '../../api/httpClient';

interface CustomCategory {
    id: string;
    name: string;
    emoji: string;
    organizationId: string;
    isActive: boolean;
    createdAt: string;
}

const EMOJI_OPTIONS = ['📦', '🛒', '🏪', '🏭', '🧪', '🎨', '🍕', '🛠️', '🪴', '🎁', '💡', '🧵'];

export const CategoryManagerScreen = () => {
    const theme = useTheme();
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
    const [newName, setNewName] = useState('');
    const [selectedEmoji, setSelectedEmoji] = useState('📦');
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<{
                ok: boolean;
                categories: CustomCategory[];
            }>('/organizations/categories');
            if (response.ok) {
                setCustomCategories(response.categories);
            }
        } catch {
            // Silently fail — user sees empty list
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed) return;

        // Check if name clashes with predefined categories
        const clashPredefined = PREDEFINED_CATEGORIES.some(
            (c) => c.label.toLowerCase() === trimmed.toLowerCase()
        );
        if (clashPredefined) {
            Alert.alert('Duplicate', 'This name matches a built-in category.');
            return;
        }

        // Check if name clashes with existing custom categories
        const clashCustom = customCategories.some(
            (c) => c.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (clashCustom) {
            Alert.alert('Duplicate', 'A custom category with this name already exists.');
            return;
        }

        setCreating(true);
        try {
            const response = await apiClient.post<{
                ok: boolean;
                id: string;
                name: string;
                emoji: string;
                message?: string;
            }>('/organizations/categories', { name: trimmed, emoji: selectedEmoji });

            if (response.ok) {
                setNewName('');
                setSelectedEmoji('📦');
                Keyboard.dismiss();
                await fetchCategories();
            } else {
                Alert.alert('Error', response.message ?? 'Failed to create category.');
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Failed to create category.';
            Alert.alert('Error', msg);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = (category: CustomCategory) => {
        const onConfirm = async () => {
            setDeletingId(category.id);
            try {
                await apiClient.delete(`/organizations/categories/${category.id}`);
                setCustomCategories((prev) => prev.filter((c) => c.id !== category.id));
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Failed to delete category.';
                Alert.alert('Error', msg);
            } finally {
                setDeletingId(null);
            }
        };

        if (Platform.OS === 'web') {
            if (confirm(`Delete "${category.name}"?`)) {
                onConfirm();
            }
        } else {
            Alert.alert(
                'Delete Category',
                `Are you sure you want to delete "${category.name}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: onConfirm },
                ]
            );
        }
    };

    const renderPredefined = ({ item }: { item: CategoryOption }) => (
        <View style={[styles.categoryRow, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={styles.categoryEmoji}>{item.emoji}</Text>
            <Text style={[styles.categoryName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {item.label}
            </Text>
            <Text style={[styles.builtInBadge, { color: theme.colors.onSurfaceVariant }]}>Built-in</Text>
        </View>
    );

    const renderCustom = ({ item }: { item: CustomCategory }) => (
        <View style={[styles.categoryRow, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.categoryEmoji}>{item.emoji}</Text>
            <Text style={[styles.categoryName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {item.name}
            </Text>
            <IconButton
                icon="delete-outline"
                size={20}
                iconColor={theme.colors.error}
                onPress={() => handleDelete(item)}
                disabled={deletingId === item.id}
            />
        </View>
    );

    return (
        <ScreenWrapper>
            <FlatList
                data={[]}
                renderItem={null}
                keyExtractor={() => 'header'}
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                    <>
                        {/* Add new category form */}
                        <Text
                            variant="titleMedium"
                            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
                        >
                            Add Custom Category
                        </Text>

                        <View style={[styles.formCard, { backgroundColor: theme.colors.surface }]}>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        color: theme.colors.onSurface,
                                        borderColor: theme.colors.outline,
                                        backgroundColor: theme.colors.surfaceVariant,
                                    },
                                ]}
                                placeholder="Category name"
                                placeholderTextColor={theme.colors.onSurfaceVariant}
                                value={newName}
                                onChangeText={setNewName}
                                maxLength={100}
                                returnKeyType="done"
                                onSubmitEditing={handleCreate}
                            />

                            <Text
                                variant="bodySmall"
                                style={[styles.emojiLabel, { color: theme.colors.onSurfaceVariant }]}
                            >
                                Pick an icon
                            </Text>

                            <View style={styles.emojiRow}>
                                {EMOJI_OPTIONS.map((emoji) => (
                                    <Pressable
                                        key={emoji}
                                        style={[
                                            styles.emojiButton,
                                            selectedEmoji === emoji && {
                                                backgroundColor: theme.colors.primaryContainer,
                                                borderColor: theme.colors.primary,
                                            },
                                        ]}
                                        onPress={() => setSelectedEmoji(emoji)}
                                    >
                                        <Text style={styles.emojiText}>{emoji}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            <AppButton
                                onPress={handleCreate}
                                disabled={!newName.trim() || creating}
                                style={styles.addButton}
                            >
                                {creating ? 'Adding...' : 'Add Category'}
                            </AppButton>
                        </View>

                        <Divider style={styles.divider} />

                        {/* Custom Categories */}
                        <Text
                            variant="titleMedium"
                            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
                        >
                            Your Custom Categories ({customCategories.length})
                        </Text>

                        {customCategories.length === 0 && !loading && (
                            <EmptyState
                                emoji="🏷️"
                                title="No custom categories yet"
                                subtitle="Add your first custom category above"
                            />
                        )}

                        {customCategories.map((item) => (
                            <React.Fragment key={item.id}>
                                {renderCustom({ item })}
                            </React.Fragment>
                        ))}

                        <Divider style={styles.divider} />

                        {/* Predefined Categories */}
                        <Text
                            variant="titleMedium"
                            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
                        >
                            Built-in Categories ({PREDEFINED_CATEGORIES.length})
                        </Text>

                        {PREDEFINED_CATEGORIES.map((item) => (
                            <React.Fragment key={item.key}>
                                {renderPredefined({ item })}
                            </React.Fragment>
                        ))}

                        <View style={styles.bottomSpacer} />
                    </>
                }
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: DesignSystem.spacing.md,
        paddingBottom: DesignSystem.spacing.xxxl,
    },
    sectionTitle: {
        fontWeight: '600',
        marginTop: DesignSystem.spacing.lg,
        marginBottom: DesignSystem.spacing.sm,
    },
    formCard: {
        borderRadius: DesignSystem.radius.lg,
        padding: DesignSystem.spacing.md,
        ...DesignSystem.shadow.card,
    },
    input: {
        borderWidth: 1,
        borderRadius: DesignSystem.radius.md,
        paddingHorizontal: DesignSystem.spacing.md,
        paddingVertical: DesignSystem.spacing.sm,
        fontSize: 15,
    },
    emojiLabel: {
        marginTop: DesignSystem.spacing.sm,
        marginBottom: DesignSystem.spacing.xs,
    },
    emojiRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
    },
    emojiButton: {
        width: 40,
        height: 40,
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1.5,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiText: {
        fontSize: 20,
    },
    addButton: {
        marginTop: DesignSystem.spacing.md,
    },
    divider: {
        marginVertical: DesignSystem.spacing.lg,
    },
    categoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: DesignSystem.spacing.md,
        paddingVertical: DesignSystem.spacing.sm,
        borderRadius: DesignSystem.radius.md,
        marginBottom: DesignSystem.spacing.xs,
    },
    categoryEmoji: {
        fontSize: 20,
        marginRight: DesignSystem.spacing.sm,
    },
    categoryName: {
        flex: 1,
        fontSize: 15,
    },
    builtInBadge: {
        fontSize: 12,
        opacity: 0.6,
    },
    bottomSpacer: {
        height: 40,
    },
});
