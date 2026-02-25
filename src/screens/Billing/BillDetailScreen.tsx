import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, useTheme } from 'react-native-paper';
import { WebView } from 'react-native-webview';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { businessSuiteService } from '../../api/businessSuiteService';
import { billRepository } from '../../repositories/billRepository';
import { DesignSystem } from '../../constants/DesignSystem';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationStore, usePartyStore, useSettingsStore } from '../../store';
import { generateBillHTML } from '../../utils/billTemplate';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { printBill, shareBillPDF } from '../../utils/pdfGenerator';
import { shareViaSMS, shareViaWhatsApp } from '../../utils/shareIntent';
import { buildUpiPaymentUri, buildUpiQrImageUrl, isValidUpiId, sanitizeUpiId } from '../../utils/upi';
import type { Bill, BillItem } from '../../types';
import type { DbTransaction } from '../../types/db';

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const getSingleParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

const normalizeBillType = (value: unknown): Bill['type'] => {
    if (value === 'PURCHASE' || value === 'RETURN_INWARD' || value === 'RETURN_OUTWARD') {
        return value;
    }
    return 'SALE';
};

const normalizeBillMode = (value: unknown): Bill['billMode'] => {
    return value === 'ESTIMATE' ? 'ESTIMATE' : 'GST';
};

export const BillDetailScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const dialog = useAppDialog();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = getSingleParam(params.id);

    const { user } = useAuth();
    const { currencySymbol } = useSettingsStore();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const organizationSettings = useOrganizationStore((state) => state.context.settings);
    const parties = usePartyStore((state) => state.parties);

    const [loading, setLoading] = useState(true);
    const [transaction, setTransaction] = useState<DbTransaction | null>(null);
    const [billPayload, setBillPayload] = useState<Bill | null>(null);
    const [actionLoading, setActionLoading] = useState<'print' | 'pdf' | 'whatsapp' | 'sms' | null>(null);

    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? 'INR');

    const configuredUpiId = useMemo(() => {
        const settings = asRecord(organizationSettings);
        const payment = asRecord(settings.payment);
        const settingsUpiId = typeof payment.upiId === 'string' ? sanitizeUpiId(payment.upiId) : '';
        const userUpiId = typeof user?.upiId === 'string' ? sanitizeUpiId(user.upiId) : '';
        const resolvedUpiId = settingsUpiId || userUpiId;
        return isValidUpiId(resolvedUpiId) ? resolvedUpiId : '';
    }, [organizationSettings, user?.upiId]);

    const dueAmount = useMemo(() => {
        if (!transaction) return 0;
        return Math.max(transaction.totalAmount - (transaction.paidAmount ?? 0), 0);
    }, [transaction]);

    const billHtml = useMemo(() => {
        if (!billPayload) return '';
        return generateBillHTML(billPayload);
    }, [billPayload]);

    const buildBillPayload = useCallback(async (entry: DbTransaction): Promise<Bill> => {
        let businessName = entry.businessName?.trim()
            || user?.businessName?.trim()
            || user?.displayName?.trim()
            || '';
        let businessAddress = entry.businessAddress?.trim()
            || user?.address?.trim()
            || entry.billingAddress?.trim()
            || '';
        let gstNumber = entry.gstNumber?.trim() || user?.gstNumber?.trim() || '';

        try {
            const orgContext = await businessSuiteService.getCurrentOrganization(selectedOrganizationId ?? undefined);
            businessName = orgContext.organization.name?.trim() || businessName;
            businessAddress = orgContext.organization.address?.trim() || businessAddress;
            gstNumber = orgContext.organization.gstNumber?.trim() || gstNumber;
        } catch {
            // Continue with local/cached profile values.
        }

        const parsedItems: BillItem[] = (() => {
            try {
                if (!entry.itemsSnapshot) return [];
                const raw = JSON.parse(entry.itemsSnapshot);
                return Array.isArray(raw) ? raw : [];
            } catch {
                return [];
            }
        })();

        const settings = asRecord(organizationSettings);
        const customization = asRecord(settings.customization);
        const payment = asRecord(settings.payment);
        const print = asRecord(settings.print);
        const partyProfile = entry.partyId
            ? parties.find((party) => party.id === entry.partyId)
            : undefined;

        const isInboundFlow = entry.type === 'PURCHASE' || entry.type === 'RETURN_INWARD';
        const paperSizeCandidate = typeof print.paperSize === 'string' ? print.paperSize.toUpperCase() : 'A4';
        const paperSize: Bill['paperSize'] = (
            paperSizeCandidate === 'A5'
            || paperSizeCandidate === '2INCH'
            || paperSizeCandidate === '3INCH'
        ) ? paperSizeCandidate : 'A4';

        const upiIdFromSettings = typeof payment.upiId === 'string'
            ? sanitizeUpiId(payment.upiId)
            : '';
        const resolvedUpiId = upiIdFromSettings || configuredUpiId || '';
        const qrPayload = buildUpiPaymentUri({
            upiId: resolvedUpiId,
            amount: Math.max(entry.totalAmount - (entry.paidAmount ?? 0), 0),
            payeeName: businessName || user?.businessName || 'Business',
            note: entry.billNumber ? `Bill ${entry.billNumber}` : undefined,
            transactionRef: entry.id,
            currency: entry.currency || activeCurrency,
        });
        const qrImageDataUrl = qrPayload ? buildUpiQrImageUrl(qrPayload, 240) : undefined;
        const signatureImageUrl = typeof settings.signatureImageUrl === 'string'
            ? settings.signatureImageUrl
            : (typeof customization.signatureImageUrl === 'string' ? customization.signatureImageUrl : '');

        return {
            id: entry.id,
            userId: entry.organizationId || user?.uid || '',
            type: normalizeBillType(entry.type),
            billMode: normalizeBillMode(entry.billMode),
            partyId: entry.partyId ?? undefined,
            customerName: entry.partyName || partyProfile?.name || 'Walk-in',
            customerPhone: entry.partyPhone || partyProfile?.phone || entry.deliveryContactPhone || undefined,
            customerAddress: isInboundFlow
                ? (entry.billingAddress || partyProfile?.address || undefined)
                : (partyProfile?.address || entry.billingAddress || undefined),
            businessName: businessName || 'Business',
            businessAddress: businessAddress || undefined,
            gstNumber: gstNumber || undefined,
            currency: entry.currency || activeCurrency,
            billNumber: entry.billNumber || undefined,
            billDate: entry.billDate || entry.createdAt || new Date().toISOString(),
            paymentMode: (entry.paymentMode as Bill['paymentMode']) || 'CASH',
            printerType: print.printerType === 'THERMAL' ? 'THERMAL' : 'STANDARD',
            paperSize,
            acknowledgmentText: typeof customization.acknowledgmentText === 'string' ? customization.acknowledgmentText : undefined,
            footerText: typeof customization.footerText === 'string' ? customization.footerText : undefined,
            upiId: resolvedUpiId || undefined,
            qrImageDataUrl,
            signatureImageUrl: signatureImageUrl || undefined,
            taxAmount: entry.taxAmount || 0,
            items: parsedItems,
            total: entry.totalAmount,
            billingAddress: entry.billingAddress || undefined,
            deliveryAddress: entry.deliveryAddress || undefined,
            createdAt: entry.createdAt || new Date().toISOString(),
        };
    }, [
        activeCurrency,
        configuredUpiId,
        organizationSettings,
        parties,
        selectedOrganizationId,
        user?.address,
        user?.businessName,
        user?.displayName,
        user?.gstNumber,
        user?.uid,
    ]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!id) {
                setTransaction(null);
                setBillPayload(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const entry = await billRepository.getById(id);
                if (cancelled) return;
                setTransaction(entry);

                if (!entry) {
                    setBillPayload(null);
                    return;
                }

                const payload = await buildBillPayload(entry);
                if (cancelled) return;
                setBillPayload(payload);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [buildBillPayload, id]);

    const openShareIntent = useCallback(async (platform: 'whatsapp' | 'sms') => {
        if (!transaction) return;
        const partyPhone = transaction.partyPhone || parties.find((party) => party.id === transaction.partyId)?.phone;
        if (!partyPhone) {
            dialog.alert('Share', 'No party phone number found for this bill.');
            return;
        }

        const message = [
            `Hello${transaction.partyName ? ` ${transaction.partyName}` : ''},`,
            '',
            `Bill ${transaction.billNumber || transaction.id.slice(0, 8).toUpperCase()}`,
            `Total: ${formatCurrency(transaction.totalAmount, activeCurrency)}`,
            `Paid: ${formatCurrency(transaction.paidAmount ?? 0, activeCurrency)}`,
            `Due: ${formatCurrency(Math.max(transaction.totalAmount - (transaction.paidAmount ?? 0), 0), activeCurrency)}`,
        ].join('\n');

        setActionLoading(platform);
        try {
            if (platform === 'whatsapp') {
                await shareViaWhatsApp(partyPhone, message);
            } else {
                await shareViaSMS(partyPhone, message);
            }
        } catch (error: unknown) {
            dialog.alert('Share', error instanceof Error ? error.message : 'Unable to open share intent.');
        } finally {
            setActionLoading(null);
        }
    }, [activeCurrency, dialog, parties, transaction]);

    const handlePrint = useCallback(async () => {
        if (!billPayload) return;
        setActionLoading('print');
        try {
            await printBill(billPayload);
        } catch (error: unknown) {
            dialog.alert('Print', error instanceof Error ? error.message : 'Unable to print bill.');
        } finally {
            setActionLoading(null);
        }
    }, [billPayload, dialog]);

    const handleSharePdf = useCallback(async () => {
        if (!billPayload) return;
        setActionLoading('pdf');
        try {
            await shareBillPDF(billPayload);
        } catch (error: unknown) {
            dialog.alert('Share PDF', error instanceof Error ? error.message : 'Unable to share bill PDF.');
        } finally {
            setActionLoading(null);
        }
    }, [billPayload, dialog]);

    const subtitle = transaction
        ? `${transaction.billNumber || transaction.id.slice(0, 8).toUpperCase()} • ${formatCurrency(transaction.totalAmount, activeCurrency)}`
        : 'Bill details';

    const qrHint = !configuredUpiId
        ? 'UPI ID missing. Add payment UPI in Business/Profile setup to include QR on bill.'
        : dueAmount <= 0
            ? 'Bill is fully paid.'
            : null;

    return (
        <ScreenWrapper>
            <View style={styles.container}>
                <PageHeaderCard
                    title="Bill Preview"
                    subtitle={subtitle}
                    right={<AppButton mode="text" compact onPress={() => router.back()}>Close</AppButton>}
                />

                {loading ? (
                    <View style={styles.centeredState}>
                        <Text>Loading bill...</Text>
                    </View>
                ) : !billPayload ? (
                    <View style={styles.centeredState}>
                        <Text>Bill not found.</Text>
                    </View>
                ) : (
                    <>
                        {qrHint ? (
                            <AppCard style={styles.hintCard}>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    {qrHint}
                                </Text>
                            </AppCard>
                        ) : null}

                        <AppCard style={styles.previewCard} contentStyle={styles.previewCardContent}>
                            <WebView
                                originWhitelist={['*']}
                                source={{ html: billHtml }}
                                style={styles.previewWebView}
                            />
                        </AppCard>

                        <AppCard style={styles.actionsCard}>
                            <View style={styles.actionsRow}>
                                <AppButton
                                    mode="contained"
                                    icon="printer"
                                    style={styles.actionButton}
                                    onPress={() => { void handlePrint(); }}
                                    loading={actionLoading === 'print'}
                                    disabled={actionLoading !== null}
                                >
                                    Print
                                </AppButton>
                                <AppButton
                                    mode="contained-tonal"
                                    icon="file-document-outline"
                                    style={styles.actionButton}
                                    onPress={() => { void handleSharePdf(); }}
                                    loading={actionLoading === 'pdf'}
                                    disabled={actionLoading !== null}
                                >
                                    PDF
                                </AppButton>
                                <AppButton
                                    mode="outlined"
                                    icon="whatsapp"
                                    style={styles.actionButton}
                                    onPress={() => { void openShareIntent('whatsapp'); }}
                                    loading={actionLoading === 'whatsapp'}
                                    disabled={actionLoading !== null}
                                >
                                    WhatsApp
                                </AppButton>
                                <AppButton
                                    mode="outlined"
                                    icon="message-text-outline"
                                    style={styles.actionButton}
                                    onPress={() => { void openShareIntent('sms'); }}
                                    loading={actionLoading === 'sms'}
                                    disabled={actionLoading !== null}
                                >
                                    SMS
                                </AppButton>
                            </View>
                        </AppCard>
                    </>
                )}
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centeredState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hintCard: {
        marginBottom: DesignSystem.spacing.xs,
    },
    previewCard: {
        flex: 1,
        minHeight: 420,
        marginBottom: DesignSystem.spacing.sm,
    },
    previewCardContent: {
        flex: 1,
        padding: 0,
    },
    previewWebView: {
        flex: 1,
        backgroundColor: 'transparent',
        minHeight: 420,
    },
    actionsCard: {
        marginBottom: 0,
    },
    actionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
    },
    actionButton: {
        flexGrow: 1,
    },
});
