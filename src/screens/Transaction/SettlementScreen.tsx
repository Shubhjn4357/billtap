import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Portal, Surface, Text, useTheme, Chip, Divider } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { MotionPresence, MotionView } from '../../components/motion/Motion';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { DesignSystem } from '../../constants/DesignSystem';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useSettingsStore, useNetworkStore } from '../../store';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { transactionService } from '../../api/transactionService';
import { formatCurrency, formatDate, normalizeCurrencyCode } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';

type ReminderEntry = Awaited<ReturnType<typeof transactionService.getPendingReminders>>[number];

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

    const remindersQuery = useQuery({
        queryKey: ['transaction-pending-reminders'] as const,
        queryFn: async () => {
            return await transactionService.getPendingReminders();
        },
        staleTime: 20_000,
    });

    useFocusRefresh(async () => {
        await remindersQuery.refetch();
    }, {
        enabled: canManagePayments,
        minIntervalMs: 8_000,
    });

    const reminders = React.useMemo(() => remindersQuery.data ?? [], [remindersQuery.data]);

    const handleOpenSettlement = (entry: ReminderEntry) => {
        setSelected(entry);
        setAmountInput(entry.dueAmount > 0 ? String(entry.dueAmount) : '');
    };

    const handleCloseSettlement = () => {
        if (saving) return;
        setSelected(null);
        setAmountInput('');
    };

    const submitSettlement = async (markAsPaid: boolean) => {
        if (!selected) return;

        const parsedAmount = Number(amountInput || 0);
        if (!markAsPaid && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
            dialog.alert('Settlement', 'Enter a valid payment amount.');
            return;
        }

        setSaving(true);
        try {
            await transactionService.updatePayment(selected.id, {
                markAsPaid,
                paidAmount: markAsPaid ? selected.totalAmount : (selected.paidAmount + parsedAmount),
            });
            await remindersQuery.refetch();
            handleCloseSettlement();
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Settlement', error instanceof Error ? error.message : 'Failed to update payment.');
            }
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
                        Ask owner/admin to enable payments permission for your account.
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
                                    <Text variant="bodySmall">Paid: {formatCurrency(entry.paidAmount, entry.currency || activeCurrency)}</Text>
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
                <MotionPresence>
                    {selected && (
                        <MotionView style={[styles.drawerBackdrop, { backgroundColor: theme.colors.backdrop }]}>
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
                        </MotionView>
                    )}
                </MotionPresence>
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
