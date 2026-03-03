import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { operationsApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useOrganizationRole } from '../../../store/authStore';
import type { FinancialPeriod, OperationApproval, OperationsControls } from '../../../types/domain';

const toDateInput = (value?: string) => {
    if (!value) return new Date().toISOString().slice(0, 10);
    return value.slice(0, 10);
};

const APPROVAL_ACTION_LABEL: Record<string, string> = {
    UPDATE_CONTROLS: 'Update Controls',
    LOCK_PERIOD: 'Lock Period',
    CLOSE_PERIOD: 'Close Period',
    REOPEN_PERIOD: 'Reopen Period',
    CUSTOM: 'Custom',
};

export default function OperationsScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const s = styles(colors);
    const qc = useQueryClient();
    const organizationRole = useOrganizationRole();
    const canReviewApprovals = organizationRole === 'owner' || organizationRole === 'manager';

    const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');

    const { data: controlsRes, isLoading: controlsLoading } = useQuery({
        queryKey: ['operations-controls'],
        queryFn: () => operationsApi.getControls(),
        staleTime: 30_000,
    });

    const { data: periodsRes, isLoading: periodsLoading } = useQuery({
        queryKey: ['operations-periods'],
        queryFn: () => operationsApi.getPeriods(),
        staleTime: 30_000,
    });

    const { data: approvalsRes, isLoading: approvalsLoading } = useQuery({
        queryKey: ['operations-approvals'],
        queryFn: () => operationsApi.getApprovals(),
        staleTime: 20_000,
    });

    const controls = (controlsRes?.data?.controls ?? {
        makerCheckerEnabled: true,
        journalApprovalRequired: true,
        stockAdjustmentApprovalRequired: true,
        periodLockEnabled: true,
    }) as OperationsControls;

    const periods = useMemo(
        () => ((periodsRes?.data?.periods ?? []) as FinancialPeriod[]),
        [periodsRes?.data?.periods]
    );

    const pendingApprovals = useMemo(
        () => (((approvalsRes?.data?.approvals ?? []) as OperationApproval[]).filter((entry) => entry.status === 'PENDING')),
        [approvalsRes?.data?.approvals]
    );

    const invalidateAll = () =>
        Promise.all([
            qc.invalidateQueries({ queryKey: ['operations-controls'] }),
            qc.invalidateQueries({ queryKey: ['operations-periods'] }),
            qc.invalidateQueries({ queryKey: ['operations-approvals'] }),
        ]);

    const { mutateAsync: updateControls, isPending: savingControls } = useMutation({
        mutationFn: (payload: Partial<OperationsControls>) => operationsApi.updateControls(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['operations-controls'] }),
    });

    const { mutateAsync: lockPeriod, isPending: lockingPeriod } = useMutation({
        mutationFn: () => operationsApi.lockPeriod({ periodStart, periodEnd, notes: notes.trim() || undefined }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['operations-periods'] });
            qc.invalidateQueries({ queryKey: ['operations-approvals'] });
            setNotes('');
        },
    });

    const { mutateAsync: closePeriod, isPending: closingPeriod } = useMutation({
        mutationFn: (id: string) => operationsApi.closePeriod(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['operations-periods'] });
            qc.invalidateQueries({ queryKey: ['operations-approvals'] });
        },
    });

    const { mutateAsync: reopenPeriod, isPending: reopeningPeriod } = useMutation({
        mutationFn: (id: string) => operationsApi.reopenPeriod(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['operations-periods'] });
            qc.invalidateQueries({ queryKey: ['operations-approvals'] });
        },
    });

    const { mutateAsync: approveApproval, isPending: approvingApproval } = useMutation({
        mutationFn: (id: string) => operationsApi.approveApproval(id),
        onSuccess: () => {
            void invalidateAll();
        },
    });

    const { mutateAsync: rejectApproval, isPending: rejectingApproval } = useMutation({
        mutationFn: (id: string) => operationsApi.rejectApproval(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['operations-approvals'] });
        },
    });

    const toggleControl = async (key: keyof OperationsControls, value: boolean) => {
        try {
            const response = await updateControls({ ...controls, [key]: value });
            if (response.data?.status === 'PENDING_APPROVAL') {
                Alert.alert('Approval required', 'Control change has been sent for approval.');
                await qc.invalidateQueries({ queryKey: ['operations-approvals'] });
            }
        } catch (error) {
            Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to update control.');
        }
    };

    const onLockPeriod = async () => {
        try {
            const response = await lockPeriod();
            if (response.data?.status === 'PENDING_APPROVAL') {
                Alert.alert('Approval required', 'Lock request is pending approval.');
                return;
            }
            Alert.alert('Period locked', 'Financial period has been added as locked.');
        } catch (error) {
            Alert.alert('Lock failed', error instanceof Error ? error.message : 'Unable to lock period.');
        }
    };

    const onClose = (id: string) => {
        Alert.alert('Close period', 'Mark this period as closed?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Close',
                onPress: async () => {
                    try {
                        const response = await closePeriod(id);
                        if (response.data?.status === 'PENDING_APPROVAL') {
                            Alert.alert('Approval required', 'Close request is pending approval.');
                        }
                    } catch (error) {
                        Alert.alert('Close failed', error instanceof Error ? error.message : 'Unable to close period.');
                    }
                },
            },
        ]);
    };

    const onReopen = (id: string) => {
        Alert.alert('Reopen period', 'Reopen this period for entries?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reopen',
                onPress: async () => {
                    try {
                        const response = await reopenPeriod(id);
                        if (response.data?.status === 'PENDING_APPROVAL') {
                            Alert.alert('Approval required', 'Reopen request is pending approval.');
                        }
                    } catch (error) {
                        Alert.alert('Reopen failed', error instanceof Error ? error.message : 'Unable to reopen period.');
                    }
                },
            },
        ]);
    };

    const onApprove = (approvalId: string) => {
        Alert.alert('Approve request', 'Apply this pending request now?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Approve',
                onPress: async () => {
                    try {
                        await approveApproval(approvalId);
                    } catch (error) {
                        Alert.alert('Approve failed', error instanceof Error ? error.message : 'Unable to approve request.');
                    }
                },
            },
        ]);
    };

    const onReject = (approvalId: string) => {
        Alert.alert('Reject request', 'Reject this pending request?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reject',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await rejectApproval(approvalId);
                    } catch (error) {
                        Alert.alert('Reject failed', error instanceof Error ? error.message : 'Unable to reject request.');
                    }
                },
            },
        ]);
    };

    const busyApprovals = approvingApproval || rejectingApproval;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>{'< Back'}</Text>
                </Pressable>
                <Text style={[s.title, { color: colors.text }]}>Operations Controls</Text>
                <View style={{ width: 58 }} />
            </View>

            {controlsLoading || periodsLoading || approvalsLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={periods}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={
                        <>
                            <View style={[s.card, { backgroundColor: colors.card }]}>
                                <Text style={[s.sectionTitle, { color: colors.text }]}>Workflow Controls</Text>
                                <ControlRow
                                    label="Maker checker"
                                    value={controls.makerCheckerEnabled}
                                    onChange={(v) => void toggleControl('makerCheckerEnabled', v)}
                                    colors={colors}
                                    disabled={savingControls}
                                />
                                <ControlRow
                                    label="Journal approval required"
                                    value={controls.journalApprovalRequired}
                                    onChange={(v) => void toggleControl('journalApprovalRequired', v)}
                                    colors={colors}
                                    disabled={savingControls}
                                />
                                <ControlRow
                                    label="Stock adjustment approval"
                                    value={controls.stockAdjustmentApprovalRequired}
                                    onChange={(v) => void toggleControl('stockAdjustmentApprovalRequired', v)}
                                    colors={colors}
                                    disabled={savingControls}
                                />
                                <ControlRow
                                    label="Period locking"
                                    value={controls.periodLockEnabled}
                                    onChange={(v) => void toggleControl('periodLockEnabled', v)}
                                    colors={colors}
                                    disabled={savingControls}
                                />
                            </View>

                            <View style={[s.card, { backgroundColor: colors.card }]}>
                                <View style={s.pendingHeader}>
                                    <Text style={[s.sectionTitle, { color: colors.text }]}>Pending Approvals</Text>
                                    <Text style={[s.pendingCount, { color: colors.textSecondary }]}>{pendingApprovals.length}</Text>
                                </View>
                                {pendingApprovals.length === 0 ? (
                                    <Text style={[s.meta, { color: colors.textSecondary }]}>No pending approvals.</Text>
                                ) : (
                                    pendingApprovals.map((approval) => (
                                        <View key={approval.id} style={[s.approvalCard, { borderColor: colors.border }]}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[s.approvalTitle, { color: colors.text }]}>
                                                    {APPROVAL_ACTION_LABEL[approval.actionType] ?? approval.actionType}
                                                </Text>
                                                <Text style={[s.meta, { color: colors.textSecondary }]}>
                                                    Requested by {approval.requestedByRole ?? 'unknown'} at {format(new Date(approval.requestedAt), 'dd MMM yyyy, hh:mm a')}
                                                </Text>
                                            </View>
                                            {canReviewApprovals && (
                                                <View style={s.approvalActions}>
                                                    <Pressable
                                                        style={[s.inlineBtn, { borderColor: colors.primary }]}
                                                        onPress={() => onApprove(approval.id)}
                                                        disabled={busyApprovals}
                                                    >
                                                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Approve</Text>
                                                    </Pressable>
                                                    <Pressable
                                                        style={[s.inlineBtn, { borderColor: colors.error }]}
                                                        onPress={() => onReject(approval.id)}
                                                        disabled={busyApprovals}
                                                    >
                                                        <Text style={{ color: colors.error, fontWeight: '700', fontSize: 12 }}>Reject</Text>
                                                    </Pressable>
                                                </View>
                                            )}
                                        </View>
                                    ))
                                )}
                            </View>

                            <View style={[s.card, { backgroundColor: colors.card }]}>
                                <Text style={[s.sectionTitle, { color: colors.text }]}>Lock New Financial Period</Text>
                                <TextInput
                                    style={[s.input, { borderColor: colors.border, color: colors.text }]}
                                    value={periodStart}
                                    onChangeText={setPeriodStart}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={colors.textSecondary}
                                />
                                <TextInput
                                    style={[s.input, { borderColor: colors.border, color: colors.text }]}
                                    value={periodEnd}
                                    onChangeText={setPeriodEnd}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={colors.textSecondary}
                                />
                                <TextInput
                                    style={[s.input, s.notesInput, { borderColor: colors.border, color: colors.text }]}
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder="Notes (optional)"
                                    placeholderTextColor={colors.textSecondary}
                                    multiline
                                />
                                <Pressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={onLockPeriod} disabled={lockingPeriod}>
                                    {lockingPeriod ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>Lock Period</Text>}
                                </Pressable>
                            </View>

                            <View style={s.listHeaderWrap}>
                                <Text style={[s.blockTitle, { color: colors.textSecondary }]}>Existing Periods</Text>
                            </View>
                        </>
                    }
                    renderItem={({ item }) => {
                        const start = format(new Date(toDateInput(item.periodStart)), 'dd MMM yyyy');
                        const end = format(new Date(toDateInput(item.periodEnd)), 'dd MMM yyyy');
                        const statusColor = item.status === 'CLOSED' ? colors.error : item.status === 'LOCKED' ? colors.warning : colors.success;
                        const disableActions = closingPeriod || reopeningPeriod;

                        return (
                            <View style={[s.periodRow, { backgroundColor: colors.card }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.periodRange, { color: colors.text }]}>{`${start} - ${end}`}</Text>
                                    <Text style={[s.meta, { color: colors.textSecondary }]}>{item.notes ?? 'No notes'}</Text>
                                </View>
                                <View style={s.periodActions}>
                                    <Text style={[s.statusTag, { color: statusColor }]}>{item.status}</Text>
                                    {item.status !== 'CLOSED' ? (
                                        <Pressable style={[s.inlineBtn, { borderColor: colors.error }]} onPress={() => onClose(item.id)} disabled={disableActions}>
                                            <Text style={{ color: colors.error, fontWeight: '700', fontSize: 12 }}>Close</Text>
                                        </Pressable>
                                    ) : (
                                        <Pressable style={[s.inlineBtn, { borderColor: colors.primary }]} onPress={() => onReopen(item.id)} disabled={disableActions}>
                                            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Reopen</Text>
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={<Text style={[s.emptyText, { color: colors.textSecondary }]}>No periods configured yet.</Text>}
                    contentContainerStyle={{ paddingBottom: 120 }}
                />
            )}
        </SafeAreaView>
    );
}

function ControlRow({
    label,
    value,
    onChange,
    colors,
    disabled,
}: {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
    colors: ColorPalette;
    disabled: boolean;
}) {
    return (
        <View style={rowStyles.wrap}>
            <Text style={[rowStyles.label, { color: colors.text }]}>{label}</Text>
            <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
    );
}

const rowStyles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    label: { fontSize: 14, fontWeight: '600' },
});

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
        back: { width: 58, fontWeight: '600', fontSize: 14 },
        title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        card: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.md },
        sectionTitle: { fontWeight: '700', fontSize: 14, marginBottom: Spacing.sm },
        pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        pendingCount: { fontWeight: '700', fontSize: 13 },
        approvalCard: {
            borderWidth: 1,
            borderRadius: Radius.md,
            padding: Spacing.sm,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        approvalTitle: { fontWeight: '700', fontSize: 13 },
        approvalActions: { flexDirection: 'row', gap: 6 },
        input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.sm, fontSize: 14 },
        notesInput: { minHeight: 72, textAlignVertical: 'top' },
        primaryBtn: { borderRadius: Radius.pill, alignItems: 'center', paddingVertical: Spacing.sm, marginTop: 4 },
        primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
        listHeaderWrap: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        blockTitle: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
        periodRow: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
            padding: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        periodRange: { fontWeight: '700', fontSize: 14 },
        meta: { fontSize: 12, marginTop: 2 },
        periodActions: { alignItems: 'flex-end', gap: 6 },
        statusTag: { fontWeight: '700', fontSize: 12 },
        inlineBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
        emptyText: { marginHorizontal: Spacing.lg, fontSize: 13 },
    });
