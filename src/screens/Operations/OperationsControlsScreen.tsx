import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text, Switch, useTheme } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { operationsService, type AccountingPeriod, type ApprovalRequest, type AuditLogEntry, type BusinessControls } from '../../api/operationsService';
import { useAuth } from '../../hooks/useAuth';
import { isNetworkLikeError } from '../../utils/errorGuards';

interface OperationsControlsPayload {
    controls: BusinessControls;
    approvals: ApprovalRequest[];
    auditLogs: AuditLogEntry[];
    periods: AccountingPeriod[];
}

const OPERATIONS_CONTROLS_QUERY_KEY = ['operations-controls'] as const;

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) return error.message;
    return fallback;
};

export const OperationsControlsScreen = () => {
    const theme = useTheme();
    const { user } = useAuth();
    const dialog = useAppDialog();
    const queryClient = useQueryClient();

    const [controlsSaving, setControlsSaving] = useState(false);
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [periodNotes, setPeriodNotes] = useState('');

    const operationsQuery = useQuery({
        queryKey: OPERATIONS_CONTROLS_QUERY_KEY,
        queryFn: async (): Promise<OperationsControlsPayload> => {
            const [controlsData, approvalData, logData, periodData] = await Promise.all([
                operationsService.getControls(),
                operationsService.getPendingApprovals(50),
                operationsService.getAuditLogs(50),
                operationsService.getPeriods(20),
            ]);

            return {
                controls: controlsData,
                approvals: approvalData,
                auditLogs: logData,
                periods: periodData,
            };
        },
        staleTime: 15_000,
    });

    const controls = operationsQuery.data?.controls ?? null;
    const approvals = operationsQuery.data?.approvals ?? [];
    const auditLogs = operationsQuery.data?.auditLogs ?? [];
    const periods = operationsQuery.data?.periods ?? [];
    const loading = operationsQuery.isFetching && !operationsQuery.data;
    const queryError = operationsQuery.error;
    const showQueryError = Boolean(queryError) && !isNetworkLikeError(queryError);

    const loadData = useCallback(async () => {
        await operationsQuery.refetch();
    }, [operationsQuery]);

    const updateControl = async (field: keyof BusinessControls, value: boolean) => {
        const currentPayload = operationsQuery.data;
        if (!currentPayload) return;

        const optimisticPayload: OperationsControlsPayload = {
            ...currentPayload,
            controls: {
                ...currentPayload.controls,
                [field]: value,
            },
        };

        queryClient.setQueryData<OperationsControlsPayload>(OPERATIONS_CONTROLS_QUERY_KEY, optimisticPayload);
        setControlsSaving(true);
        try {
            const updatedControls = await operationsService.updateControls({ [field]: value });
            queryClient.setQueryData<OperationsControlsPayload>(OPERATIONS_CONTROLS_QUERY_KEY, {
                ...optimisticPayload,
                controls: updatedControls,
            });
        } catch (error: unknown) {
            queryClient.setQueryData<OperationsControlsPayload>(OPERATIONS_CONTROLS_QUERY_KEY, currentPayload);
            dialog.alert('Error', getErrorMessage(error, 'Failed to update controls.'));
        } finally {
            setControlsSaving(false);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            await operationsService.approveRequest(id);
            await loadData();
        } catch (error: unknown) {
            dialog.alert('Error', getErrorMessage(error, 'Failed to approve request.'));
        }
    };

    const handleReject = async (id: string) => {
        try {
            await operationsService.rejectRequest(id);
            await loadData();
        } catch (error: unknown) {
            dialog.alert('Error', getErrorMessage(error, 'Failed to reject request.'));
        }
    };

    const handleLockPeriod = async () => {
        if (!periodStart || !periodEnd) {
            dialog.alert('Missing Dates', 'Enter period start and end in YYYY-MM-DD format.');
            return;
        }
        try {
            await operationsService.lockPeriod(periodStart, periodEnd, periodNotes || undefined);
            setPeriodNotes('');
            await loadData();
        } catch (error: unknown) {
            dialog.alert('Error', getErrorMessage(error, 'Failed to lock period.'));
        }
    };

    const handleClosePeriod = async (id: string) => {
        try {
            await operationsService.closePeriod(id);
            await loadData();
        } catch (error: unknown) {
            dialog.alert('Error', getErrorMessage(error, 'Failed to close period.'));
        }
    };

    const handleReopenPeriod = async (id: string) => {
        try {
            await operationsService.reopenPeriod(id);
            await loadData();
        } catch (error: unknown) {
            dialog.alert('Error', getErrorMessage(error, 'Failed to reopen period.'));
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <PageHeaderCard
                    title="Operations Controls"
                    subtitle={`Role: ${(user?.role ?? 'owner').toUpperCase()}`}
                />

                {showQueryError && (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
                        {getErrorMessage(queryError, 'Failed to load operations controls.')}
                    </Text>
                )}

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        Control Toggles
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 10 }}>
                        Maker-checker, approvals, and accounting period lock controls.
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text variant="bodyMedium">Enable maker-checker</Text>
                        <Switch
                            value={controls?.makerCheckerEnabled ?? false}
                            disabled={!controls || controlsSaving}
                            onValueChange={(value) => { void updateControl('makerCheckerEnabled', value); }}
                        />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text variant="bodyMedium">Journal approval required</Text>
                        <Switch
                            value={controls?.journalApprovalRequired ?? false}
                            disabled={!controls || controlsSaving}
                            onValueChange={(value) => { void updateControl('journalApprovalRequired', value); }}
                        />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text variant="bodyMedium">Stock adjustment approval required</Text>
                        <Switch
                            value={controls?.stockAdjustmentApprovalRequired ?? false}
                            disabled={!controls || controlsSaving}
                            onValueChange={(value) => { void updateControl('stockAdjustmentApprovalRequired', value); }}
                        />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="bodyMedium">Period lock enforcement</Text>
                        <Switch
                            value={controls?.periodLockEnabled ?? false}
                            disabled={!controls || controlsSaving}
                            onValueChange={(value) => { void updateControl('periodLockEnabled', value); }}
                        />
                    </View>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        Pending Approvals ({approvals.length})
                    </Text>
                    {approvals.length === 0 ? (
                        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 8 }}>
                            No pending approval requests.
                        </Text>
                    ) : (
                        approvals.slice(0, 12).map((entry) => (
                            <View key={entry.id} style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }}>
                                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                                    {entry.requestType} | {entry.module.toUpperCase()}
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    Requested by: {entry.requestedBy} | {formatDateTime(entry.createdAt)}
                                </Text>
                                {!!entry.reason && (
                                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                        Reason: {entry.reason}
                                    </Text>
                                )}
                                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                                    <AppButton mode="contained-tonal" compact style={{ marginRight: 8 }} onPress={() => { void handleApprove(entry.id); }}>
                                        Approve
                                    </AppButton>
                                    <AppButton mode="outlined" compact onPress={() => { void handleReject(entry.id); }}>
                                        Reject
                                    </AppButton>
                                </View>
                            </View>
                        ))
                    )}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        Accounting Period Lock
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 10 }}>
                        Enter dates in YYYY-MM-DD.
                    </Text>
                    <AppInput
                        label="Period Start"
                        value={periodStart}
                        onChangeText={setPeriodStart}
                        placeholder="2026-01-01"
                    />
                    <AppInput
                        label="Period End"
                        value={periodEnd}
                        onChangeText={setPeriodEnd}
                        placeholder="2026-01-31"
                    />
                    <AppInput
                        label="Notes"
                        value={periodNotes}
                        onChangeText={setPeriodNotes}
                        placeholder="Optional note"
                    />
                    <AppButton mode="contained" onPress={() => { void handleLockPeriod(); }}>
                        Lock Period
                    </AppButton>
                    {periods.map((period) => (
                        <View key={period.id} style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }}>
                            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                                {period.periodStart.slice(0, 10)} to {period.periodEnd.slice(0, 10)}
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                Status: {period.status.toUpperCase()}
                            </Text>
                            <View style={{ flexDirection: 'row', marginTop: 6 }}>
                                {period.status !== 'closed' && (
                                    <AppButton mode="contained-tonal" compact style={{ marginRight: 8 }} onPress={() => { void handleClosePeriod(period.id); }}>
                                        Close
                                    </AppButton>
                                )}
                                {period.status !== 'open' && (
                                    <AppButton mode="outlined" compact onPress={() => { void handleReopenPeriod(period.id); }}>
                                        Reopen
                                    </AppButton>
                                )}
                            </View>
                        </View>
                    ))}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        Audit Log Explorer
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                        Recent activity ({auditLogs.length} entries).
                    </Text>
                    {auditLogs.slice(0, 20).map((log) => (
                        <View key={log.id} style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }}>
                            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                                {log.module.toUpperCase()} | {log.action}
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                {formatDateTime(log.createdAt)} | {log.actorUid}
                            </Text>
                        </View>
                    ))}
                </AppCard>

                {(loading || operationsQuery.isRefetching) && (
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, textAlign: 'center' }}>
                        Refreshing operations data...
                    </Text>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};
