// @ts-nocheck
import { useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
    useColorScheme,
    Alert,
    ActivityIndicator,
    Share,
    Image,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format, parseISO } from 'date-fns';
import { invoiceApi, settingsApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../constants/theme';
import type { Invoice } from '../../../types/domain';
import { buildUpiPaymentUri, buildUpiQrImageUrl, isValidUpiId, sanitizeUpiId } from '../../../utils/upi';
import { useAuthStore } from '../../../store/authStore';

export default function InvoiceDetailScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const { id } = useLocalSearchParams<{ id: string }>();
    const qc = useQueryClient();
    const s = styles(colors);
    const business = useAuthStore((state) => state.business);

    const { data, isLoading } = useQuery({
        queryKey: ['invoice', id],
        queryFn: () => invoiceApi.get(id!),
        enabled: !!id,
    });

    const { data: generalSettings } = useQuery({
        queryKey: ['settings-section', 'GENERAL'],
        queryFn: () => settingsApi.get('GENERAL'),
        staleTime: 5 * 60_000,
    });
    const { data: invoicePrintSettings } = useQuery({
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
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed'),
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
            const symbol = currencyCode === 'INR' ? '₹' : `${currencyCode} `;
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
        return {
            upiId: isValidUpiId(upiIdRaw) ? upiIdRaw : '',
            receiverName,
        };
    }, [generalSettings?.data]);

    const dueAmount = Math.max((invoice?.totalInvoiceValue ?? 0) - (invoice?.paidAmount ?? 0), 0);
    const printConfig = useMemo(() => {
        const raw = (invoicePrintSettings?.data ?? {}) as Record<string, unknown>;
        return {
            printLayoutType: raw.print_layout_type === 'THERMAL' ? 'THERMAL' : 'REGULAR',
            printTextSize: raw.print_text_size === 'SMALL' || raw.print_text_size === 'LARGE' ? raw.print_text_size : 'MEDIUM',
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
            Alert.alert('UPI', 'No UPI app found on this device.');
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
            printConfig,
        });
        try {
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
        } catch {
            Alert.alert('Error', 'Could not generate PDF');
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
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>Back</Text></Pressable>
                <Text style={[s.headerTitle, { color: colors.text }]} numberOfLines={1}>{invoice.invoiceNumber}</Text>
                <View style={s.headerActions}>
                    <Pressable onPress={handleShare}><Text style={s.iconBtn}>Share</Text></Pressable>
                    <Pressable onPress={handlePrint}><Text style={s.iconBtn}>PDF</Text></Pressable>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[s.statusBanner, { backgroundColor: statusColor + '22' }]}>
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
                            onPress={() => Alert.alert('Mark as Paid', 'Record full payment?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Mark Paid', onPress: () => markPaid() },
                            ])}
                            disabled={paymentPending}
                        >
                            {paymentPending ? <ActivityIndicator color="#fff" /> : <Text style={s.actionBtnText}>Mark as Paid</Text>}
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

function generateInvoiceHtml(invoice: Invoice, extras?: {
    qrImageUrl?: string;
    upiId?: string;
    dueAmount?: number;
    currencyCode?: string;
    businessName?: string;
    businessAddress?: string;
    businessPhone?: string;
    businessEmail?: string;
    businessGstin?: string;
    businessLogoUrl?: string;
    printConfig?: {
        printLayoutType: 'REGULAR' | 'THERMAL';
        printTextSize: 'SMALL' | 'MEDIUM' | 'LARGE';
        pageSize: string;
        orientation: 'PORTRAIT' | 'LANDSCAPE';
        printCompanyInfo: boolean;
        printCompanyName: boolean;
        printCompanyLogo: boolean;
        printAddressEmailPhone: boolean;
        printGstinOnSale: boolean;
        printTaxDetailsBreakup: boolean;
        printDescription: boolean;
        printTermsAndConditions: boolean;
        printSignatureText: boolean;
        customSignatureText: string;
        printPaymentMode: boolean;
        printReceivedAmount: boolean;
        printBalanceAmount: boolean;
        printTotalItemQuantity: boolean;
        printPageNumbers: boolean;
        printAmountWithDecimal: boolean;
    };
}): string {
    const config = extras?.printConfig;
    const currency = (extras?.currencyCode ?? 'INR').toUpperCase();
    const decimals = config?.printAmountWithDecimal ? 2 : 0;
    const textSize = config?.printTextSize === 'SMALL' ? 11 : config?.printTextSize === 'LARGE' ? 15 : 13;
    const rawPageSize = String(config?.pageSize ?? 'A4').toUpperCase();
    const normalizedPageSize = rawPageSize.includes('80') ? '80mm'
        : rawPageSize.includes('58') ? '58mm'
            : rawPageSize.includes('A6') ? 'A6'
                : rawPageSize.includes('A5') ? 'A5'
                    : 'A4';
    const pageSize = config?.printLayoutType === 'THERMAL'
        ? `${normalizedPageSize === '80mm' || normalizedPageSize === '58mm' ? normalizedPageSize : '80mm'} auto`
        : `${normalizedPageSize} ${String(config?.orientation ?? 'PORTRAIT').toLowerCase()}`;
    const safe = (value: unknown) => String(value ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const money = (value: number) => {
        try {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency,
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(value);
        } catch {
            const symbol = currency === 'INR' ? '₹' : `${currency} `;
            return `${symbol}${Number(value ?? 0).toLocaleString('en-IN', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            })}`;
        }
    };

    const itemRows = (invoice.items ?? []).map((item) => `
        <tr>
          <td>${safe(item.description)}</td>
          <td style="text-align:right">${safe(item.quantity)}</td>
          <td style="text-align:right">${money(Number(item.rate ?? 0))}</td>
          <td style="text-align:right">${money(Number(item.total ?? 0))}</td>
        </tr>
    `).join('');
    const totalQuantity = (invoice.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

    const qrSection = extras?.qrImageUrl
        ? `<div style="margin-top:20px;text-align:center;">
             <img src="${extras.qrImageUrl}" style="width:180px;height:180px;object-fit:contain;" />
             <p style="font-size:${Math.max(textSize - 2, 10)}px;color:#666;">UPI: ${safe(extras.upiId || '')}</p>
             <p style="font-size:${Math.max(textSize - 2, 10)}px;color:#666;">Due: ${money(Number(extras.dueAmount ?? 0))}</p>
           </div>`
        : '';

    const companyInfoSection = config?.printCompanyInfo
        ? `<div style="margin-bottom:12px;">
            ${config.printCompanyLogo && extras?.businessLogoUrl ? `<img src="${safe(extras.businessLogoUrl)}" style="width:88px;height:88px;object-fit:contain;margin-bottom:6px;" />` : ''}
            ${config.printCompanyName ? `<h2 style="margin:0 0 4px 0;">${safe(extras?.businessName || 'Business')}</h2>` : ''}
            ${config.printAddressEmailPhone ? `<p style="margin:0;color:#666">${safe(extras?.businessAddress)}</p>
            <p style="margin:0;color:#666">${safe(extras?.businessPhone)} ${extras?.businessEmail ? `| ${safe(extras.businessEmail)}` : ''}</p>` : ''}
            ${config.printGstinOnSale && extras?.businessGstin ? `<p style="margin:0;color:#666">GSTIN: ${safe(extras.businessGstin)}</p>` : ''}
          </div>`
        : '';

    const taxBreakupSection = config?.printTaxDetailsBreakup
        ? `<div style="margin-top:10px;">
            ${Number(invoice.totalCgstAmount ?? 0) > 0 ? `<p style="margin:0;">CGST: ${money(Number(invoice.totalCgstAmount ?? 0))}</p>` : ''}
            ${Number(invoice.totalSgstAmount ?? 0) > 0 ? `<p style="margin:0;">SGST: ${money(Number(invoice.totalSgstAmount ?? 0))}</p>` : ''}
            ${Number(invoice.totalIgstAmount ?? 0) > 0 ? `<p style="margin:0;">IGST: ${money(Number(invoice.totalIgstAmount ?? 0))}</p>` : ''}
          </div>`
        : '';

    const paymentMetaSection = `
        ${config?.printReceivedAmount ? `<p style="margin:0;">Received: ${money(Number(invoice.paidAmount ?? 0))}</p>` : ''}
        ${config?.printBalanceAmount ? `<p style="margin:0;">Balance: ${money(Math.max(Number(invoice.totalInvoiceValue ?? 0) - Number(invoice.paidAmount ?? 0), 0))}</p>` : ''}
        ${config?.printPaymentMode ? `<p style="margin:0;">Status: ${safe(invoice.paymentStatus)}</p>` : ''}
    `;

    const signatureSection = config?.printSignatureText
        ? `<div style="margin-top:18px;text-align:right;">
            <p style="margin:0;color:#666;">${safe(config.customSignatureText || 'Authorized Signatory')}</p>
          </div>`
        : '';

    const termsSection = config?.printTermsAndConditions && invoice.termsAndConditions
        ? `<div style="margin-top:12px;"><strong>Terms & Conditions:</strong><p style="margin:4px 0 0 0;">${safe(invoice.termsAndConditions)}</p></div>`
        : '';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice</title>
<style>
@page{size:${pageSize}; margin:18px;}
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:0;color:#222;font-size:${textSize}px;}
h1{color:#007B83;margin:0 0 10px 0}
h2{color:#111}
table{width:100%;border-collapse:collapse}
th,td{padding:8px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}
.right{text-align:right}
.total{font-weight:700;font-size:${textSize + 1}px}
.footer{margin-top:12px;font-size:${Math.max(textSize - 2, 10)}px;color:#666;}
</style>
</head><body>
${companyInfoSection}
<h1>${safe(invoice.invoiceType ?? 'TAX_INVOICE')}</h1>
<p style="margin:0;">Invoice No: ${safe(invoice.invoiceNumber)}</p>
<p style="margin:0;">Date: ${safe(invoice.invoiceDate)}</p>
${invoice.partySnapshot ? `<p style="margin:6px 0 0 0;"><strong>Party:</strong> ${safe(invoice.partySnapshot.name)}</p>` : ''}
<table style="margin-top:12px;">
<thead>
<tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr>
</thead>
<tbody>${itemRows}</tbody>
</table>
${config?.printTotalItemQuantity ? `<p style="margin:8px 0 0 0;">Total Qty: ${safe(totalQuantity)}</p>` : ''}
<p class="total">Invoice Total: ${money(Number(invoice.totalInvoiceValue ?? 0))}</p>
${taxBreakupSection}
${paymentMetaSection}
${qrSection}
${config?.printDescription && invoice.notes ? `<p style="margin-top:12px;"><strong>Notes:</strong> ${safe(invoice.notes)}</p>` : ''}
${termsSection}
${signatureSection}
${config?.printPageNumbers ? '<div class="footer">Page 1</div>' : ''}
</body></html>`;
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    headerTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
    headerActions: { flexDirection: 'row', gap: Spacing.md },
    iconBtn: { fontSize: 12, fontWeight: '700', color: colors.primary },
    statusBanner: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.card, padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    invNum: { fontWeight: '700', fontSize: 18 },
    invDate: { fontSize: 12 },
    statusText: { fontWeight: '700', fontSize: 12 },
    totalAmt: { fontWeight: '800', fontSize: 22, marginTop: 4 },
    card: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.md },
    cardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
    partyName: { fontWeight: '700', fontSize: 15 },
    partyMeta: { fontSize: 12 },
    tableHeader: { flexDirection: 'row', paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    tableRow: { flexDirection: 'row', paddingVertical: Spacing.sm, borderBottomWidth: 0.5, alignItems: 'flex-start' },
    th: { flex: 1, fontWeight: '600', fontSize: 11 },
    td: { flex: 1, fontSize: 13 },
    tdSub: { fontSize: 10, marginTop: 2 },
    divider: { height: 1, marginVertical: Spacing.sm },
    actions: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    actionBtn: { flex: 1, borderRadius: Radius.pill, paddingVertical: Spacing.md, alignItems: 'center' },
    actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    qrWrap: { alignItems: 'center', gap: 6 },
    qrImage: { width: 220, height: 220, borderRadius: Radius.md },
    qrMeta: { fontSize: 12 },
    upiBtn: { borderRadius: Radius.pill, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, marginTop: 4 },
    upiBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
