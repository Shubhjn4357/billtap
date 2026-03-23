import { useMemo } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { format, parseISO } from 'date-fns';
import { DESIGN_SPACING, getInsetPanelStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Typography, withAlpha, type ColorPalette } from '../../../constants/theme';
import { SettingsSection } from '../../../constants/enums';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { FormSkeleton } from '../../../components/ui/FormSkeleton';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { useAppRuntime } from '../../../components/providers/AppRuntimeProvider';
import { useAppColors } from '../../../hooks/useAppColors';
import { useI18n } from '../../../hooks/useI18n';
import { useInvoiceDetail } from '../../../hooks/useInvoiceDetails';
import { useInvoiceMutations } from '../../../hooks/useInvoiceMutations';
import { useSettingsSelector } from '../../../hooks/useSettingsSelector';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { selectGeneralPaymentSettings, selectInvoicePrintConfig } from '../../../selectors/settingsSelectors';
import { useAuthStore } from '../../../store/authStore';
import { generateInvoiceHtml } from '../../../utils/invoiceHtml';
import { buildUpiPaymentUri, buildUpiQrImageUrl } from '../../../utils/upi';
import { UtilityEmptyState, UtilityHero, UtilitySection } from '../../../components/ui/UtilityBlocks';

export default function InvoiceDetailScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const { t } = useI18n();
    const { localPreferences } = useAppRuntime();
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const smartBack = useSmartBack('/(main)/billing');
    const business = useAuthStore((state) => state.business);
    const dialog = useAppDialog();

    const openInfoDialog = (title: string, message: string) => {
        dialog.alert(title, message);
    };

    const { invoice, isLoading, isRefetching: invoiceRefetching, refetch: refetchInvoice } = useInvoiceDetail(id);
    const {
        selected: paymentSettings,
        isRefetching: generalRefetching,
        refetch: refetchGeneralSettings,
    } = useSettingsSelector(SettingsSection.GENERAL, selectGeneralPaymentSettings);
    const {
        selected: printConfig,
        isRefetching: printRefetching,
        refetch: refetchPrintSettings,
    } = useSettingsSelector(SettingsSection.INVOICE_PRINT, selectInvoicePrintConfig);
    const { recordInvoicePayment: markPaid, isRecordingInvoicePayment: paymentPending } = useInvoiceMutations();

    const locale = localPreferences.appLanguage === 'hi' ? 'hi-IN' : 'en-IN';
    const currencyCode = ((business?.currency as string | undefined) ?? 'INR').toUpperCase();

    const formatAmount = (amount: number, decimals = 2) => {
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currencyCode,
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(amount);
        } catch {
            const symbol = currencyCode === 'INR' ? 'Rs ' : `${currencyCode} `;
            return `${symbol}${amount.toLocaleString(locale, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            })}`;
        }
    };

    const dueAmount = Math.max((invoice?.totalInvoiceValue ?? 0) - (invoice?.paidAmount ?? 0), 0);

    const upiPayload = useMemo(() => {
        if (!invoice || dueAmount <= 0 || !paymentSettings.upiId) return '';
        return buildUpiPaymentUri({
            upiId: paymentSettings.upiId,
            amount: dueAmount,
            payeeName: paymentSettings.receiverName || 'Vahi Merchant',
            note: `${t('invoice.label.invoice')} ${invoice.invoiceNumber}`,
            transactionRef: invoice.id,
            currency: currencyCode,
        });
    }, [currencyCode, dueAmount, invoice, paymentSettings.receiverName, paymentSettings.upiId, t]);

    const upiQrImageUrl = upiPayload ? buildUpiQrImageUrl(upiPayload, 260) : '';

    const handlePayViaUpi = async () => {
        if (!upiPayload) return;
        const supported = await Linking.canOpenURL(upiPayload);
        if (!supported) {
            openInfoDialog(t('billing.no_upi_app_title'), t('billing.no_upi_app'));
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
            language: localPreferences.appLanguage,
            templateMode: localPreferences.invoiceTemplateMode,
        });
        try {
            const { uri } = await printToFileAsync({ html });
            if (await isAvailableAsync()) {
                await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
        } catch {
            openInfoDialog(t('billing.error_title'), t('billing.error_pdf'));
        }
    };

    const handleShare = async () => {
        if (!invoice) return;
        const lines = [
            `${t('invoice.label.invoice')} ${invoice.invoiceNumber}`,
            `${t('invoice.label.amount')}: ${formatAmount(invoice.totalInvoiceValue, 2)}`,
        ];
        if (dueAmount > 0) {
            lines.push(`${t('invoice.label.due')}: ${formatAmount(dueAmount, 2)}`);
        }
        if (upiPayload) {
            lines.push(`${t('invoice.label.upi')}: ${upiPayload}`);
        }
        await Share.share({ message: lines.join('\n') });
    };

    if (isLoading) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <AppTopBar title="Loading invoice..." onBackPress={smartBack} />
                <FormSkeleton />
            </SafeAreaView>
        );
    }

    if (!invoice) {
        return (
            <View style={s.centered}>
                <Text style={{ color: colors.textSecondary }}>{t('billing.not_found')}</Text>
            </View>
        );
    }

    const isPaid = invoice.paymentStatus === 'PAID';
    const heroTone = isPaid ? 'success' : invoice.paymentStatus === 'OVERDUE' ? 'danger' : 'warning';

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={invoice.invoiceNumber}
                subtitle={invoice.invoiceType}
                onBackPress={smartBack}
                rightAction={(
                    <View style={s.headerActions}>
                        <Pressable style={s.iconButton} onPress={handleShare}>
                            <MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.primary} />
                        </Pressable>
                        <Pressable style={s.iconButton} onPress={handlePrint}>
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
                <View style={s.heroWrap}>
                    <UtilityHero
                        title={invoice.invoiceNumber}
                        subtitle={`${invoice.invoiceType} - ${format(parseISO(invoice.invoiceDate), 'dd MMMM yyyy')}`}
                        icon="file-document-outline"
                        tone={heroTone}
                    />
                </View>

                <View style={s.statsRow}>
                    <HubMetricCard
                        label={t('billing.status')}
                        value={invoice.paymentStatus}
                        meta={invoice.invoiceType}
                        tone={heroTone}
                    />
                    <HubMetricCard
                        label={t('billing.invoice_total')}
                        value={formatAmount(invoice.totalInvoiceValue, 2)}
                        meta={t('billing.gross_value')}
                        tone="info"
                    />
                    <HubMetricCard
                        label={t('billing.balance_due')}
                        value={formatAmount(dueAmount, 2)}
                        meta={dueAmount > 0 ? t('billing.awaiting_settlement') : t('billing.cleared')}
                        tone={dueAmount > 0 ? 'danger' : 'success'}
                    />
                </View>

                {['ESTIMATE', 'PROFORMA', 'SALE_ORDER', 'DELIVERY_CHALLAN_DOC'].includes(invoice.invoiceType) && (
                    <View style={{ paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.sectionGap }}>
                        <Pressable 
                            style={({ pressed }) => [
                                {
                                    backgroundColor: colors.primary,
                                    paddingVertical: 14,
                                    borderRadius: Radius.pill,
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: 8,
                                    opacity: pressed ? 0.8 : 1,
                                }
                            ]}
                            onPress={() => router.push(`/(main)/billing/create?convertFrom=${invoice.id}&type=TAX_INVOICE`)}
                        >
                            <MaterialCommunityIcons name="file-document-plus-outline" size={18} color={colors.card} />
                            <Text style={{ color: colors.card, fontWeight: '600', fontSize: Typography.body.size }}>
                                Convert to Tax Invoice
                            </Text>
                        </Pressable>
                    </View>
                )}

                {invoice.partySnapshot ? (
                    <UtilitySection title={t('billing.bill_to')} count={null}>
                        <View style={s.card}>
                            <Text style={s.partyName}>{invoice.partySnapshot.name}</Text>
                            {invoice.partySnapshot.gstin ? <Text style={s.partyMeta}>GSTIN: {invoice.partySnapshot.gstin}</Text> : null}
                            {invoice.partySnapshot.phone ? <Text style={s.partyMeta}>{t('billing.phone')}: {invoice.partySnapshot.phone}</Text> : null}
                            {invoice.partySnapshot.address ? <Text style={s.partyMeta}>{t('billing.address')}: {invoice.partySnapshot.address}</Text> : null}
                        </View>
                    </UtilitySection>
                ) : null}

                <UtilitySection title={t('billing.items')} count={(invoice.items ?? []).length}>
                    <View style={s.card}>
                        {(invoice.items ?? []).length === 0 ? (
                            <UtilityEmptyState
                                icon="package-variant-closed"
                                title={t('billing.no_items')}
                                description={t('billing.no_items_subtitle')}
                            />
                        ) : (
                            <>
                                <View style={s.tableHeader}>
                                    <Text style={[s.th, s.descriptionCol]}>{t('invoice.label.description')}</Text>
                                    <Text style={s.th}>{t('invoice.label.qty')}</Text>
                                    <Text style={s.th}>{t('invoice.label.rate')}</Text>
                                    <Text style={[s.th, s.rightText]}>{t('invoice.label.amount')}</Text>
                                </View>
                                {(invoice.items ?? []).map((item, index) => (
                                    <View key={`${item.id}-${index}`} style={s.tableRow}>
                                        <View style={s.descriptionCol}>
                                            <Text style={s.td} numberOfLines={2}>{item.description}</Text>
                                            {item.gstRate > 0 ? <Text style={s.tdSub}>GST {item.gstRate}%</Text> : null}
                                        </View>
                                        <Text style={s.td}>{item.quantity}</Text>
                                        <Text style={s.td}>{formatAmount(item.rate, 2)}</Text>
                                        <Text style={[s.td, s.rightText, s.amountText]}>{formatAmount(item.total, 2)}</Text>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>
                </UtilitySection>

                <UtilitySection title={t('billing.totals')} count={null}>
                    <View style={s.card}>
                        <TRow colors={colors} formatAmount={formatAmount} label={t('billing.taxable_value')} val={invoice.totalTaxableValue} />
                        {invoice.totalCgstAmount > 0 ? <TRow colors={colors} formatAmount={formatAmount} label="CGST" val={invoice.totalCgstAmount} /> : null}
                        {invoice.totalSgstAmount > 0 ? <TRow colors={colors} formatAmount={formatAmount} label="SGST" val={invoice.totalSgstAmount} /> : null}
                        {invoice.totalIgstAmount > 0 ? <TRow colors={colors} formatAmount={formatAmount} label="IGST" val={invoice.totalIgstAmount} /> : null}
                        {invoice.discountAmount > 0 ? <TRow colors={colors} formatAmount={formatAmount} label={t('billing.discount')} neg val={-invoice.discountAmount} /> : null}
                        {invoice.roundOffAmount !== 0 ? <TRow colors={colors} formatAmount={formatAmount} label={t('billing.round_off')} val={invoice.roundOffAmount} /> : null}
                        <View style={s.divider} />
                        <TRow bold colors={colors} formatAmount={formatAmount} label={t('billing.invoice_total')} val={invoice.totalInvoiceValue} />
                        <TRow color={colors.success} colors={colors} formatAmount={formatAmount} label={t('billing.paid_amount')} val={invoice.paidAmount} />
                        {dueAmount > 0 ? (
                            <TRow bold color={colors.error} colors={colors} formatAmount={formatAmount} label={t('billing.balance_due')} val={dueAmount} />
                        ) : null}
                    </View>
                </UtilitySection>

                <UtilitySection title={t('billing.upi_qr')} count={null}>
                    <View style={s.card}>
                        {upiQrImageUrl ? (
                            <View style={s.qrWrap}>
                                <Image source={{ uri: upiQrImageUrl }} style={s.qrImage} resizeMode="contain" />
                                <Text style={s.qrMeta}>{t('invoice.label.upi')}: {paymentSettings.upiId}</Text>
                                <Text style={s.qrMeta}>{t('invoice.label.due')}: {formatAmount(dueAmount, 2)}</Text>
                                <Pressable style={s.primaryButton} onPress={handlePayViaUpi}>
                                    <Text style={s.primaryButtonText}>{t('billing.pay_via_upi')}</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Text style={s.emptyText}>
                                {dueAmount <= 0 ? t('billing.qr_not_required') : t('billing.qr_settings_hint')}
                            </Text>
                        )}
                    </View>
                </UtilitySection>

                {!isPaid ? (
                    <View style={s.actions}>
                        <Pressable
                            style={[s.actionButton, s.successButton]}
                            onPress={() => {
                                dialog.alert(t('billing.mark_as_paid'), t('billing.record_full_payment'), [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: t('billing.mark_paid'),
                                        onPress: () => {
                                            void markPaid({
                                                invoiceId: id!,
                                                payload: {
                                                    paidAmount: invoice.totalInvoiceValue ?? 0,
                                                    paymentMode: 'CASH',
                                                },
                                            }).catch((error) => {
                                                openInfoDialog(
                                                    t('billing.error_title'),
                                                    error instanceof Error ? error.message : 'Failed'
                                                );
                                            });
                                        },
                                    },
                                ]);
                            }}
                            disabled={paymentPending}
                        >
                            {paymentPending ? (
                                <ActivityIndicator color={colors.onPrimary} />
                            ) : (
                                <Text style={s.actionButtonText}>{t('billing.mark_paid')}</Text>
                            )}
                        </Pressable>
                        <Pressable style={[s.actionButton, s.primaryButton]} onPress={handlePrint}>
                            <Text style={s.actionButtonText}>{t('billing.print_pdf')}</Text>
                        </Pressable>
                    </View>
                ) : null}

                {invoice.notes ? (
                    <UtilitySection title={t('billing.notes')} count={null}>
                        <View style={s.card}>
                            <Text style={s.notesText}>{invoice.notes}</Text>
                        </View>
                    </UtilitySection>
                ) : null}

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function TRow({
    bold,
    color,
    colors,
    formatAmount,
    label,
    neg,
    val,
}: {
    bold?: boolean;
    color?: string;
    colors: ColorPalette;
    formatAmount: (value: number, decimals?: number) => string;
    label: string;
    neg?: boolean;
    val: number;
}) {
    return (
        <View style={rowStyles.row}>
            <Text style={[rowStyles.label, { color: colors.textSecondary, fontWeight: bold ? '700' : '500' }]}>
                {label}
            </Text>
            <Text style={[rowStyles.value, { color: color ?? (bold ? colors.text : colors.textSecondary), fontWeight: bold ? '700' : '500' }]}>
                {neg ? '-' : ''}{formatAmount(Math.abs(val), 2)}
            </Text>
        </View>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    headerActions: { flexDirection: 'row', gap: DESIGN_SPACING.cardGap },
    heroWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: DESIGN_SPACING.screenX,
        gap: DESIGN_SPACING.cardGap,
        marginBottom: DESIGN_SPACING.sectionGap,
    },
    iconButton: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        ...getInsetPanelStyle(colors, colors.primary),
    },
    card: {
        marginHorizontal: DESIGN_SPACING.screenX,
        marginBottom: DESIGN_SPACING.sectionGap,
        padding: DESIGN_SPACING.sectionGap,
        ...getSurfaceStyle(colors, { elevated: true }),
    },
    partyName: {
        color: colors.text,
        fontSize: Typography.body.size + 1,
        fontWeight: '800',
        marginBottom: 4,
    },
    partyMeta: {
        color: colors.textSecondary,
        fontSize: Typography.caption.size,
        lineHeight: Typography.caption.lineHeight,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: DESIGN_SPACING.cardGap,
        borderBottomWidth: 1,
        borderBottomColor: withAlpha(colors.border, 'A0'),
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: DESIGN_SPACING.cardGap,
        borderBottomWidth: 1,
        borderBottomColor: withAlpha(colors.border, '66'),
        alignItems: 'flex-start',
    },
    descriptionCol: { flex: 3 },
    th: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: Typography.caption.size,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    td: {
        flex: 1,
        color: colors.text,
        fontSize: Typography.body.size,
        lineHeight: Typography.body.lineHeight,
    },
    tdSub: {
        fontSize: Typography.caption.size,
        color: colors.textSecondary,
        marginTop: 2,
    },
    amountText: {
        fontWeight: '700',
    },
    rightText: {
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: withAlpha(colors.border, 'A0'),
        marginVertical: DESIGN_SPACING.cardGap,
    },
    qrWrap: {
        alignItems: 'center',
        gap: DESIGN_SPACING.cardGap,
    },
    qrImage: {
        width: 224,
        height: 224,
        borderRadius: Radius.lg,
        backgroundColor: colors.surfaceRaised,
    },
    qrMeta: {
        color: colors.textSecondary,
        fontSize: Typography.caption.size,
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: Typography.body.size,
        lineHeight: Typography.body.lineHeight,
    },
    primaryButton: {
        minHeight: 48,
        minWidth: 170,
        borderRadius: Radius.pill,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: DESIGN_SPACING.sectionGap,
    },
    successButton: {
        backgroundColor: colors.success,
    },
    primaryButtonText: {
        color: colors.onPrimary,
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    actions: {
        flexDirection: 'row',
        gap: DESIGN_SPACING.cardGap,
        paddingHorizontal: DESIGN_SPACING.screenX,
        marginBottom: DESIGN_SPACING.sectionGap,
    },
    actionButton: {
        flex: 1,
        minHeight: 50,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: DESIGN_SPACING.sectionGap,
    },
    actionButtonText: {
        color: colors.onPrimary,
        fontSize: Typography.body.size,
        fontWeight: '800',
    },
    notesText: {
        color: colors.text,
        fontSize: Typography.body.size,
        lineHeight: Typography.body.lineHeight,
    },
});

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
        gap: 12,
    },
    label: {
        flex: 1,
        fontSize: Typography.body.size,
    },
    value: {
        fontSize: Typography.body.size,
        textAlign: 'right',
    },
});
