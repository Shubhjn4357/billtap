import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { partyApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';
import type { Party } from '../../../types/domain';

export default function PartyRecycleBinScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const queryClient = useQueryClient();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['parties-recycle-bin'],
        queryFn: () => partyApi.recycleBin({ limit: 250 }),
        staleTime: 15_000,
    });

    const rows: Party[] = data?.data ?? [];

    const { mutateAsync: restore } = useMutation({
        mutationFn: (id: string) => partyApi.restore(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['parties'] });
            queryClient.invalidateQueries({ queryKey: ['parties-recycle-bin'] });
        },
    });

    const { mutateAsync: permanentDelete } = useMutation({
        mutationFn: (id: string) => partyApi.permanentDelete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['parties'] });
            queryClient.invalidateQueries({ queryKey: ['parties-recycle-bin'] });
        },
    });

    const confirmRestore = (id: string) => {
        Alert.alert('Restore party', 'Move this party back to active list?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Restore',
                onPress: async () => {
                    try {
                        setProcessingId(id);
                        await restore(id);
                    } catch (error) {
                        Alert.alert('Restore failed', error instanceof Error ? error.message : 'Unable to restore party.');
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    const confirmPermanentDelete = (id: string) => {
        Alert.alert('Delete permanently', 'This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        setProcessingId(id);
                        await permanentDelete(id);
                    } catch (error) {
                        Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete party.');
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.backText, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Party Recycle Bin</Text>
                <View style={{ width: 44 }} />
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    renderItem={({ item }) => {
                        const busy = processingId === item.id;
                        return (
                            <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.rowTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]}>
                                        {item.type} | {item.phone ?? item.email ?? 'No contact'}
                                    </Text>
                                    {item.gstin ? (
                                        <Text style={[s.rowMeta, { color: colors.textSecondary }]}>GSTIN: {item.gstin}</Text>
                                    ) : null}
                                </View>
                                <View style={s.actions}>
                                    <Pressable style={[s.actionBtn, { borderColor: colors.primary }]} onPress={() => confirmRestore(item.id)} disabled={busy}>
                                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Restore</Text>
                                    </Pressable>
                                    <Pressable style={[s.actionBtn, { borderColor: colors.error }]} onPress={() => confirmPermanentDelete(item.id)} disabled={busy}>
                                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 12 }}>Delete</Text>
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
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        backText: { fontSize: 14, fontWeight: '700' },
        title: { fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
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
            paddingHorizontal: Spacing.sm,
            paddingVertical: 5,
            alignItems: 'center',
        },
    });
