import { useState } from 'react';
import {
    ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useSmartBack } from '../../../hooks/useSmartBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { usePartyMutations } from '../../../hooks/usePartyMutations';
import { usePartyRecycleBin } from '../../../hooks/useParties';

export default function PartyRecycleBinScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/parties');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { restoreParty, permanentlyDeleteParty } = usePartyMutations();

    const { parties: rows, isLoading, isRefetching, refetch } = usePartyRecycleBin({ limit: 250 });

    const confirmRestore = (id: string) => {
        dialog.alert('Restore party', 'Move this party back to active list?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Restore',
                onPress: async () => {
                    try {
                        setProcessingId(id);
                        await restoreParty(id);
                    } catch (error) {
                        dialog.alert('Restore failed', error instanceof Error ? error.message : 'Unable to restore party.');
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
                        await permanentlyDeleteParty(id);
                    } catch (error) {
                        dialog.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete party.');
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
                title="Party Recycle Bin"
                subtitle="Restore or delete permanently"
                onBackPress={smartBack}
            />

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={rows}
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
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    renderItem={({ item }) => {
                        const busy = processingId === item.id;
                        return (
                            <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.rowTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]}>{item.type} | {item.phone ?? item.email ?? 'No contact'}</Text>
                                    {item.gstin ? <Text style={[s.rowMeta, { color: colors.textSecondary }]}>GSTIN: {item.gstin}</Text> : null}
                                </View>
                                <View style={s.actions}>
                                    <Pressable style={[s.actionBtn, { borderColor: colors.primary }]} onPress={() => confirmRestore(item.id)} disabled={busy}>
                                        <MaterialCommunityIcons name="backup-restore" size={16} color={colors.primary} />
                                    </Pressable>
                                    <Pressable style={[s.actionBtn, { borderColor: colors.error }]} onPress={() => confirmPermanentDelete(item.id)} disabled={busy}>
                                        <MaterialCommunityIcons name="delete-forever-outline" size={16} color={colors.error} />
                                    </Pressable>
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Text style={{ color: colors.textSecondary }}>No deleted parties.</Text>
                        </View>
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
            borderWidth: 1,
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
            borderWidth: 1,
            borderRadius: Radius.pill,
            width: 34,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
        },
    });
