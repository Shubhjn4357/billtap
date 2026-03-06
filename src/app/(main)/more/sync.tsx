import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useSmartBack } from '../../../hooks/useSmartBack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { settingsApi } from '../../../api/endpoints';
import { offlineSyncService } from '../../../services/offlineSyncService';
import { Radius, Spacing, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { useAppDialog } from '@/components/providers/DialogProvider';

type QueueEntry = {
    id: string;
    type: string;
    status?: string;
    lastErrorCode?: string;
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
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
    const qc = useQueryClient();

    const [intervalInput, setIntervalInput] = useState('60');

    const { data: queueData, isLoading: queueLoading, isRefetching: queueRefetching, refetch } = useQuery({
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

    const { data: generalSettings, isRefetching: settingsRefetching, refetch: refetchSettings } = useQuery({
        queryKey: ['settings-section', 'GENERAL'],
        queryFn: () => settingsApi.get('GENERAL'),
        staleTime: 30_000,
    });
    const isRefreshing = queueRefetching || settingsRefetching;

    const settingsData = (generalSettings?.data ?? {}) as Record<string, unknown>;
    const conflictPolicy = typeof settingsData.sync_conflict_policy === 'string'
        ? settingsData.sync_conflict_policy
        : 'LAST_WRITE_WINS';

    const queue = queueData?.queue ?? [];
    const stats = queueData?.stats ?? { pendingCount: 0, blockedCount: 0, oldestCreatedAt: null as string | null };
    const [upgradeHintShown, setUpgradeHintShown] = useState(false);

    const storageBackend = useMemo(() => offlineSyncService.getStorageBackend(), []);

    useEffect(() => {
        if (upgradeHintShown) return;
        if (stats.blockedCount <= 0) return;
        setUpgradeHintShown(true);
        dialog.alert(
            'Upgrade required',
            'Some cloud sync items are blocked by current plan. Data is saved locally. Upgrade plan to sync these items.'
        );
    }, [dialog, stats.blockedCount, upgradeHintShown]);

    const { mutate: flushNow, isPending: flushing } = useMutation({
        mutationFn: () => offlineSyncService.flushQueue(),
        onSuccess: async (result) => {
            await refetch();
            dialog.alert('Sync complete', `Processed: ${result.processed}, Remaining: ${result.remaining}`);
        },
        onError: (error) => {
            dialog.alert('Sync failed', error instanceof Error ? error.message : 'Unable to flush queue.');
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
            dialog.alert('Saved', 'Auto sync interval updated.');
        },
        onError: (error) => {
            dialog.alert('Save failed', error instanceof Error ? error.message : 'Unable to save interval.');
        },
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Sync Diagnostics"
                subtitle="Queue, retries and conflict controls"
                onBackPress={smartBack}
            />

            <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                {queueLoading ? (
                    <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
                ) : (
                    <FlatList
                    data={queue}
                    keyExtractor={(item) => item.id}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefreshing}
                            onRefresh={() => {
                                void Promise.all([refetch(), refetchSettings()]);
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <>
                            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                                <Text style={s.cardTitle}>Queue Overview</Text>
                                <Text style={s.cardLine}>Storage: {storageBackend}</Text>
                                <Text style={s.cardLine}>Pending: {stats.pendingCount}</Text>
                                <Text style={s.cardLine}>Blocked (upgrade): {stats.blockedCount}</Text>
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
                                        style={[s.optionChip, conflictPolicy === 'LAST_WRITE_WINS' && { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, '22') }]}
                                        onPress={() => savePolicy('LAST_WRITE_WINS')}
                                        disabled={savingPolicy}
                                    >
                                        <Text style={s.optionText}>Last Write Wins</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[s.optionChip, conflictPolicy === 'SERVER_WINS' && { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, '22') }]}
                                        onPress={() => savePolicy('SERVER_WINS')}
                                        disabled={savingPolicy}
                                    >
                                        <Text style={s.optionText}>Server Wins</Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                                <Text style={s.cardTitle}>Auto Sync Interval (seconds)</Text>
                                <AppInput
                                    inputType="number"
                                    value={intervalInput}
                                    onChangeText={setIntervalInput}
                                    placeholder="60"
                                    containerStyle={s.intervalInputWrap}
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
                            <Text style={s.rowMeta}>Status: {item.status ?? 'pending'}</Text>
                            <Text style={s.rowMeta}>Created: {formatDate(item.createdAt)}</Text>
                            <Text style={s.rowMeta}>Attempts: {item.attemptCount}</Text>
                            <Text style={s.rowMeta}>Next retry: {formatRetryAt(item.nextRetryAt)}</Text>
                            {item.lastErrorCode ? <Text style={s.rowMeta}>Code: {item.lastErrorCode}</Text> : null}
                            {item.lastError ? <Text style={s.rowError}>Error: {item.lastError}</Text> : null}
                        </View>
                    )}
                    ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>Queue is empty.</Text>}
                />
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        flex: { flex: 1 },
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
        actionBtnText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
        optionRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.xs },
        optionChip: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        optionText: { color: colors.text, fontSize: 12, fontWeight: '700' },
        intervalInputWrap: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
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
