import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, Surface, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { AppButton } from '../components/common/AppButton';
import { AppInput } from '../components/common/AppInput';
import { DesignSystem } from '../constants/DesignSystem';
import { billRepository } from '../repositories/billRepository';
import { formatCurrency, normalizeCurrencyCode } from '../utils/formatters';
import { printBill, shareBillPDF } from '../utils/pdfGenerator';
import { useSettingsStore, usePartyStore, useOrganizationStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import QRCode from 'react-native-qrcode-svg';
import { shareViaWhatsApp, shareViaSMS } from '../utils/shareIntent';
import { useAppDialog } from '../components/providers/DialogProvider';
import { buildUpiPaymentUri, isValidUpiId, sanitizeUpiId } from '../utils/upi';
import type { DbTransaction } from '../types/db';

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const getSingleParam = (value?: string | string[]) => {
    return Array.isArray(value) ? value[0] : value;
};

export const BillSuccessScreen = () => {
    const router = useRouter();
    const theme = useTheme();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = getSingleParam(params.id);

    const [transaction, setTransaction] = useState<DbTransaction | null>(null);
    const [loading, setLoading] = useState(true);
    const [partialPaidInput, setPartialPaidInput] = useState('');
    const [savingPayment, setSavingPayment] = useState(false);

    const { currencySymbol } = useSettingsStore();
    const { parties } = usePartyStore();
    const organizationSettings = useOrganizationStore((state) => state.context.settings);
    const { user } = useAuth();
    const dialog = useAppDialog();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? 'INR');

    const loadTransaction = useCallback(async () => {
        if (!id) {
            setTransaction(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const tx = await billRepository.getById(id);
            setTransaction(tx);
            setPartialPaidInput(tx?.paidAmount ? String(tx.paidAmount) : '');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void loadTransaction();
    }, [loadTransaction]);

    const configuredUpiId = useMemo(() => {
        const settings = asRecord(organizationSettings);
        const payment = asRecord(settings.payment);
        const settingsUpiId = typeof payment.upiId === 'string' ? sanitizeUpiId(payment.upiId) : '';
        const userUpiId = typeof user?.upiId === 'string' ? sanitizeUpiId(user.upiId) : '';
        const resolved = settingsUpiId || userUpiId;
        return isValidUpiId(resolved) ? resolved : '';
    }, [organizationSettings, user?.upiId]);

    const dueAmount = useMemo(() => {
        if (!transaction) return 0;
        return Math.max(transaction.totalAmount - (transaction.paidAmount || 0), 0);
    }, [transaction]);

    const qrData = useMemo(() => {
        if (!transaction || !configuredUpiId || dueAmount <= 0) return null;

        return buildUpiPaymentUri({
            upiId: configuredUpiId,
            amount: dueAmount,
            payeeName: user?.businessName || 'Merchant',
            note: transaction.billNumber ? `Bill ${transaction.billNumber}` : undefined,
            transactionRef: transaction.id,
            currency: transaction.currency || activeCurrency,
        });
    }, [activeCurrency, configuredUpiId, dueAmount, transaction, user?.businessName]);

    const qrUnavailableMessage = useMemo(() => {
        if (!transaction) return '';
        if (dueAmount <= 0) return 'This bill is already fully paid. QR payment is not required.';
        if (!configuredUpiId) return 'UPI ID is missing. Add UPI ID in Profile Setup to enable QR payment collection.';
        return 'Unable to generate UPI QR for this bill.';
    }, [configuredUpiId, dueAmount, transaction]);

    const handleViewBill = async () => {
        if (!transaction) return;
        try {
            const parsedItems = transaction.itemsSnapshot ? JSON.parse(transaction.itemsSnapshot) : [];
            const billToShare = {
                ...transaction,
                items: parsedItems,
                userId: transaction.accountId || '',
                total: transaction.totalAmount,
            };
            await printBill(billToShare as any);
        } catch (error) {
            console.error('Failed to print bill', error);
            dialog.alert('Bill', 'Unable to print bill.');
        }
    };

    const handleShareBill = async () => {
        if (!transaction) return;
        try {
            const parsedItems = transaction.itemsSnapshot ? JSON.parse(transaction.itemsSnapshot) : [];
            const billToShare = {
                ...transaction,
                items: parsedItems,
                userId: transaction.accountId || '',
                total: transaction.totalAmount,
            };
            await shareBillPDF(billToShare as any);
        } catch (error) {
            console.error('Failed to share PDF', error);
            dialog.alert('Bill', 'Unable to share bill PDF.');
        }
    };

    const handleHome = () => {
        router.dismissAll();
        router.replace('/(main)/(tabs)/home');
    };

    const handleShareReminder = async (platform: 'whatsapp' | 'sms') => {
        if (!transaction) return;
        const partyPhone = transaction.partyId ? parties.find((p) => p.id === transaction.partyId)?.phone : null;
        const phoneToUse = partyPhone || transaction.deliveryContactPhone;

        if (!phoneToUse) {
            dialog.alert('No Phone Number', 'This transaction does not have a phone number attached.');
            return;
        }

        const pendingAmount = Math.max(transaction.totalAmount - (transaction.paidAmount || 0), 0);
        const billName = user?.businessName || 'Us';

        const message = `Hello${transaction.partyName ? ` ${transaction.partyName}` : ''},\n\nThis is a reminder from ${billName} regarding your recent bill (${transaction.billNumber}).\n\nTotal Amount: ${formatCurrency(transaction.totalAmount, activeCurrency)}\nDue Amount: ${formatCurrency(pendingAmount, activeCurrency)}\n\nPlease pay at your earliest convenience.\nThank you!`;

        try {
            if (platform === 'whatsapp') {
                await shareViaWhatsApp(phoneToUse, message);
            } else {
                await shareViaSMS(phoneToUse, message);
            }
        } catch (error: unknown) {
            dialog.alert('Error', error instanceof Error ? error.message : `Failed to open ${platform}`);
        }
    };

    const applyPaymentPreset = async (preset: 'FULL' | 'CREDIT' | 'PARTIAL') => {
        if (!transaction) return;

        let nextPaidAmount = transaction.paidAmount || 0;
        let nextStatus: 'PAID' | 'PARTIAL' | 'PENDING' = transaction.paymentStatus as 'PAID' | 'PARTIAL' | 'PENDING' || 'PENDING';
        let nextMode: string = transaction.paymentMode || 'CASH';

        if (preset === 'FULL') {
            nextPaidAmount = transaction.totalAmount;
            nextStatus = 'PAID';
            nextMode = 'CASH';
        } else if (preset === 'CREDIT') {
            nextPaidAmount = 0;
            nextStatus = 'PENDING';
            nextMode = 'CREDIT';
        } else {
            const parsedAmount = Number(partialPaidInput.replace(/[^0-9.]/g, ''));
            if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                dialog.alert('Payment', 'Enter a valid partial paid amount.');
                return;
            }
            if (parsedAmount > transaction.totalAmount) {
                dialog.alert('Payment', 'Partial amount cannot be greater than total bill amount.');
                return;
            }

            nextPaidAmount = parsedAmount;
            nextStatus = parsedAmount >= transaction.totalAmount ? 'PAID' : 'PARTIAL';
            nextMode = nextStatus === 'PAID' ? 'CASH' : 'CREDIT';
        }

        setSavingPayment(true);
        try {
            await billRepository.updatePayment(transaction.id, {
                paidAmount: nextPaidAmount,
                paymentStatus: nextStatus,
                paymentMode: nextMode,
            });

            const latest = await billRepository.getById(transaction.id);
            setTransaction(latest);
            setPartialPaidInput(nextPaidAmount > 0 ? String(nextPaidAmount) : '');
        } catch (error: unknown) {
            dialog.alert('Payment', error instanceof Error ? error.message : 'Failed to update payment.');
        } finally {
            setSavingPayment(false);
        }
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={[styles.center, { flex: 1 }]}>
                    <Text>Loading...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    if (!transaction) {
        return (
            <ScreenWrapper>
                <View style={[styles.center, { flex: 1 }]}>
                    <Text>Transaction not found</Text>
                    <AppButton onPress={handleHome}>Go Home</AppButton>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content}>
                <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
                    <View style={styles.iconContainer}>
                        <IconButton
                            icon={transaction.paymentStatus === 'PAID' ? 'check-circle' : 'receipt-text-check-outline'}
                            size={64}
                            iconColor={theme.colors.primary}
                        />
                    </View>

                    <Text variant="headlineSmall" style={[styles.centerText, { fontWeight: 'bold' }]}>
                        {transaction.paymentStatus === 'PAID' ? 'Bill Saved and Paid' : 'Bill Saved Successfully'}
                    </Text>
                    <Text variant="bodyLarge" style={[styles.centerText, { color: theme.colors.secondary }]}>
                        Total {formatCurrency(transaction.totalAmount, activeCurrency)}
                    </Text>

                    <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant }]} />

                    <View style={[styles.qrContainer, { backgroundColor: theme.colors.elevation.level1 }]}>
                        {qrData ? (
                            <>
                                <QRCode
                                    value={qrData}
                                    size={180}
                                    color={theme.colors.onSurface}
                                    backgroundColor={theme.colors.surface}
                                />
                                <Text variant="labelSmall" style={{ marginTop: 12, color: theme.colors.outline }}>
                                    Scan to Pay Pending Amount
                                </Text>
                                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                                    UPI ID: {configuredUpiId}
                                </Text>
                            </>
                        ) : (
                            <View style={styles.qrMissingContainer}>
                                <IconButton icon="qrcode-remove" size={40} iconColor={theme.colors.outline} />
                                <Text variant="titleSmall" style={styles.centerText}>QR Unavailable</Text>
                                <Text variant="bodySmall" style={[styles.centerText, { color: theme.colors.outline }]}> 
                                    {qrUnavailableMessage}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.infoRow}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>Bill No</Text>
                        <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>{transaction.billNumber}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>Date</Text>
                        <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                            {new Date(transaction.billDate).toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>Paid</Text>
                        <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                            {formatCurrency(transaction.paidAmount || 0, activeCurrency)}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>Due</Text>
                        <Text variant="bodyMedium" style={{ fontWeight: 'bold', color: dueAmount > 0 ? theme.colors.error : theme.colors.primary }}>
                            {formatCurrency(dueAmount, activeCurrency)}
                        </Text>
                    </View>

                    <View style={[styles.paymentSection, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: 8 }}>
                            Update Payment
                        </Text>
                        <View style={styles.paymentPresetRow}>
                            <AppButton
                                mode="contained"
                                style={[styles.flexBtn, styles.actionBtn]}
                                onPress={() => { void applyPaymentPreset('FULL'); }}
                                loading={savingPayment}
                                disabled={savingPayment}
                            >
                                Full Paid
                            </AppButton>
                            <AppButton
                                mode="outlined"
                                style={[styles.flexBtn, styles.actionBtn]}
                                onPress={() => { void applyPaymentPreset('CREDIT'); }}
                                loading={savingPayment}
                                disabled={savingPayment}
                            >
                                Credit
                            </AppButton>
                        </View>
                        <AppInput
                            label="Partial Paid Amount"
                            inputType="decimal"
                            value={partialPaidInput}
                            onChangeText={setPartialPaidInput}
                            placeholder="Enter paid amount"
                        />
                        <AppButton
                            mode="contained-tonal"
                            onPress={() => { void applyPaymentPreset('PARTIAL'); }}
                            loading={savingPayment}
                            disabled={savingPayment}
                            style={styles.actionBtn}
                        >
                            Save Partial Payment
                        </AppButton>
                    </View>

                    <View style={styles.actions}>
                        <AppButton
                            mode="contained"
                            onPress={handleViewBill}
                            icon="printer"
                            style={styles.actionBtn}
                        >
                            Print Bill
                        </AppButton>
                        <AppButton
                            mode="contained-tonal"
                            onPress={handleShareBill}
                            icon="file-document-outline"
                            style={styles.actionBtn}
                        >
                            Share PDF
                        </AppButton>

                        {transaction.paymentStatus !== 'PAID' && ((transaction.partyId ? parties.find((p) => p.id === transaction.partyId)?.phone : null) || transaction.deliveryContactPhone) && (
                            <View style={styles.shareRow}>
                                <AppButton
                                    mode="contained-tonal"
                                    onPress={() => void handleShareReminder('whatsapp')}
                                    icon="whatsapp"
                                    style={[styles.actionBtn, styles.flexBtn]}
                                    buttonColor="#25D366"
                                    textColor="#FFF"
                                >
                                    WhatsApp
                                </AppButton>
                                <AppButton
                                    mode="contained-tonal"
                                    onPress={() => void handleShareReminder('sms')}
                                    icon="message-text-outline"
                                    style={[styles.actionBtn, styles.flexBtn]}
                                >
                                    SMS
                                </AppButton>
                            </View>
                        )}

                        <AppButton
                            mode="outlined"
                            onPress={handleHome}
                            style={styles.actionBtn}
                        >
                            Back to Home
                        </AppButton>
                    </View>
                </Surface>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: DesignSystem.spacing.lg,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        padding: DesignSystem.spacing.xl,
        borderRadius: DesignSystem.radius.lg,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: DesignSystem.spacing.md,
    },
    centerText: {
        textAlign: 'center',
        marginBottom: DesignSystem.spacing.xs,
    },
    divider: {
        height: 1,
        width: '100%',
        marginVertical: DesignSystem.spacing.lg,
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: DesignSystem.spacing.lg,
        padding: 16,
        borderRadius: 8,
        width: '100%',
    },
    qrMissingContainer: {
        width: '100%',
        alignItems: 'center',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: DesignSystem.spacing.sm,
    },
    paymentSection: {
        width: '100%',
        borderWidth: 1,
        borderRadius: DesignSystem.radius.md,
        padding: DesignSystem.spacing.md,
        marginTop: DesignSystem.spacing.sm,
    },
    paymentPresetRow: {
        flexDirection: 'row',
        gap: DesignSystem.spacing.sm,
        width: '100%',
    },
    actions: {
        width: '100%',
        marginTop: DesignSystem.spacing.lg,
    },
    actionBtn: {
        marginBottom: DesignSystem.spacing.md,
    },
    shareRow: {
        flexDirection: 'row',
        gap: DesignSystem.spacing.md,
        width: '100%',
    },
    flexBtn: {
        flex: 1,
    },
});
