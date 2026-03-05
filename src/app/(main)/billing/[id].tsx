import { useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    RefreshControl,
    StyleSheet,
    useColorScheme,
    ActivityIndicator,
    Share,
    Image,
    Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { format, parseISO } from 'date-fns';
import { invoiceApi, settingsApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette, withAlpha } from '../../../constants/theme';
import { buildUpiPaymentUri, buildUpiQrImageUrl, isValidUpiId, sanitizeUpiId } from '../../../utils/upi';
import { useAuthStore } from '../../../store/authStore';
import { generateInvoiceHtml, type InvoicePrintConfig } from '../../../utils/invoiceHtml';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useAppDialog } from '../../../components/providers/DialogProvider';

export default function InvoiceDetailScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const { id } = useLocalSearchParams<{ id: string }>();
    const qc = useQueryClient();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/billing');
    const business = useAuthStore((state) => state.business);
    const dialog = useAppDialog();

    const openInfoDialog = (title: string, message: string) => {
        dialog.alert(title, message);
    };

    const { data, isLoading, isRefetching: invoiceRefetching, refetch: refetchInvoice } = useQuery({
        queryKey: ['invoice', id],
        queryFn: () => invoiceApi.get(id!),
        enabled: !!id,
    });

    const { data: generalSettings, isRefetching: generalRefetching, refetch: refetchGeneralSettings } = useQuery({
        queryKey: ['settings-section', 'GENERAL'],
        queryFn: () => settingsApi.get('GENERAL'),
        staleTime: 5 * 60_000,
    });
    const { data: invoicePrintSettings, isRefetching: printRefetching, refetch: refetchPrintSettings } = useQuery({
        queryKey: ['settings-section', 'INVOICE_PRINT'],
        queryFn: () => settingsApi.get('INVOICE_PRINT'),
        staleTime: 5 * 60_000,
    });

    const { mutate: markPaid, isPending: paymentPending } = useMutation({
        mutationFn: () => invoiceApi.recordPayment(id!, { paidAmount: invoice?.totalInvoiceValue ?? 0, paymentMode: 'CASH' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['invoice', id] });
            qc.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (e) => openInfoDialog('Error', e instanceof Error ? e.message : 'Failed'),
    });

    const invoice = data?.data;
    const currencyCode = ((business?.currency as string | undefined) ?? 'INR').toUpperCase();

    const formatAmount = (amount: number, decimals = 2) => {
        try {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: currencyCode,
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(amount);
        } catch {
            const symbol = currencyCode === 'INR' ? 'Rs ' : `${currencyCode} `;
            return `${symbol}${amount.toLocaleString('en-IN', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            })}`;
        }
    };

    const paymentSettings = useMemo(() => {
        const raw = (generalSettings?.data ?? {}) as Record<string, unknown>;
        const upiIdRaw = typeof raw.payment_upi_id === 'string' ? sanitizeUpiId(raw.payment_upi_id) : '';
        const receiverName = typeof raw.payment_receiver_name === 'string' ? raw.payment_receiver_name.trim() : '';
        const signatureUrl = typeof raw.signature_url === 'string'
            ? raw.signature_url.trim()
            : typeof raw.signatureUrl === 'string'
                ? raw.signatureUrl.trim()
                : '';
        return {
            upiId: isValidUpiId(upiIdRaw) ? upiIdRaw : '',
            receiverName,
            signatureUrl,
        };
    }, [generalSettings?.data]);

    const dueAmount = Math.max((invoice?.totalInvoiceValue ?? 0) - (invoice?.paidAmount ?? 0), 0);
    const printConfig = useMemo<InvoicePrintConfig>(() => {
        const raw = (invoicePrintSettings?.data ?? {}) as Record<string, unknown>;
        return {
            printLayoutType: raw.print_layout_type === 'THERMAL' ? 'THERMAL' : 'REGULAR',
            printTextSize: raw.print_text_size === 'SMALL' || raw.print_text_size === 'LARGE'
                ? (raw.print_text_size as 'SMALL' | 'LARGE')
                : 'MEDIUM',
            pageSize: typeof raw.page_size === 'string' && raw.page_size.trim() ? raw.page_size : 'A4',
            orientation: raw.orientation === 'LANDSCAPE' ? 'LANDSCAPE' : 'PORTRAIT',
            printCompanyInfo: Boolean(raw.print_company_info ?? true),
            printCompanyName: Boolean(raw.print_company_name ?? true),
            printCompanyLogo: Boolean(raw.print_company_logo ?? false),
            printAddressEmailPhone: Boolean(raw.print_address_email_phone ?? true),
            printGstinOnSale: Boolean(raw.print_gstin_on_sale ?? true),
            printTaxDetailsBreakup: Boolean(raw.print_tax_details_breakup ?? true),
            printDescription: Boolean(raw.print_description ?? true),
            printTermsAndConditions: Boolean(raw.print_terms_and_conditions ?? false),
            printSignatureText: Boolean(raw.print_signature_text ?? false),
            printSignatureImage: Boolean(raw.print_signature_image ?? true),
            customSignatureText: typeof raw.custom_signature_text === 'string' ? raw.custom_signature_text.trim() : '',
            printPaymentMode: Boolean(raw.print_payment_mode ?? false),
            printReceivedAmount: Boolean(raw.print_received_amount ?? false),
            printBalanceAmount: Boolean(raw.print_balance_amount ?? false),
            printTotalItemQuantity: Boolean(raw.print_total_item_quantity ?? false),
            printPageNumbers: Boolean(raw.print_page_numbers ?? true),
            printAmountWithDecimal: Boolean(raw.print_amount_with_decimal ?? true),
        };
    }, [invoicePrintSettings?.data]);

    const upiPayload = useMemo(() => {
        if (!invoice || dueAmount <= 0 || !paymentSettings.upiId) return '';
        return buildUpiPaymentUri({
            upiId: paymentSettings.upiId,
            amount: dueAmount,
            payeeName: paymentSettings.receiverName || 'Vahi Merchant',
            note: `Invoice ${invoice.invoiceNumber}`,
            transactionRef: invoice.id,
            currency: currencyCode,
        });
    }, [currencyCode, dueAmount, invoice, paymentSettings.receiverName, paymentSettings.upiId]);

    const upiQrImageUrl = upiPayload ? buildUpiQrImageUrl(upiPayload, 260) : '';

    const handlePayViaUpi = async () => {
        if (!upiPayload) return;
        const supported = await Linking.canOpenURL(upiPayload);
        if (!supported) {
            openInfoDialog('UPI', 'No UPI app found on this device.');
            return;
        }
        await Linking.openURL(upiPayload);
    };

    const handlePrint = async () => {
        if (!invoice) return;
        const html = generateInvoiceHtml(invoice, {
            qrImageUrl: upiQrImageUrl || undefined,
            upiId: paymentSettings.upiId || undefined,
            dueAmount,
            currencyCode,
            businessName: business?.name ?? '',
            businessAddress: business?.address ?? '',
            businessPhone: business?.phone ?? '',
            businessEmail: business?.email ?? '',
            businessGstin: business?.gstin ?? '',
            businessLogoUrl: business?.logoUrl ?? '',
            signatureImageUrl: paymentSettings.signatureUrl || undefined,
            printConfig,
        });
        try {
            const { uri } = await printToFileAsync({ html });
            if (await isAvailableAsync()) {
                await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
        } catch {
            openInfoDialog('Error', 'Could not generate PDF');
        }
    };

    const handleShare = async () => {
        if (!invoice) return;
        const lines = [
            `Invoice ${invoice.invoiceNumber}`,
            `Amount: ${formatAmount(invoice.totalInvoiceValue, 2)}`,
        ];
        if (dueAmount > 0) {
            lines.push(`Due: ${formatAmount(dueAmount, 2)}`);
        }
        if (upiPayload) {
            lines.push(`UPI Pay Link: ${upiPayload}`);
        }
        await Share.share({ message: lines.join('\n') });
    };

    if (isLoading) return <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>;
    if (!invoice) return <View style={s.centered}><Text style={{ color: colors.textSecondary }}>Invoice not found.</Text></View>;

    const isPaid = invoice.paymentStatus === 'PAID';
    const statusColor = isPaid ? colors.success : invoice.paymentStatus === 'OVERDUE' ? colors.error : colors.warning;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={invoice.invoiceNumber}
                subtitle={invoice.invoiceType}
                onBackPress={smartBack}
                rightAction={(
                    <View style={s.headerActions}>
                        <Pressable style={s.iconBtnWrap} onPress={handleShare}>
                            <MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.primary} />
                        </Pressable>
                        <Pressable style={s.iconBtnWrap} onPress={handlePrint}>
                            <MaterialCommunityIcons name="file-pdf-box" size={19} color={colors.primary} />
                        </Pressable>
                    </View>
                )}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={invoiceRefetching || generalRefetching || printRefetching}
                        onRefresh={() => {
                            void Promise.all([refetchInvoice(), refetchGeneralSettings(), refetchPrintSettings()]);
                        }}
                    />
                )}
            >
                <View style={[s.statusBanner, { backgroundColor: withAlpha(statusColor, '22') }]}>
                    <View>
                        <Text style={[s.invNum, { color: colors.text }]}>{invoice.invoiceNumber}</Text>
                        <Text style={[s.invDate, { color: colors.textSecondary }]}>{format(parseISO(invoice.invoiceDate), 'dd MMMM yyyy')}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.statusText, { color: statusColor }]}>{invoice.paymentStatus}</Text>
                        <Text style={[s.totalAmt, { color: colors.text }]}>{formatAmount(invoice.totalInvoiceValue, 2)}</Text>
                    </View>
                </View>

                {invoice.partySnapshot && (
                    <View style={[s.card, { backgroundColor: colors.card }]}>
                        <Text style={[s.cardTitle, { color: colors.textSecondary }]}>BILL TO</Text>
                        <Text style={[s.partyName, { color: colors.text }]}>{invoice.partySnapshot.name}</Text>
                        {invoice.partySnapshot.gstin && <Text style={[s.partyMeta, { color: colors.textSecondary }]}>GSTIN: {invoice.partySnapshot.gstin}</Text>}
                        {invoice.partySnapshot.phone && <Text style={[s.partyMeta, { color: colors.textSecondary }]}>Phone: {invoice.partySnapshot.phone}</Text>}
                        {invoice.partySnapshot.address && <Text style={[s.partyMeta, { color: colors.textSecondary }]}>Address: {invoice.partySnapshot.address}</Text>}
                    </View>
                )}

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <Text style={[s.cardTitle, { color: colors.textSecondary }]}>ITEMS</Text>
                    <View style={s.tableHeader}>
                        <Text style={[s.th, { flex: 3, color: colors.textSecondary }]}>Description</Text>
                        <Text style={[s.th, { color: colors.textSecondary }]}>Qty</Text>
                        <Text style={[s.th, { color: colors.textSecondary }]}>Rate</Text>
                        <Text style={[s.th, { textAlign: 'right', color: colors.textSecondary }]}>Total</Text>
                    </View>
                    {(invoice.items ?? []).map((item, i) => (
                        <View key={i} style={[s.tableRow, { borderBottomColor: colors.border }]}>
                            <View style={{ flex: 3 }}>
                                <Text style={[s.td, { color: colors.text }]} numberOfLines={2}>{item.description}</Text>
                                {item.gstRate > 0 && <Text style={[s.tdSub, { color: colors.textSecondary }]}>GST {item.gstRate}%</Text>}
                            </View>
                            <Text style={[s.td, { color: colors.text }]}>{item.quantity}</Text>
                            <Text style={[s.td, { color: colors.text }]}>{formatAmount(item.rate, 2)}</Text>
                            <Text style={[s.td, { textAlign: 'right', color: colors.text, fontWeight: '600' }]}>{formatAmount(item.total, 2)}</Text>
                        </View>
                    ))}
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <TRow label="Taxable Value" val={invoice.totalTaxableValue} colors={colors} formatAmount={formatAmount} />
                    {invoice.totalCgstAmount > 0 && <TRow label="CGST" val={invoice.totalCgstAmount} colors={colors} formatAmount={formatAmount} />}
                    {invoice.totalSgstAmount > 0 && <TRow label="SGST" val={invoice.totalSgstAmount} colors={colors} formatAmount={formatAmount} />}
                    {invoice.totalIgstAmount > 0 && <TRow label="IGST" val={invoice.totalIgstAmount} colors={colors} formatAmount={formatAmount} />}
                    {invoice.discountAmount > 0 && <TRow label="Discount" val={-invoice.discountAmount} colors={colors} neg formatAmount={formatAmount} />}
                    {invoice.roundOffAmount !== 0 && <TRow label="Round Off" val={invoice.roundOffAmount} colors={colors} formatAmount={formatAmount} />}
                    <View style={[s.divider, { backgroundColor: colors.border }]} />
                    <TRow label="Invoice Total" val={invoice.totalInvoiceValue} colors={colors} bold formatAmount={formatAmount} />
                    <TRow label="Paid Amount" val={invoice.paidAmount} colors={colors} color={colors.success} formatAmount={formatAmount} />
                    {dueAmount > 0 && (
                        <TRow label="Balance Due" val={dueAmount} colors={colors} color={colors.error} bold formatAmount={formatAmount} />
                    )}
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}> 
                    <Text style={[s.cardTitle, { color: colors.textSecondary }]}>UPI PAYMENT QR</Text>
                    {upiQrImageUrl ? (
                        <View style={s.qrWrap}>
                            <Image source={{ uri: upiQrImageUrl }} style={s.qrImage} resizeMode="contain" />
                            <Text style={[s.qrMeta, { color: colors.textSecondary }]}>UPI: {paymentSettings.upiId}</Text>
                            <Text style={[s.qrMeta, { color: colors.textSecondary }]}>Due: {formatAmount(dueAmount, 2)}</Text>
                            <Pressable style={[s.upiBtn, { backgroundColor: colors.primary }]} onPress={handlePayViaUpi}>
                                <Text style={s.upiBtnText}>Pay via UPI App</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                            {dueAmount <= 0
                                ? 'Invoice is fully paid. QR not required.'
                                : 'Set payment UPI ID in Settings > General to enable bill QR payment.'}
                        </Text>
                    )}
                </View>

                {!isPaid && (
                    <View style={s.actions}>
                        <Pressable
                            style={[s.actionBtn, { backgroundColor: colors.success }]}
                            onPress={() =>
                                dialog.alert('Mark as Paid', 'Record full payment?', [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Mark Paid', onPress: () => markPaid() },
                                ])
                            }
                            disabled={paymentPending}
                        >
                            {paymentPending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.actionBtnText}>Mark as Paid</Text>}
                        </Pressable>
                        <Pressable style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={handlePrint}>
                            <Text style={s.actionBtnText}>Print / PDF</Text>
                        </Pressable>
                    </View>
                )}

                {invoice.notes && (
                    <View style={[s.card, { backgroundColor: colors.card }]}>
                        <Text style={[s.cardTitle, { color: colors.textSecondary }]}>NOTES</Text>
                        <Text style={{ color: colors.text }}>{invoice.notes}</Text>
                    </View>
                )}

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function TRow({ label, val, bold, neg, color, colors, formatAmount }: {
    label: string;
    val: number;
    bold?: boolean;
    neg?: boolean;
    color?: string;
    colors: ColorPalette;
    formatAmount: (value: number, decimals?: number) => string;
}) {
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: bold ? '700' : '400', fontSize: 13 }}>{label}</Text>
            <Text style={{ color: color ?? (bold ? colors.text : colors.textSecondary), fontWeight: bold ? '700' : '400', fontSize: 13 }}>
                {neg ? '-' : ''}{formatAmount(Math.abs(val), 2)}
            </Text>
        </View>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    headerActions: { flexDirection: 'row', gap: Spacing.md },
    iconBtnWrap: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceVariant,
    },
    statusBanner: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.card, padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    invNum: { fontWeight: '700', fontSize: 18 },
    invDate: { fontSize: 12 },
    statusText: { fontWeight: '700', fontSize: 12 },
    totalAmt: { fontWeight: '800', fontSize: 22, marginTop: 4 },
    card: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.md },
    cardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
    partyName: { fontWeight: '700', fontSize: 15 },
    partyMeta: { fontSize: 12 },
    tableHeader: { flexDirection: 'row', paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    tableRow: { flexDirection: 'row', paddingVertical: Spacing.sm, borderBottomWidth: 0.5, alignItems: 'flex-start' },
    th: { flex: 1, fontWeight: '600', fontSize: 11 },
    td: { flex: 1, fontSize: 13 },
    tdSub: { fontSize: 10, marginTop: 2 },
    divider: { height: 1, marginVertical: Spacing.sm },
    actions: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    actionBtn: { flex: 1, borderRadius: Radius.pill, paddingVertical: Spacing.md, alignItems: 'center' },
    actionBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    qrWrap: { alignItems: 'center', gap: 6 },
    qrImage: { width: 220, height: 220, borderRadius: Radius.md },
    qrMeta: { fontSize: 12 },
    upiBtn: { borderRadius: Radius.pill, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, marginTop: 4 },
    upiBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
});



