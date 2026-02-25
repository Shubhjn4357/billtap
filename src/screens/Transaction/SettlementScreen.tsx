import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Portal, Surface, Text, useTheme, Chip, Divider } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';

import { useAppDialog } from '../../components/providers/DialogProvider';
import { DesignSystem } from '../../constants/DesignSystem';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useSettingsStore, useNetworkStore, useOrganizationStore } from '../../store';
// import { useFocusRefresh } from '../../hooks/useFocusRefresh';
// import { transactionService } from '../../api/transactionService';
import { formatCurrency, formatDate, normalizeCurrencyCode } from '../../utils/formatters';
// import { isNetworkLikeError } from '../../utils/errorGuards';
import { billRepository } from '../../repositories/billRepository';
import { useAuth } from '../../hooks/useAuth';

import type { DbTransaction } from '../../types/db';

type ReminderEntry = DbTransaction & { dueAmount: number };

export const SettlementScreen = () => {
    const theme = useTheme();
    const dialog = useAppDialog();
    const { canManagePayments } = useOrganizationAccess();
    const { currencySymbol } = useSettingsStore();
    const { isConnected, isInternetReachable } = useNetworkStore();
    const activeCurrency = normalizeCurrencyCode(currencySymbol);
    const isOffline = isConnected === false || isInternetReachable === false;
    const [selected, setSelected] = React.useState<ReminderEntry | null>(null);
    const [amountInput, setAmountInput] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const { user } = useAuth();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const organizationId = selectedOrganizationId ?? user?.uid ?? null;

    const remindersQuery = useQuery({
        queryKey: ['transaction-pending-reminders', organizationId] as const,
        queryFn: async () => {
            if (!organizationId) return [];
            const data = await billRepository.getUnpaid(organizationId);
            return data.map(item => ({
                ...item,
                dueAmount: item.totalAmount - (item.paidAmount || 0),
            }));
        },
        enabled: !!organizationId,
        staleTime: 5000,
    });

    const reminders = remindersQuery.data || [];

    const handleOpenSettlement = (entry: ReminderEntry) => {
        setSelected(entry);
        setAmountInput('');
    };

    const handleCloseSettlement = () => {
        setSelected(null);
        setAmountInput('');
    };

    // ...

    const submitSettlement = async (markAsPaid: boolean) => {
        if (!selected) return;

        const parsedAmount = Number(amountInput || 0);
        if (!markAsPaid && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
            dialog.alert('Settlement', 'Enter a valid payment amount.');
            return;
        }

        setSaving(true);
        try {
            const currentPaid = selected.paidAmount || 0;
            const nextPaid = markAsPaid ? selected.totalAmount : (currentPaid + parsedAmount);
            const nextStatus = nextPaid >= selected.totalAmount ? 'PAID' : 'PARTIAL';
            const nextMode = nextStatus === 'PAID' ? 'CASH' : 'CREDIT';

            await billRepository.updatePayment(selected.id, {
                paidAmount: nextPaid,
                paymentStatus: nextStatus,
                paymentMode: nextMode,
            });

            await remindersQuery.refetch();
            handleCloseSettlement();
        } catch (error: unknown) {
            dialog.alert('Settlement', error instanceof Error ? error.message : 'Failed to update payment.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScreenWrapper>
            {!canManagePayments ? (
                <AppCard>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                        Payments access is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                        Ask your organization owner to enable payments permission for your account.
                    </Text>
                </AppCard>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <PageHeaderCard
                        title="Unpaid Settlements"
                        subtitle="Track pending invoices and settle dues quickly."
                    />

                    <View style={styles.statusRow}>
                        <Chip compact icon={isOffline ? 'wifi-off' : 'wifi'}>
                            {isOffline ? 'Offline mode' : 'Online'}
                        </Chip>
                        <Chip compact icon="clock-outline">
                            {reminders.length} pending
                        </Chip>
                    </View>

                    {reminders.length === 0 ? (
                        <AppCard>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                No unpaid invoices found.
                            </Text>
                        </AppCard>
                    ) : (
                        reminders.map((entry, index) => (
                            <AppCard key={entry.id} animationDelay={Math.min(index * 26, 180)}>
                                <View style={styles.rowHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                                            #{entry.billNumber || entry.id.slice(0, 8)}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {entry.partyName || 'Walk-in customer'}
                                        </Text>
                                    </View>
                                    <Chip compact>{entry.paymentStatus}</Chip>
                                </View>

                                <View style={styles.metricRow}>
                                    <Text variant="bodySmall">Total: {formatCurrency(entry.totalAmount, entry.currency || activeCurrency)}</Text>
                                    <Text variant="bodySmall">Paid: {formatCurrency(entry.paidAmount || 0, entry.currency || activeCurrency)}</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                                        Due: {formatCurrency(entry.dueAmount, entry.currency || activeCurrency)}
                                    </Text>
                                </View>

                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Due Date: {entry.dueDate ? formatDate(entry.dueDate) : '-'}
                                </Text>

                                <AppButton
                                    mode="contained"
                                    style={{ marginTop: DesignSystem.spacing.xs }}
                                    onPress={() => handleOpenSettlement(entry)}
                                >
                                    Settle Payment
                                </AppButton>
                            </AppCard>
                        ))
                    )}
                </ScrollView>
            )}

            <Portal>
                    {selected && (
                    <View style={[styles.drawerBackdrop, { backgroundColor: theme.colors.backdrop }]}>
                            <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseSettlement} />
                            <Surface
                                style={[
                                    styles.drawer,
                                    {
                                        backgroundColor: theme.colors.surface,
                                        borderColor: theme.colors.outline,
                                    },
                                ]}
                            >
                                <View style={styles.drawerHeader}>
                                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                                        Settle #{selected.billNumber || selected.id.slice(0, 8)}
                                    </Text>
                                    <Chip compact>{selected.paymentStatus}</Chip>
                                </View>
                                <Divider style={{ marginBottom: 10 }} />
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                                    Outstanding due: {formatCurrency(selected.dueAmount, selected.currency || activeCurrency)}
                                </Text>
                                <AppInput
                                    label="Payment Amount"
                                    inputType="decimal"
                                    value={amountInput}
                                    onChangeText={setAmountInput}
                                    placeholder="Enter amount"
                                />
                                <View style={styles.drawerButtonRow}>
                                    <AppButton
                                        mode="outlined"
                                        onPress={() => { void submitSettlement(false); }}
                                        loading={saving}
                                        disabled={saving}
                                    >
                                        Save Partial
                                    </AppButton>
                                    <AppButton
                                        mode="contained"
                                        onPress={() => { void submitSettlement(true); }}
                                        loading={saving}
                                        disabled={saving}
                                    >
                                        Mark as Paid
                                    </AppButton>
                                </View>
                            </Surface>
                    </View>
                )}
            </Portal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
    },
    statusRow: {
        flexDirection: 'row',
        gap: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.xs,
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: DesignSystem.spacing.sm,
        marginBottom: DesignSystem.spacing.xs,
    },
    metricRow: {
        gap: 2,
        marginBottom: 4,
    },
    drawerBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    drawer: {
        borderTopLeftRadius: DesignSystem.radius.xl,
        borderTopRightRadius: DesignSystem.radius.xl,
        borderWidth: 1,
        paddingHorizontal: DesignSystem.spacing.md,
        paddingTop: DesignSystem.spacing.md,
        paddingBottom: DesignSystem.spacing.lg,
    },
    drawerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DesignSystem.spacing.sm,
        marginBottom: 10,
    },
    drawerButtonRow: {
        flexDirection: 'row',
        gap: DesignSystem.spacing.xs,
        marginTop: DesignSystem.spacing.xs,
    },
});
