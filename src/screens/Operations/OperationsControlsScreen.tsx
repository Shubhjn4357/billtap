import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Chip, Switch, Text, useTheme } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { AppAccordion } from '../../components/common/AppAccordion';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppDateField } from '../../components/common/AppDateField';
import { AppInput } from '../../components/common/AppInput';
import { AppPullToRefresh } from '../../components/common/AppPullToRefresh';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { DesignSystem } from '../../constants/DesignSystem';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { isNetworkLikeError } from '../../utils/errorGuards';
import {
    operationsService,
    type AccountingPeriod,
    type ApprovalRequest,
    type AuditLogEntry,
    type BusinessControls,
} from '../../api/operationsService';

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

const formatDay = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
    return parsed.toISOString().slice(0, 10);
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
    const { canAccessOperations } = useOrganizationAccess();

    const [controlsSaving, setControlsSaving] = useState(false);
    const [periodStartDate, setPeriodStartDate] = useState<Date | undefined>(undefined);
    const [periodEndDate, setPeriodEndDate] = useState<Date | undefined>(undefined);
    const [periodNotes, setPeriodNotes] = useState('');
    const [approvingIds, setApprovingIds] = useState<Record<string, boolean>>({});

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
        enabled: canAccessOperations,
    });

    const controls = operationsQuery.data?.controls ?? null;
    const approvals = useMemo(() => operationsQuery.data?.approvals ?? [], [operationsQuery.data?.approvals]);
    const auditLogs = useMemo(() => operationsQuery.data?.auditLogs ?? [], [operationsQuery.data?.auditLogs]);
    const periods = useMemo(() => operationsQuery.data?.periods ?? [], [operationsQuery.data?.periods]);
    const queryError = operationsQuery.error;
    const showQueryError = Boolean(queryError) && !isNetworkLikeError(queryError);

    const periodStats = useMemo(() => {
        let open = 0;
        let locked = 0;
        let closed = 0;
        periods.forEach((period) => {
            if (period.status === 'open') open += 1;
            else if (period.status === 'locked') locked += 1;
            else closed += 1;
        });
        return { open, locked, closed };
    }, [periods]);

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
            dialog.alert('Controls', getErrorMessage(error, 'Failed to update controls.'));
        } finally {
            setControlsSaving(false);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            setApprovingIds((current) => ({ ...current, [id]: true }));
            await operationsService.approveRequest(id);
            await loadData();
        } catch (error: unknown) {
            dialog.alert('Approvals', getErrorMessage(error, 'Failed to approve request.'));
        } finally {
            setApprovingIds((current) => {
                const next = { ...current };
                delete next[id];
                return next;
            });
        }
    };

    const handleReject = async (id: string) => {
        try {
            setApprovingIds((current) => ({ ...current, [id]: true }));
            await operationsService.rejectRequest(id);
            await loadData();
        } catch (error: unknown) {
            dialog.alert('Approvals', getErrorMessage(error, 'Failed to reject request.'));
        } finally {
            setApprovingIds((current) => {
                const next = { ...current };
                delete next[id];
                return next;
            });
        }
    };

    const handleLockPeriod = async () => {
        if (!periodStart || !periodEnd) {
            dialog.alert('Period Lock', 'Select period start and end dates.');
            return;
        }
        if (periodStartDate && periodEndDate && periodStartDate.getTime() > periodEndDate.getTime()) {
            dialog.alert('Period Lock', 'Period start cannot be after period end.');
            return;
        }
        try {
            await operationsService.lockPeriod(periodStart, periodEnd, periodNotes || undefined);
            setPeriodNotes('');
            await loadData();
        } catch (error: unknown) {
            dialog.alert('Period Lock', getErrorMessage(error, 'Failed to lock period.'));
        }
    };

    const handleClosePeriod = async (id: string) => {
        try {
            await operationsService.closePeriod(id);
            await loadData();
        } catch (error: unknown) {
            dialog.alert('Period Lock', getErrorMessage(error, 'Failed to close period.'));
        }
    };

    const handleReopenPeriod = async (id: string) => {
        try {
            await operationsService.reopenPeriod(id);
            await loadData();
        } catch (error: unknown) {
            dialog.alert('Period Lock', getErrorMessage(error, 'Failed to reopen period.'));
        }
    };

    if (!canAccessOperations) {
        return (
            <ScreenWrapper>
                <View style={styles.blockedContainer}>
                    <AppCard>
                        <Text variant="titleMedium" style={styles.blockedTitle}>Operations access is disabled</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Ask your organization owner to enable operations controls permission for your account.
                        </Text>
                    </AppCard>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <AppPullToRefresh refreshing={operationsQuery.isFetching} onRefresh={() => { void loadData(); }}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title="Operations Controls"
                            subtitle={`Role: ${(user?.role ?? 'owner').toUpperCase()}`}
                        />

                        {showQueryError ? (
                            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                                {getErrorMessage(queryError, 'Failed to load operations controls.')}
                            </Text>
                        ) : null}

                        <AppCard>
                            <View style={styles.summaryRow}>
                                <Chip compact icon="clock-alert-outline">Pending: {approvals.length}</Chip>
                                <Chip compact icon="lock-open-variant-outline">Open: {periodStats.open}</Chip>
                                <Chip compact icon="lock-outline">Locked: {periodStats.locked}</Chip>
                                <Chip compact icon="check-circle-outline">Closed: {periodStats.closed}</Chip>
                            </View>
                        </AppCard>

                        <AppAccordion title="Control Toggles" icon="toggle-switch-outline" defaultExpanded>
                            <View style={styles.toggleList}>
                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleTextWrap}>
                                        <Text variant="titleSmall">Enable maker-checker</Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            Draft actions require owner approval.
                                        </Text>
                                    </View>
                                    <Switch
                                        value={controls?.makerCheckerEnabled ?? false}
                                        disabled={!controls || controlsSaving}
                                        onValueChange={(value) => { void updateControl('makerCheckerEnabled', value); }}
                                    />
                                </View>
                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleTextWrap}>
                                        <Text variant="titleSmall">Journal approval required</Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            Manual journal entries stay gated.
                                        </Text>
                                    </View>
                                    <Switch
                                        value={controls?.journalApprovalRequired ?? false}
                                        disabled={!controls || controlsSaving}
                                        onValueChange={(value) => { void updateControl('journalApprovalRequired', value); }}
                                    />
                                </View>
                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleTextWrap}>
                                        <Text variant="titleSmall">Stock adjustment approval</Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            Prevent direct stock edits without review.
                                        </Text>
                                    </View>
                                    <Switch
                                        value={controls?.stockAdjustmentApprovalRequired ?? false}
                                        disabled={!controls || controlsSaving}
                                        onValueChange={(value) => { void updateControl('stockAdjustmentApprovalRequired', value); }}
                                    />
                                </View>
                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleTextWrap}>
                                        <Text variant="titleSmall">Period lock enforcement</Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            Block postings in closed accounting periods.
                                        </Text>
                                    </View>
                                    <Switch
                                        value={controls?.periodLockEnabled ?? false}
                                        disabled={!controls || controlsSaving}
                                        onValueChange={(value) => { void updateControl('periodLockEnabled', value); }}
                                    />
                                </View>
                            </View>
                        </AppAccordion>

                        <AppAccordion
                            title={`Pending Approvals (${approvals.length})`}
                            icon="clipboard-text-clock-outline"
                            defaultExpanded={approvals.length > 0}
                        >
                            {approvals.length === 0 ? (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    No pending approval requests.
                                </Text>
                            ) : (
                                approvals.slice(0, 12).map((entry) => {
                                    const busy = Boolean(approvingIds[entry.id]);
                                    return (
                                        <View key={entry.id} style={[styles.approvalRow, { borderColor: theme.colors.outlineVariant }]}>
                                            <Text variant="titleSmall" style={styles.approvalTitle}>
                                                {entry.requestType} • {entry.module.toUpperCase()}
                                            </Text>
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                Requested by {entry.requestedBy} • {formatDateTime(entry.createdAt)}
                                            </Text>
                                            {entry.reason ? (
                                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                                                    Reason: {entry.reason}
                                                </Text>
                                            ) : null}
                                            <View style={styles.approvalActions}>
                                                <AppButton
                                                    mode="contained-tonal"
                                                    compact
                                                    disabled={busy}
                                                    loading={busy}
                                                    onPress={() => { void handleApprove(entry.id); }}
                                                >
                                                    Approve
                                                </AppButton>
                                                <AppButton
                                                    mode="outlined"
                                                    compact
                                                    disabled={busy}
                                                    onPress={() => { void handleReject(entry.id); }}
                                                >
                                                    Reject
                                                </AppButton>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </AppAccordion>

                        <AppAccordion
                            title={`Accounting Periods (${periods.length})`}
                            icon="calendar-lock-outline"
                            defaultExpanded
                        >
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

                            {periods.map((period) => {
                                const chipMode = period.status === 'open'
                                    ? 'flat'
                                    : period.status === 'locked'
                                        ? 'outlined'
                                        : 'flat';
                                return (
                                    <View key={period.id} style={[styles.periodRow, { borderColor: theme.colors.outlineVariant }]}>
                                        <View style={styles.periodHeader}>
                                            <Text variant="titleSmall">{formatDay(period.periodStart)} to {formatDay(period.periodEnd)}</Text>
                                            <Chip compact mode={chipMode}>
                                                {period.status.toUpperCase()}
                                            </Chip>
                                        </View>
                                        {period.notes ? (
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                {period.notes}
                                            </Text>
                                        ) : null}
                                        <View style={styles.periodActions}>
                                            {period.status !== 'closed' ? (
                                                <AppButton
                                                    mode="contained-tonal"
                                                    compact
                                                    onPress={() => { void handleClosePeriod(period.id); }}
                                                >
                                                    Close
                                                </AppButton>
                                            ) : null}
                                            {period.status !== 'open' ? (
                                                <AppButton
                                                    mode="outlined"
                                                    compact
                                                    onPress={() => { void handleReopenPeriod(period.id); }}
                                                >
                                                    Reopen
                                                </AppButton>
                                            ) : null}
                                        </View>
                                    </View>
                                );
                            })}
                        </AppAccordion>

                        <AppAccordion
                            title={`Audit Log (${auditLogs.length})`}
                            icon="text-box-search-outline"
                            defaultExpanded={false}
                        >
                            {auditLogs.slice(0, 20).map((log) => (
                                <View key={log.id} style={[styles.auditRow, { borderColor: theme.colors.outlineVariant }]}>
                                    <Text variant="titleSmall">{log.module.toUpperCase()} • {log.action}</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {formatDateTime(log.createdAt)} • {log.actorUid}
                                    </Text>
                                </View>
                            ))}
                            {auditLogs.length === 0 ? (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    No audit logs found.
                                </Text>
                            ) : null}
                        </AppAccordion>
                    </View>
                </ScrollView>
            </AppPullToRefresh>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    blockedContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    blockedTitle: {
        fontWeight: '700',
        marginBottom: 8,
    },
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
    summaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    toggleList: {
        gap: 10,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    toggleTextWrap: {
        flex: 1,
    },
    approvalRow: {
        borderWidth: 1,
        borderRadius: DesignSystem.radius.sm,
        padding: DesignSystem.spacing.sm,
        marginTop: 8,
    },
    approvalTitle: {
        fontWeight: '700',
    },
    approvalActions: {
        marginTop: 8,
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    periodRow: {
        borderWidth: 1,
        borderRadius: DesignSystem.radius.sm,
        padding: DesignSystem.spacing.sm,
        marginTop: 8,
    },
    periodHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    periodActions: {
        marginTop: 8,
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    auditRow: {
        borderWidth: 1,
        borderRadius: DesignSystem.radius.sm,
        padding: DesignSystem.spacing.sm,
        marginTop: 8,
    },
});
