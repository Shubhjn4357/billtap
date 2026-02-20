
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, Surface, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { AppButton } from '../components/common/AppButton';
import { DesignSystem } from '../constants/DesignSystem';
import { billRepository } from '../repositories/billRepository';
import { formatCurrency, normalizeCurrencyCode } from '../utils/formatters';
import { shareBillPDF } from '../utils/pdfGenerator';
import { useSettingsStore, usePartyStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import QRCode from 'react-native-qrcode-svg';
import { shareViaWhatsApp, shareViaSMS } from '../utils/shareIntent';
import { useAppDialog } from '../components/providers/DialogProvider';
import type { DbTransaction } from '../types/db';

export const BillSuccessScreen = () => {
    const router = useRouter();
    const theme = useTheme();
    const params = useLocalSearchParams<{ id: string }>();
    const { id } = params;

    const [transaction, setTransaction] = useState<DbTransaction | null>(null);
    const [loading, setLoading] = useState(true);
    const { currencySymbol } = useSettingsStore();
    const { parties } = usePartyStore();
    const { user } = useAuth();
    const dialog = useAppDialog();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? 'INR');

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            const tx = await billRepository.getById(id);
            setTransaction(tx);
            setLoading(false);
        };
        load();
    }, [id]);

    const handleViewBill = async () => {
        if (!transaction) return;
        try {
            const parsedItems = transaction.itemsSnapshot ? JSON.parse(transaction.itemsSnapshot) : [];
            const billToShare = {
                ...transaction,
                items: parsedItems,
                userId: transaction.accountId || '',
                total: transaction.totalAmount
            };
            // Ignore type strictness on the mapper strictly for PDF generation
            await shareBillPDF(billToShare as any);
        } catch (error) {
            console.error('Failed to share PDF', error);
        }
    };

    const handleHome = () => {
        router.dismissAll();
        router.replace('/(main)/(tabs)/home');
    };

    const handleShareReminder = async (platform: 'whatsapp' | 'sms') => {
        if (!transaction) return;
        const partyPhone = transaction.partyId ? parties.find(p => p.id === transaction.partyId)?.phone : null;
        const phoneToUse = partyPhone || transaction.deliveryContactPhone;

        if (!phoneToUse) {
            dialog.alert('No Phone Number', 'This transaction does not have a phone number attached.');
            return;
        }

        const dueAmount = transaction.totalAmount - (transaction.paidAmount || 0);
        const billName = user?.businessName || 'Us';

        const message = `Hello${transaction.partyName ? ` ${transaction.partyName}` : ''},\n\nThis is a reminder from ${billName} regarding your recent bill (${transaction.billNumber}).\n\nTotal Amount: ${formatCurrency(transaction.totalAmount, activeCurrency)}\nDue Amount: ${formatCurrency(dueAmount, activeCurrency)}\n\nPlease pay at your earliest convenience.\nThank you!`;

        try {
            if (platform === 'whatsapp') {
                await shareViaWhatsApp(phoneToUse, message);
            } else {
                await shareViaSMS(phoneToUse, message);
            }
        } catch (error: any) {
            dialog.alert('Error', error.message || `Failed to open ${platform}`);
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

    // Generate UPI QR Data (Example format)
    // upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=CURRENCY
    // For now, we can use a placeholder or real if settings exist.
    // Assuming we might have UPI settings in the future.
    // For now, let's construct a basic UPI string if user has one, else just show Bill ID QR.
    const upiId = user?.upiId || '';
    const qrData = upiId
        ? `upi://pay?pa=${upiId}&pn=${user?.businessName || 'Merchant'}&am=${transaction.totalAmount}&cu=INR`
        : `BILL:${transaction.billNumber}`;

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content}>
                <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
                    <View style={styles.iconContainer}>
                        <IconButton
                            icon="check-circle"
                            size={64}
                            iconColor={theme.colors.primary}
                        />
                    </View>

                    <Text variant="headlineSmall" style={[styles.centerText, { fontWeight: 'bold' }]}>
                        Payment Success!
                    </Text>
                    <Text variant="bodyLarge" style={[styles.centerText, { color: theme.colors.secondary }]}>
                        {formatCurrency(transaction.totalAmount, activeCurrency)}
                    </Text>

                    <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant }]} />

                    <View style={[styles.qrContainer, { backgroundColor: theme.colors.elevation.level1 }]}>
                        {/* We use QRCode SVG if available, else fallback text */}
                        <QRCode
                            value={qrData}
                            size={180}
                            color={theme.colors.onSurface}
                            backgroundColor={theme.colors.surface}
                        />
                        <Text variant="labelSmall" style={{ marginTop: 12, color: theme.colors.outline }}>
                            Scan to View/Pay
                        </Text>
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

                    <View style={styles.actions}>
                        <AppButton
                            mode="contained"
                            onPress={handleViewBill}
                            icon="file-document-outline"
                            style={styles.actionBtn}
                        >
                            View Bill / Print
                        </AppButton>

                        {transaction.paymentStatus !== 'PAID' && ((transaction.partyId ? parties.find(p => p.id === transaction.partyId)?.phone : null) || transaction.deliveryContactPhone) && (
                            <View style={styles.shareRow}>
                                <AppButton
                                    mode="contained-tonal"
                                    onPress={() => void handleShareReminder('whatsapp')}
                                    icon="whatsapp"
                                    style={[styles.actionBtn, styles.flexBtn]}
                                    buttonColor="#25D366" // Optional brand coloring
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
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: DesignSystem.spacing.sm,
    },
    actions: {
        width: '100%',
        marginTop: DesignSystem.spacing.xl,
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
    }
});
