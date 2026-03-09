import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useSmartBack } from '../../../hooks/useSmartBack';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { SettingsSection } from '../../../constants/enums';
import { offlineSyncService } from '../../../services/offlineSyncService';
import { toUserMessage } from '../../../api/client';
import { Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useAppRuntime } from '../../../components/providers/AppRuntimeProvider';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { useSettingsSelector } from '../../../hooks/useSettingsSelector';
import { useOfflineSyncQueue } from '../../../hooks/useOfflineSyncQueue';
import { useSyncQueueActions } from '../../../hooks/useSyncQueueActions';
import { selectGeneralSyncSettings, type SyncConflictPolicy } from '../../../selectors/settingsSelectors';
import { settingsSectionQueryKey } from '../../../state/settingsQueryKeys';
import { useSettingsSectionMutation } from '../../../hooks/useSettingsSectionMutation';

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
    const {
        syncStats,
        lastSyncError,
        refreshSyncState,
    } = useAppRuntime();
    const { flushNow, isFlushing } = useSyncQueueActions();

    const [intervalInput, setIntervalInput] = useState('60');

    const { queue, isLoading: queueLoading, isRefetching: queueRefetching, refetch: refetchQueue } = useOfflineSyncQueue();

    const {
        sectionData: generalSettingsData,
        selected: generalSettingsView,
        isRefetching: settingsRefetching,
        refetch: refetchSettings,
    } = useSettingsSelector(SettingsSection.GENERAL, selectGeneralSyncSettings);
    const isRefreshing = queueRefetching || settingsRefetching;

    const conflictPolicy = generalSettingsView.conflictPolicy;

    const [upgradeHintShown, setUpgradeHintShown] = useState(false);
    const storageBackend = useMemo(() => offlineSyncService.getStorageBackend(), []);

    useEffect(() => {
        setIntervalInput(String(generalSettingsView.autoSyncIntervalSec));
    }, [generalSettingsView.autoSyncIntervalSec]);

    useEffect(() => {
        if (upgradeHintShown) return;
        if (syncStats.blockedCount <= 0) return;
        setUpgradeHintShown(true);
        dialog.alert(
            'Upgrade required',
            'Some cloud sync items are blocked by current plan. Data is saved locally. Upgrade plan to sync these items.'
        );
    }, [dialog, syncStats.blockedCount, upgradeHintShown]);

    const { mutate: savePolicyMutation, isPending: savingPolicy } = useSettingsSectionMutation(SettingsSection.GENERAL, {
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: settingsSectionQueryKey(SettingsSection.GENERAL) });
        },
        onError: (error) => {
            console.error('[sync-diagnostics] save policy failed', { error });
            dialog.alert('Save failed', toUserMessage(error, 'Unable to save policy.'));
        },
    });

    const { mutate: saveIntervalMutation, isPending: savingInterval } = useSettingsSectionMutation(SettingsSection.GENERAL, {
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: settingsSectionQueryKey(SettingsSection.GENERAL) });
            dialog.alert('Saved', 'Auto sync interval updated.');
        },
        onError: (error) => {
            console.error('[sync-diagnostics] save interval failed', { intervalInput, error });
            dialog.alert('Save failed', toUserMessage(error, 'Unable to save interval.'));
        },
    });

    const savePolicy = (policy: SyncConflictPolicy) => {
        savePolicyMutation({
            ...generalSettingsData,
            sync_conflict_policy: policy,
        });
    };

    const saveInterval = () => {
        const interval = Number(intervalInput);
        if (!Number.isFinite(interval) || interval < 15 || interval > 3600) {
            dialog.alert('Save failed', 'Auto sync interval must be between 15 and 3600 seconds.');
            return;
        }
        saveIntervalMutation({
            ...generalSettingsData,
            sync_auto_interval_sec: Math.round(interval),
        });
    };

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
                                void Promise.all([refetchQueue(), refetchSettings(), refreshSyncState()]);
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
                    ListHeaderComponent={
                        <>
                            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                                <Text style={s.cardTitle}>Queue Overview</Text>
                                <Text style={s.cardLine}>Storage: {storageBackend}</Text>
                                <Text style={s.cardLine}>Pending: {syncStats.pendingCount}</Text>
                                <Text style={s.cardLine}>Blocked (upgrade): {syncStats.blockedCount}</Text>
                                <Text style={s.cardLine}>Oldest: {formatDate(syncStats.oldestCreatedAt ?? undefined)}</Text>
                                {lastSyncError ? <Text style={s.errorLine}>Last sync error: {lastSyncError}</Text> : null}
                                <View style={s.actionRow}>
                                    <Pressable style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={() => {
                                        void flushNow()
                                            .then(async (result) => {
                                                await refetchQueue();
                                                dialog.alert('Sync complete', `Processed: ${result.processed}, Remaining: ${result.remaining}`);
                                            })
                                            .catch((error) => {
                                                console.error('[sync-diagnostics] flush failed', { error });
                                                dialog.alert('Sync failed', toUserMessage(error, 'Unable to flush queue.'));
                                            });
                                    }} disabled={isFlushing}>
                                        <Text style={s.actionBtnText}>{isFlushing ? 'Syncing...' : 'Flush Now'}</Text>
                                    </Pressable>
                                    <Pressable style={[s.actionBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => {
                                        void Promise.all([refetchQueue(), refreshSyncState()]);
                                    }}>
                                        <Text style={[s.actionBtnText, { color: colors.text }]}>Refresh</Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                                <Text style={s.cardTitle}>Conflict Resolution</Text>
                                <View style={s.optionRow}>
                                    <ChipButton
                                        label="Last Write Wins"
                                        selected={conflictPolicy === 'LAST_WRITE_WINS'}
                                        tone="info"
                                        onPress={() => savePolicy('LAST_WRITE_WINS')}
                                        disabled={savingPolicy}
                                    />
                                    <ChipButton
                                        label="Server Wins"
                                        selected={conflictPolicy === 'SERVER_WINS'}
                                        tone="info"
                                        onPress={() => savePolicy('SERVER_WINS')}
                                        disabled={savingPolicy}
                                    />
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
        errorLine: { color: colors.error, fontSize: 12 },
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
