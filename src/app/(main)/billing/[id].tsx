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

export default function InvoiceDetailScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const { id } = useLocalSearchParams<{ id: string }>();
    const qc = useQueryClient();
    const s = styles(colors);

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

    const { mutate: markPaid, isPending: paymentPending } = useMutation({
        mutationFn: () => invoiceApi.recordPayment(id!, { paidAmount: invoice?.totalInvoiceValue ?? 0, paymentMode: 'CASH' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['invoice', id] });
            qc.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed'),
    });

    const invoice = data?.data;

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

    const upiPayload = useMemo(() => {
        if (!invoice || dueAmount <= 0 || !paymentSettings.upiId) return '';
        return buildUpiPaymentUri({
            upiId: paymentSettings.upiId,
            amount: dueAmount,
            payeeName: paymentSettings.receiverName || 'Vahi Merchant',
            note: `Invoice ${invoice.invoiceNumber}`,
            transactionRef: invoice.id,
            currency: 'INR',
        });
    }, [dueAmount, invoice, paymentSettings.receiverName, paymentSettings.upiId]);

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
            `Amount: Rs ${invoice.totalInvoiceValue.toLocaleString('en-IN')}`,
        ];
        if (dueAmount > 0) {
            lines.push(`Due: Rs ${dueAmount.toLocaleString('en-IN')}`);
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
                        <Text style={[s.totalAmt, { color: colors.text }]}>Rs {invoice.totalInvoiceValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
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
                            <Text style={[s.td, { color: colors.text }]}>{item.rate.toLocaleString('en-IN')}</Text>
                            <Text style={[s.td, { textAlign: 'right', color: colors.text, fontWeight: '600' }]}>{item.total.toLocaleString('en-IN')}</Text>
                        </View>
                    ))}
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <TRow label="Taxable Value" val={invoice.totalTaxableValue} colors={colors} />
                    {invoice.totalCgstAmount > 0 && <TRow label="CGST" val={invoice.totalCgstAmount} colors={colors} />}
                    {invoice.totalSgstAmount > 0 && <TRow label="SGST" val={invoice.totalSgstAmount} colors={colors} />}
                    {invoice.totalIgstAmount > 0 && <TRow label="IGST" val={invoice.totalIgstAmount} colors={colors} />}
                    {invoice.discountAmount > 0 && <TRow label="Discount" val={-invoice.discountAmount} colors={colors} neg />}
                    {invoice.roundOffAmount !== 0 && <TRow label="Round Off" val={invoice.roundOffAmount} colors={colors} />}
                    <View style={[s.divider, { backgroundColor: colors.border }]} />
                    <TRow label="Invoice Total" val={invoice.totalInvoiceValue} colors={colors} bold />
                    <TRow label="Paid Amount" val={invoice.paidAmount} colors={colors} color={colors.success} />
                    {dueAmount > 0 && (
                        <TRow label="Balance Due" val={dueAmount} colors={colors} color={colors.error} bold />
                    )}
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}> 
                    <Text style={[s.cardTitle, { color: colors.textSecondary }]}>UPI PAYMENT QR</Text>
                    {upiQrImageUrl ? (
                        <View style={s.qrWrap}>
                            <Image source={{ uri: upiQrImageUrl }} style={s.qrImage} resizeMode="contain" />
                            <Text style={[s.qrMeta, { color: colors.textSecondary }]}>UPI: {paymentSettings.upiId}</Text>
                            <Text style={[s.qrMeta, { color: colors.textSecondary }]}>Due: Rs {dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
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

function TRow({ label, val, bold, neg, color, colors }: { label: string; val: number; bold?: boolean; neg?: boolean; color?: string; colors: ColorPalette }) {
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: bold ? '700' : '400', fontSize: 13 }}>{label}</Text>
            <Text style={{ color: color ?? (bold ? colors.text : colors.textSecondary), fontWeight: bold ? '700' : '400', fontSize: 13 }}>
                {neg ? '-' : ''}Rs {Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
        </View>
    );
}

function generateInvoiceHtml(invoice: Invoice, extras?: { qrImageUrl?: string; upiId?: string; dueAmount?: number }): string {
    const qrSection = extras?.qrImageUrl
        ? `<div style="margin-top:20px;text-align:center;"><img src="${extras.qrImageUrl}" style="width:180px;height:180px;object-fit:contain;" /><p style="font-size:12px;color:#666;">UPI: ${extras.upiId || ''}</p><p style="font-size:12px;color:#666;">Due: Rs ${(extras.dueAmount ?? 0).toFixed(2)}</p></div>`
        : '';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice</title>
<style>body{font-family:sans-serif;padding:24px;color:#333}h1{color:#007B83}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}.right{text-align:right}.total{font-weight:700;font-size:1.2em}</style>
</head><body>
<h1>TAX INVOICE</h1>
<p>Invoice No: ${invoice.invoiceNumber}</p>
<p>Date: ${invoice.invoiceDate}</p>
<p>Total: Rs ${invoice.totalInvoiceValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
${qrSection}
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
