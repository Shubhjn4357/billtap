import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../api/endpoints';
import { offlineSyncService } from '../../../services/offlineSyncService';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';

type QueueEntry = {
    id: string;
    type: string;
    createdAt: string;
    attemptCount: number;
    lastAttemptAt?: string;
    lastError?: string;
    nextRetryAt?: number;
};

const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-IN');
};

const formatRetryAt = (value?: number) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-IN');
};

export default function SyncDiagnosticsScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const qc = useQueryClient();

    const [intervalInput, setIntervalInput] = useState('60');

    const { data: queueData, isLoading: queueLoading, refetch } = useQuery({
        queryKey: ['offline-sync-queue'],
        queryFn: async () => {
            const [queue, stats] = await Promise.all([
                offlineSyncService.getQueue(),
                offlineSyncService.getQueueStats(),
            ]);
            return { queue: queue as QueueEntry[], stats };
        },
        staleTime: 15_000,
    });

    const { data: generalSettings } = useQuery({
        queryKey: ['settings-section', 'GENERAL'],
        queryFn: () => settingsApi.get('GENERAL'),
        staleTime: 30_000,
    });

    const settingsData = (generalSettings?.data ?? {}) as Record<string, unknown>;
    const conflictPolicy = typeof settingsData.sync_conflict_policy === 'string'
        ? settingsData.sync_conflict_policy
        : 'LAST_WRITE_WINS';

    const queue = queueData?.queue ?? [];
    const stats = queueData?.stats ?? { pendingCount: 0, oldestCreatedAt: null as string | null };

    const storageBackend = useMemo(() => offlineSyncService.getStorageBackend(), []);

    const { mutate: flushNow, isPending: flushing } = useMutation({
        mutationFn: () => offlineSyncService.flushQueue(),
        onSuccess: async (result) => {
            await refetch();
            Alert.alert('Sync complete', `Processed: ${result.processed}, Remaining: ${result.remaining}`);
        },
        onError: (error) => {
            Alert.alert('Sync failed', error instanceof Error ? error.message : 'Unable to flush queue.');
        },
    });

    const { mutate: savePolicy, isPending: savingPolicy } = useMutation({
        mutationFn: async (policy: 'LAST_WRITE_WINS' | 'SERVER_WINS') => {
            const payload = {
                ...settingsData,
                sync_conflict_policy: policy,
            };
            return settingsApi.update('GENERAL', { data: payload });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['settings-section', 'GENERAL'] });
        },
    });

    const { mutate: saveInterval, isPending: savingInterval } = useMutation({
        mutationFn: async () => {
            const interval = Number(intervalInput);
            if (!Number.isFinite(interval) || interval < 15 || interval > 3600) {
                throw new Error('Auto sync interval must be between 15 and 3600 seconds.');
            }
            const payload = {
                ...settingsData,
                sync_auto_interval_sec: Math.round(interval),
            };
            return settingsApi.update('GENERAL', { data: payload });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['settings-section', 'GENERAL'] });
            Alert.alert('Saved', 'Auto sync interval updated.');
        },
        onError: (error) => {
            Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save interval.');
        },
    });

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Sync Diagnostics</Text>
                <View style={{ width: 44 }} />
            </View>

            {queueLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={queue}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <>
                            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                                <Text style={s.cardTitle}>Queue Overview</Text>
                                <Text style={s.cardLine}>Storage: {storageBackend}</Text>
                                <Text style={s.cardLine}>Pending: {stats.pendingCount}</Text>
                                <Text style={s.cardLine}>Oldest: {formatDate(stats.oldestCreatedAt ?? undefined)}</Text>
                                <View style={s.actionRow}>
                                    <Pressable style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={() => flushNow()} disabled={flushing}>
                                        <Text style={s.actionBtnText}>{flushing ? 'Syncing...' : 'Flush Now'}</Text>
                                    </Pressable>
                                    <Pressable style={[s.actionBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => refetch()}>
                                        <Text style={[s.actionBtnText, { color: colors.text }]}>Refresh</Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                                <Text style={s.cardTitle}>Conflict Resolution</Text>
                                <View style={s.optionRow}>
                                    <Pressable
                                        style={[s.optionChip, conflictPolicy === 'LAST_WRITE_WINS' && { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}
                                        onPress={() => savePolicy('LAST_WRITE_WINS')}
                                        disabled={savingPolicy}
                                    >
                                        <Text style={s.optionText}>Last Write Wins</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[s.optionChip, conflictPolicy === 'SERVER_WINS' && { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}
                                        onPress={() => savePolicy('SERVER_WINS')}
                                        disabled={savingPolicy}
                                    >
                                        <Text style={s.optionText}>Server Wins</Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                                <Text style={s.cardTitle}>Auto Sync Interval (seconds)</Text>
                                <TextInput
                                    style={[s.input, { borderColor: colors.border, color: colors.text }]}
                                    keyboardType="numeric"
                                    value={intervalInput}
                                    onChangeText={setIntervalInput}
                                    placeholder="60"
                                    placeholderTextColor={colors.textSecondary}
                                />
                                <Pressable style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={() => saveInterval()} disabled={savingInterval}>
                                    <Text style={s.actionBtnText}>{savingInterval ? 'Saving...' : 'Save Interval'}</Text>
                                </Pressable>
                            </View>

                            <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>Pending Queue Entries</Text>
                        </>
                    }
                    renderItem={({ item }) => (
                        <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <Text style={s.rowType}>{item.type}</Text>
                            <Text style={s.rowMeta}>Created: {formatDate(item.createdAt)}</Text>
                            <Text style={s.rowMeta}>Attempts: {item.attemptCount}</Text>
                            <Text style={s.rowMeta}>Next retry: {formatRetryAt(item.nextRetryAt)}</Text>
                            {item.lastError ? <Text style={s.rowError}>Error: {item.lastError}</Text> : null}
                        </View>
                    )}
                    ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>Queue is empty.</Text>}
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
        back: { fontWeight: '600', fontSize: 14 },
        title: { fontSize: Typography.title.size, fontWeight: '700', color: colors.text },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        card: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.md,
            gap: Spacing.xs,
        },
        cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
        cardLine: { color: colors.textSecondary, fontSize: 12 },
        actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        actionBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
        },
        actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
        optionRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.xs },
        optionChip: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        optionText: { color: colors.text, fontSize: 12, fontWeight: '700' },
        input: {
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            fontSize: 14,
            marginTop: Spacing.xs,
            marginBottom: Spacing.sm,
        },
        sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
        row: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            marginBottom: Spacing.sm,
        },
        rowType: { color: colors.text, fontSize: 12, fontWeight: '700' },
        rowMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
        rowError: { color: colors.error, fontSize: 11, marginTop: 2 },
    });
