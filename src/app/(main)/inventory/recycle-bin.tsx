import { useState } from 'react';
import {
    ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useSmartBack } from '../../../hooks/useSmartBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { EmptyStateCard } from '../../../components/ui/ListBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useInventoryMutations } from '../../../hooks/useInventoryMutations';
import { useItemRecycleBin } from '../../../hooks/useInventory';

export default function ItemRecycleBinScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/inventory');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { items: entries, isLoading, isRefetching, refetch } = useItemRecycleBin({ limit: 250 });

    const { restoreItem, permanentlyDeleteItem } = useInventoryMutations();

    const confirmRestore = (id: string) => {
        dialog.alert('Restore item', 'Move this item back to active inventory?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Restore',
                onPress: async () => {
                    try {
                        setProcessingId(id);
                        await restoreItem(id);
                    } catch (error) {
                        dialog.alert('Restore failed', error instanceof Error ? error.message : 'Unable to restore item.');
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    const confirmPermanentDelete = (id: string) => {
        dialog.alert('Delete permanently', 'This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        setProcessingId(id);
                        await permanentlyDeleteItem(id);
                    } catch (error) {
                        dialog.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete item.');
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Item Recycle Bin"
                subtitle="Restore or delete permanently"
                onBackPress={smartBack}
            />

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.id}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                refetch();
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: 120 }}
                    renderItem={({ item }) => {
                        const busy = processingId === item.id;
                        return (
                            <View style={[s.row, getSurfaceStyle(colors, { elevated: true })]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.rowTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]}>
                                        {item.sku ? `SKU: ${item.sku} | ` : ''}{item.unit ?? 'unit'} | GST {item.gstRate}%
                                    </Text>
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]}>
                                        Stock: {item.stock} | Rate: Rs {Number(item.salePrice ?? 0).toLocaleString('en-IN')}
                                    </Text>
                                </View>
                                <View style={s.actions}>
                                    <Pressable style={[s.actionBtn, { ...getPillStyle(colors, colors.primary) }]} onPress={() => confirmRestore(item.id)} disabled={busy}>
                                        <MaterialCommunityIcons name="backup-restore" size={16} color={colors.primary} />
                                    </Pressable>
                                    <Pressable style={[s.actionBtn, { ...getPillStyle(colors, colors.error) }]} onPress={() => confirmPermanentDelete(item.id)} disabled={busy}>
                                        <MaterialCommunityIcons name="delete-forever-outline" size={16} color={colors.error} />
                                    </Pressable>
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <EmptyStateCard
                            icon="package-variant-remove"
                            title="No deleted items"
                            subtitle="Archived inventory items will appear here until they are restored or permanently deleted."
                            tone="warning"
                        />
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 120 },
        row: {
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            gap: Spacing.sm,
        },
        rowTitle: { fontSize: 14, fontWeight: '700' },
        rowMeta: { fontSize: 11, marginTop: 2 },
        actions: { gap: 6, justifyContent: 'center' },
        actionBtn: {
            borderRadius: Radius.pill,
            width: 34,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
        },
    });
