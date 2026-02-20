import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, Switch, useTheme } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppDateField } from '../../components/common/AppDateField';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { operationsService, type AccountingPeriod, type ApprovalRequest, type AuditLogEntry, type BusinessControls } from '../../api/operationsService';
import { useAuth } from '../../hooks/useAuth';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { AppRefreshControl } from '../../components/common/AppRefreshControl';
import { DesignSystem } from '../../constants/DesignSystem';

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
    const { width } = useWindowDimensions();
    const isWide = width >= 960;

    const [controlsSaving, setControlsSaving] = useState(false);
    const [periodStartDate, setPeriodStartDate] = useState<Date | undefined>(undefined);
    const [periodEndDate, setPeriodEndDate] = useState<Date | undefined>(undefined);
    const [periodNotes, setPeriodNotes] = useState('');
    const periodStart = periodStartDate ? periodStartDate.toISOString().slice(0, 10) : '';
    const periodEnd = periodEndDate ? periodEndDate.toISOString().slice(0, 10) : '';

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
    const { refetch: refetchOperations } = operationsQuery;

    const controls = operationsQuery.data?.controls ?? null;
    const approvals = operationsQuery.data?.approvals ?? [];
    const auditLogs = operationsQuery.data?.auditLogs ?? [];
    const periods = operationsQuery.data?.periods ?? [];
    const loading = operationsQuery.isFetching && !operationsQuery.data;
    const queryError = operationsQuery.error;
    const showQueryError = Boolean(queryError) && !isNetworkLikeError(queryError);

    const loadData = useCallback(async () => {
        await refetchOperations();
    }, [refetchOperations]);

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
            dialog.alert('Missing Dates', 'Select period start and end dates.');
            return;
        }
        if (periodStartDate && periodEndDate && periodStartDate.getTime() > periodEndDate.getTime()) {
            dialog.alert('Invalid Dates', 'Period start cannot be after period end.');
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
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<AppRefreshControl refreshing={loading} onRefresh={() => { void loadData(); }} />}
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Operations Controls"
                        subtitle={`Role: ${(user?.role ?? 'owner').toUpperCase()}`}
                    />

                    {showQueryError && (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {getErrorMessage(queryError, 'Failed to load operations controls.')}
                        </Text>
                    )}

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Control Toggles
                        </Text>
                        <Text variant="bodySmall" style={[styles.mutedText, { color: theme.colors.outline }]}>
                            Maker-checker, approvals, and accounting period lock controls.
                        </Text>
                        <View style={styles.toggleRow}>
                            <Text variant="bodyMedium">Enable maker-checker</Text>
                            <Switch
                                value={controls?.makerCheckerEnabled ?? false}
                                disabled={!controls || controlsSaving}
                                onValueChange={(value) => { void updateControl('makerCheckerEnabled', value); }}
                            />
                        </View>
                        <View style={styles.toggleRow}>
                            <Text variant="bodyMedium">Journal approval required</Text>
                            <Switch
                                value={controls?.journalApprovalRequired ?? false}
                                disabled={!controls || controlsSaving}
                                onValueChange={(value) => { void updateControl('journalApprovalRequired', value); }}
                            />
                        </View>
                        <View style={styles.toggleRow}>
                            <Text variant="bodyMedium">Stock adjustment approval required</Text>
                            <Switch
                                value={controls?.stockAdjustmentApprovalRequired ?? false}
                                disabled={!controls || controlsSaving}
                                onValueChange={(value) => { void updateControl('stockAdjustmentApprovalRequired', value); }}
                            />
                        </View>
                        <View style={styles.toggleRowLast}>
                            <Text variant="bodyMedium">Period lock enforcement</Text>
                            <Switch
                                value={controls?.periodLockEnabled ?? false}
                                disabled={!controls || controlsSaving}
                                onValueChange={(value) => { void updateControl('periodLockEnabled', value); }}
                            />
                        </View>
                    </AppCard>

                    <AppCard>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Pending Approvals ({approvals.length})
                        </Text>
                        {approvals.length === 0 ? (
                            <Text variant="bodySmall" style={[styles.emptyText, { color: theme.colors.outline }]}>
                                No pending approval requests.
                            </Text>
                        ) : (
                            approvals.slice(0, 12).map((entry) => (
                                <View
                                    key={entry.id}
                                    style={[styles.listDivider, { borderTopColor: theme.colors.outlineVariant }]}
                                >
                                    <Text variant="bodyMedium" style={styles.itemTitle}>
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
                                    <View style={styles.actionRow}>
                                        <AppButton
                                            mode="contained-tonal"
                                            compact
                                            style={styles.rightSpacedButton}
                                            onPress={() => { void handleApprove(entry.id); }}
                                        >
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
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Accounting Period Lock
                        </Text>
                        <Text variant="bodySmall" style={[styles.mutedText, { color: theme.colors.outline }]}>
                            Select a date range to lock accounting period.
                        </Text>
                        <AppDateField
                            label="Period Start"
                            value={periodStartDate}
                            onChange={setPeriodStartDate}
                            placeholder="Select start date"
                        />
                        <AppDateField
                            label="Period End"
                            value={periodEndDate}
                            onChange={setPeriodEndDate}
                            placeholder="Select end date"
                            minimumDate={periodStartDate}
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
                            <View
                                key={period.id}
                                style={[styles.listDividerTight, { borderTopColor: theme.colors.outlineVariant }]}
                            >
                                <Text variant="bodyMedium" style={styles.itemTitle}>
                                    {period.periodStart.slice(0, 10)} to {period.periodEnd.slice(0, 10)}
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    Status: {period.status.toUpperCase()}
                                </Text>
                                <View style={styles.actionRowCompact}>
                                    {period.status !== 'closed' && (
                                        <AppButton
                                            mode="contained-tonal"
                                            compact
                                            style={styles.rightSpacedButton}
                                            onPress={() => { void handleClosePeriod(period.id); }}
                                        >
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
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Audit Log Explorer
                        </Text>
                        <Text variant="bodySmall" style={[styles.mutedTextSmall, { color: theme.colors.outline }]}>
                            Recent activity ({auditLogs.length} entries).
                        </Text>
                        {auditLogs.slice(0, 20).map((log) => (
                            <View
                                key={log.id}
                                style={[styles.listDividerCompact, { borderTopColor: theme.colors.outlineVariant }]}
                            >
                                <Text variant="bodyMedium" style={styles.itemTitle}>
                                    {log.module.toUpperCase()} | {log.action}
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    {formatDateTime(log.createdAt)} | {log.actorUid}
                                </Text>
                            </View>
                        ))}
                    </AppCard>

                    {(loading || operationsQuery.isRefetching) && (
                        <Text variant="bodySmall" style={[styles.refreshingText, { color: theme.colors.outline }]}>
                            Refreshing operations data...
                        </Text>
                    )}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        gap: DesignSystem.layout.sectionGap,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    sectionTitle: {
        fontWeight: '700',
    },
    mutedText: {
        marginBottom: DesignSystem.spacing.sm,
    },
    mutedTextSmall: {
        marginBottom: DesignSystem.spacing.xs,
    },
    errorText: {
        marginBottom: DesignSystem.spacing.xs,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: DesignSystem.spacing.xs,
    },
    toggleRowLast: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    emptyText: {
        marginTop: DesignSystem.spacing.xs,
    },
    listDivider: {
        marginTop: DesignSystem.spacing.sm + 2,
        paddingTop: DesignSystem.spacing.sm + 2,
        borderTopWidth: 1,
    },
    listDividerTight: {
        marginTop: DesignSystem.spacing.sm,
        paddingTop: DesignSystem.spacing.sm,
        borderTopWidth: 1,
    },
    listDividerCompact: {
        marginTop: DesignSystem.spacing.xs + 2,
        paddingTop: DesignSystem.spacing.xs + 2,
        borderTopWidth: 1,
    },
    itemTitle: {
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        marginTop: DesignSystem.spacing.xs + 2,
    },
    actionRowCompact: {
        flexDirection: 'row',
        marginTop: DesignSystem.spacing.xs,
    },
    rightSpacedButton: {
        marginRight: DesignSystem.spacing.xs + 2,
    },
    refreshingText: {
        textAlign: 'center',
    },
});
