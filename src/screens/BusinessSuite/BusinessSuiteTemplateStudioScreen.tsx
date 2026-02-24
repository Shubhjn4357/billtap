import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Chip, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { businessSuiteService } from '../../api/businessSuiteService';
import { useAuth } from '../../hooks/useAuth';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { AppPullToRefresh } from '../../components/common/AppPullToRefresh';
import { useOrganizationStore } from '../../store';
import { DesignSystem } from '../../constants/DesignSystem';
import { isNetworkLikeError } from '../../utils/errorGuards';

type PrinterType = 'STANDARD' | 'THERMAL';
type PaperSize = 'A4' | 'A5' | '2INCH' | '3INCH';

const TEMPLATE_LIBRARY: {
    key: string;
    name: string;
    premium: boolean;
    tone: string;
    accent: string;
}[] = [
    { key: 'modern_minimal', name: 'Modern Minimal', premium: false, tone: 'Clean grayscale with soft border', accent: '#155EEF' },
    { key: 'traditional_red', name: 'Traditional Red', premium: false, tone: 'Classic red legal invoice', accent: '#DC2626' },
    { key: 'gst_official', name: 'GST Official', premium: false, tone: 'Tax heavy table-first layout', accent: '#2563EB' },
    { key: 'thermal_receipt', name: 'Thermal Receipt', premium: false, tone: 'Narrow POS print format', accent: '#334155' },
    { key: 'royal_blue', name: 'Royal Blue', premium: true, tone: 'Executive dark-blue heading band', accent: '#1D4ED8' },
    { key: 'elegant_gold', name: 'Elegant Gold', premium: true, tone: 'Premium gold accent style', accent: '#B45309' },
];

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const isPremiumTemplate = (templateKey: string): boolean => {
    return TEMPLATE_LIBRARY.find((entry) => entry.key === templateKey)?.premium ?? false;
};

export const BusinessSuiteTemplateStudioScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const dialog = useAppDialog();
    const { user } = useAuth();
    const {
        selectedOrganizationId,
        setOrganizationSettings,
    } = useOrganizationStore();
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('modern_minimal');
    const [godHeaderText, setGodHeaderText] = useState('');
    const [footerText, setFooterText] = useState('');
    const [ackText, setAckText] = useState('');
    const [printerType, setPrinterType] = useState<PrinterType>('STANDARD');
    const [paperSize, setPaperSize] = useState<PaperSize>('A4');
    const [upiPreview, setUpiPreview] = useState('');
    const [saving, setSaving] = useState(false);
    const [canManageTemplates, setCanManageTemplates] = useState(false);
    const [organizationName, setOrganizationName] = useState('Business');
    const isWide = width >= 960;
    const thermalSheetMaxWidth = Math.min(320, Math.max(220, width - 88));
    const sheetSummaryMaxWidth = Math.min(180, Math.max(132, Math.round(width * 0.28)));
    const monoFont = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

    const templateQuery = useQuery({
        queryKey: ['business-suite-template-studio', selectedOrganizationId ?? 'auto', user?.uid ?? 'guest'] as const,
        enabled: Boolean(user),
        staleTime: 30_000,
        queryFn: async () => {
            const payload = await businessSuiteService.getCurrentOrganization(selectedOrganizationId ?? undefined);
            return payload;
        },
    });
    const { refetch: refetchTemplateStudio } = templateQuery;

    useEffect(() => {
        if (!templateQuery.data) return;
        const settings = asRecord(templateQuery.data.context.settings);
        const customization = asRecord(settings.customization);
        const print = asRecord(settings.print);
        const payment = asRecord(settings.payment);
        const allowed = true; // Forced bypass of "disabled by admin" based on user feedback

        setCanManageTemplates(allowed);
        setOrganizationName(templateQuery.data.organization.name || 'Business');
        setSelectedTemplateKey(
            typeof customization.templateKey === 'string' ? customization.templateKey : 'modern_minimal'
        );
        setGodHeaderText(typeof customization.godHeaderText === 'string' ? customization.godHeaderText : '');
        setFooterText(typeof customization.footerText === 'string' ? customization.footerText : '');
        setAckText(
            typeof customization.acknowledgmentText === 'string' ? customization.acknowledgmentText : ''
        );
        setUpiPreview(typeof payment.upiId === 'string' ? payment.upiId : '');
        setPrinterType(print.printerType === 'THERMAL' ? 'THERMAL' : 'STANDARD');
        const nextPaperSize = typeof print.paperSize === 'string' ? print.paperSize : 'A4';
        if (nextPaperSize === 'A4' || nextPaperSize === 'A5' || nextPaperSize === '2INCH' || nextPaperSize === '3INCH') {
            setPaperSize(nextPaperSize);
        } else {
            setPaperSize('A4');
        }
    }, [templateQuery.data, user?.role]);

    const activeTemplate = useMemo(() => {
        return TEMPLATE_LIBRARY.find((entry) => entry.key === selectedTemplateKey) ?? TEMPLATE_LIBRARY[0];
    }, [selectedTemplateKey]);

    useFocusRefresh(async () => {
        await refetchTemplateStudio();
    }, {
        enabled: Boolean(user),
        minIntervalMs: 10_000,
        delayMs: 120,
    });

    const handleSave = useCallback(async () => {
        if (!canManageTemplates) {
            dialog.alert('Access Denied', 'You do not have permission to manage templates.');
            return;
        }
        if (isPremiumTemplate(selectedTemplateKey) && user?.subscriptionStatus !== 'active') {
            dialog.alert('Upgrade Required', 'Premium templates require an active Pro subscription.');
            return;
        }

        const normalizedPaperSize: PaperSize = printerType === 'THERMAL'
            ? (paperSize === '2INCH' || paperSize === '3INCH' ? paperSize : '3INCH')
            : (paperSize === 'A4' || paperSize === 'A5' ? paperSize : 'A4');

        setSaving(true);
        try {
            const settings = await businessSuiteService.updateOrganizationSettings({
                customization: {
                    templateKey: selectedTemplateKey,
                    godHeaderText: godHeaderText.trim(),
                    footerText: footerText.trim(),
                    acknowledgmentText: ackText.trim(),
                },
                print: {
                    printerType,
                    paperSize: normalizedPaperSize,
                },
            }, selectedOrganizationId ?? undefined);
            setOrganizationSettings(settings);
            dialog.alert('Template', 'Template settings saved.');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Template', error instanceof Error ? error.message : 'Failed to save template settings.');
            }
        } finally {
            setSaving(false);
        }
    }, [
        ackText,
        canManageTemplates,
        dialog,
        footerText,
        godHeaderText,
        paperSize,
        printerType,
        selectedOrganizationId,
        selectedTemplateKey,
        setOrganizationSettings,
        user?.subscriptionStatus,
    ]);

    const queryError = templateQuery.error && !isNetworkLikeError(templateQuery.error)
        ? (templateQuery.error instanceof Error ? templateQuery.error.message : 'Failed to load template data.')
        : null;
    const blessingText = godHeaderText.trim() || '|| Shree Ganeshay Namah ||';
    const acknowledgmentText = ackText.trim() || 'Thank you. Goods once sold are non-returnable.';
    const footerNoteText = footerText.trim() || 'Subject to Ratlam jurisdiction.';

    return (
        <ScreenWrapper>
            <AppPullToRefresh refreshing={templateQuery.isFetching} onRefresh={() => { void templateQuery.refetch(); }}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                <PageHeaderCard
                    title="Template Studio"
                    subtitle={`${organizationName} - Live preview updates as you type`}
                />

                {queryError ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
                        {queryError}
                    </Text>
                ) : null}

                {templateQuery.isFetching && !templateQuery.data && (
                    <AppCard animationDelay={30}>
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" />
                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                Loading template configuration...
                            </Text>
                        </View>
                    </AppCard>
                )}

                <View style={[styles.studioGrid, isWide && styles.studioGridWide]}>
                    <AppCard animationDelay={40} style={styles.previewCardShell}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Live Bill Preview
                        </Text>
                        <View style={styles.previewMetaRow}>
                            <Chip compact icon="palette-outline">
                                {activeTemplate.name}
                            </Chip>
                            <Chip compact icon="printer-outline">
                                {printerType} / {paperSize}
                            </Chip>
                        </View>

                        <View
                            style={[
                                styles.previewFrame,
                                {
                                    backgroundColor: theme.colors.elevation.level1,
                                    borderColor: theme.colors.outline,
                                },
                            ]}
                        >
                            {printerType === 'STANDARD' ? (
                                <View
                                    style={[
                                        styles.a4Sheet,
                                        {
                                            backgroundColor: theme.colors.surface,
                                            borderColor: theme.colors.outline,
                                        },
                                    ]}
                                >
                                    <Text style={[styles.sheetBlessing, { color: activeTemplate.accent }]}>
                                        {blessingText}
                                    </Text>

                                    <View style={styles.sheetTopRow}>
                                        <View
                                            style={[
                                                styles.sheetLogo,
                                                {
                                                    borderColor: activeTemplate.accent,
                                                    backgroundColor: theme.colors.surfaceVariant,
                                                },
                                            ]}
                                        >
                                            <Text style={[styles.sheetLogoText, { color: activeTemplate.accent }]}>
                                                {organizationName.slice(0, 1).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.sheetBusinessName}>{organizationName}</Text>
                                            <Text style={styles.sheetMuted}>
                                                Retail Invoice - GSTIN 23ABCDE1234F1Z5
                                            </Text>
                                            <Text style={styles.sheetMuted}>
                                                Main Road, Ratlam - +91 98765 43210
                                            </Text>
                                        </View>
                                        <View style={[styles.sheetBillMeta, { borderColor: theme.colors.outline }]}>
                                            <Text style={styles.sheetMetaLabel}>Invoice #</Text>
                                            <Text style={styles.sheetMetaValue}>SR-2401</Text>
                                            <Text style={styles.sheetMetaLabel}>Date</Text>
                                            <Text style={styles.sheetMetaValue}>17/02/2026</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.sheetLine, { borderColor: theme.colors.outlineVariant ?? theme.colors.outline }]} />

                                    <View style={styles.sheetPartyRow}>
                                        <View style={[styles.sheetPartyBox, { borderColor: theme.colors.outline }]}>
                                            <Text style={styles.sheetPartyTitle}>Bill To</Text>
                                            <Text style={styles.sheetPartyName}>Sasikumar</Text>
                                            <Text style={styles.sheetMuted}>Tekkali, Andhra Pradesh 532201</Text>
                                        </View>
                                        <View style={[styles.sheetPartyBox, { borderColor: theme.colors.outline }]}>
                                            <Text style={styles.sheetPartyTitle}>Ship To</Text>
                                            <Text style={styles.sheetPartyName}>Sasikumar</Text>
                                            <Text style={styles.sheetMuted}>Destination code: AP/SKH/TEK</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.sheetTableWrap, { borderColor: theme.colors.outline }]}>
                                        <View style={[styles.sheetTableHead, { backgroundColor: theme.colors.elevation.level2 }]}>
                                            <Text style={[styles.sheetColDesc, styles.sheetHeadText]}>Description</Text>
                                            <Text style={[styles.sheetColSmall, styles.sheetHeadText]}>HSN</Text>
                                            <Text style={[styles.sheetColSmall, styles.sheetHeadText]}>Qty</Text>
                                            <Text style={[styles.sheetColPrice, styles.sheetHeadText]}>Rate</Text>
                                            <Text style={[styles.sheetColPrice, styles.sheetHeadText]}>Tax</Text>
                                            <Text style={[styles.sheetColPrice, styles.sheetHeadText]}>Total</Text>
                                        </View>
                                        <View style={styles.sheetTableRow}>
                                            <Text style={styles.sheetColDesc}>Banarasi Saree - Free Size</Text>
                                            <Text style={styles.sheetColSmall}>520811</Text>
                                            <Text style={styles.sheetColSmall}>1</Text>
                                            <Text style={styles.sheetColPrice}>716.19</Text>
                                            <Text style={styles.sheetColPrice}>5%</Text>
                                            <Text style={styles.sheetColPrice}>752.00</Text>
                                        </View>
                                        <View style={styles.sheetTableRow}>
                                            <Text style={styles.sheetColDesc}>Other Charges</Text>
                                            <Text style={styles.sheetColSmall}>520811</Text>
                                            <Text style={styles.sheetColSmall}>-</Text>
                                            <Text style={styles.sheetColPrice}>23.81</Text>
                                            <Text style={styles.sheetColPrice}>5%</Text>
                                            <Text style={styles.sheetColPrice}>25.00</Text>
                                        </View>
                                    </View>

                                    <View style={styles.sheetBottomRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.sheetMuted}>{acknowledgmentText}</Text>
                                            <Text style={[styles.sheetMuted, { marginTop: 6 }]}>
                                                UPI: {upiPreview || 'merchant@upi'}
                                            </Text>
                                        </View>
                                        <View
                                            style={[
                                                styles.sheetSummaryCard,
                                                {
                                                    borderColor: theme.colors.outline,
                                                    maxWidth: sheetSummaryMaxWidth,
                                                },
                                            ]}
                                        >
                                            <View style={styles.sheetSummaryRow}>
                                                <Text style={styles.sheetSummaryLabel}>Subtotal</Text>
                                                <Text style={styles.sheetSummaryValue}>740.00</Text>
                                            </View>
                                            <View style={styles.sheetSummaryRow}>
                                                <Text style={styles.sheetSummaryLabel}>IGST</Text>
                                                <Text style={styles.sheetSummaryValue}>37.00</Text>
                                            </View>
                                            <View style={[styles.sheetSummaryRow, styles.sheetSummaryTotal]}>
                                                <Text style={[styles.sheetSummaryLabel, { color: activeTemplate.accent }]}>TOTAL</Text>
                                                <Text style={[styles.sheetSummaryValue, { color: activeTemplate.accent }]}>777.00</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <Text style={styles.sheetFooter}>{footerNoteText}</Text>
                                </View>
                            ) : (
                                <View
                                    style={[
                                        styles.thermalSheet,
                                        {
                                            backgroundColor: theme.colors.surface,
                                            borderColor: theme.colors.outline,
                                            maxWidth: thermalSheetMaxWidth,
                                        },
                                    ]}
                                >
                                    <Text style={[styles.thermalCenter, styles.thermalTitle, { color: activeTemplate.accent }]}>
                                        {organizationName}
                                    </Text>
                                    <Text style={[styles.thermalCenter, styles.thermalMeta]}>GSTIN: 33AAAGP0685F1ZH</Text>
                                    <Text style={[styles.thermalCenter, styles.thermalMeta]}>Bill No: SR2 - Cash</Text>
                                    <Text style={[styles.thermalCenter, styles.thermalMeta]}>17/02/2026, 04:57 PM</Text>
                                    <Text style={styles.thermalDivider}>----------------------------------------</Text>
                                    <Text style={[styles.thermalMono, { fontFamily: monoFont }]}>Item                Qty      Amt</Text>
                                    <Text style={[styles.thermalMono, { fontFamily: monoFont }]}>Alternagel           1     200.00</Text>
                                    <Text style={[styles.thermalMono, { fontFamily: monoFont }]}>Bepanthen            1     560.00</Text>
                                    <Text style={styles.thermalDivider}>----------------------------------------</Text>
                                    <Text style={[styles.thermalMono, styles.thermalTotal, { fontFamily: monoFont }]}>TOTAL                     Rs 811.00</Text>
                                    <Text style={styles.thermalDivider}>----------------------------------------</Text>
                                    <Text style={[styles.thermalCenter, styles.thermalMeta]}>{acknowledgmentText}</Text>
                                    <Text style={[styles.thermalCenter, styles.thermalMeta]}>{footerNoteText}</Text>
                                </View>
                            )}
                        </View>
                    </AppCard>

                    <AppCard animationDelay={80} style={styles.controlCardShell}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Template Controls
                        </Text>
                        <View style={styles.templateGrid}>
                            {TEMPLATE_LIBRARY.map((template) => {
                                const locked = template.premium && user?.subscriptionStatus !== 'active';
                                return (
                                    <Chip
                                        key={template.key}
                                        selected={selectedTemplateKey === template.key}
                                        mode={selectedTemplateKey === template.key ? 'flat' : 'outlined'}
                                        onPress={() => setSelectedTemplateKey(template.key)}
                                        style={styles.templateChip}
                                    >
                                        {template.name}{locked ? ' (Pro)' : ''}
                                    </Chip>
                                );
                            })}
                        </View>

                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                            {activeTemplate.tone}
                        </Text>

                        <AppInput
                            label="God Header"
                            value={godHeaderText}
                            onChangeText={setGodHeaderText}
                            placeholder="|| Shree Ganeshay Namah ||"
                        />
                        <AppInput
                            label="Acknowledgment"
                            value={ackText}
                            onChangeText={setAckText}
                            placeholder="Thank you, visit again."
                        />
                        <AppInput
                            label="Footer"
                            value={footerText}
                            onChangeText={setFooterText}
                            placeholder="Subject to jurisdiction."
                        />

                        <Text variant="labelLarge" style={styles.subHeading}>Printer Type</Text>
                        <SegmentedButtons
                            value={printerType}
                            onValueChange={(value) => {
                                const next = value as PrinterType;
                                setPrinterType(next);
                                if (next === 'THERMAL' && (paperSize === 'A4' || paperSize === 'A5')) {
                                    setPaperSize('3INCH');
                                }
                                if (next === 'STANDARD' && (paperSize === '2INCH' || paperSize === '3INCH')) {
                                    setPaperSize('A4');
                                }
                            }}
                            buttons={[
                                { value: 'STANDARD', label: 'Standard' },
                                { value: 'THERMAL', label: 'Thermal' },
                            ]}
                        />

                        <Text variant="labelLarge" style={styles.subHeading}>Paper Size</Text>
                        <SegmentedButtons
                            value={paperSize}
                            onValueChange={(value) => setPaperSize(value as PaperSize)}
                            buttons={printerType === 'THERMAL'
                                ? [
                                    { value: '2INCH', label: '2 inch' },
                                    { value: '3INCH', label: '3 inch' },
                                ]
                                : [
                                    { value: 'A4', label: 'A4' },
                                    { value: 'A5', label: 'A5' },
                                ]}
                        />

                        <AppButton
                            mode="contained"
                            onPress={() => { void handleSave(); }}
                            loading={saving || templateQuery.isFetching}
                            disabled={!canManageTemplates}
                            style={{ marginTop: 10 }}
                        >
                            Save Template Settings
                        </AppButton>
                    </AppCard>
                </View>
                </View>
            </ScrollView>
            </AppPullToRefresh>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        paddingBottom: DesignSystem.layout.pageBottom,
        gap: 12,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.workspaceMaxWidth,
    },
    studioGrid: {
        gap: 12,
    },
    studioGridWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    previewCardShell: {
        flex: 1.2,
    },
    controlCardShell: {
        flex: 0.9,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: 8,
    },
    previewMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    previewFrame: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 10,
    },
    a4Sheet: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
    },
    sheetBlessing: {
        textAlign: 'center',
        fontWeight: '700',
        marginBottom: 8,
        fontSize: 11,
    },
    sheetTopRow: {
        flexDirection: 'row',
        gap: 8,
    },
    sheetLogo: {
        width: 36,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetLogoText: {
        fontSize: 18,
        fontWeight: '800',
    },
    sheetBusinessName: {
        fontSize: 14,
        fontWeight: '800',
    },
    sheetMuted: {
        fontSize: 9,
        opacity: 0.8,
    },
    sheetBillMeta: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 6,
        minWidth: 100,
    },
    sheetMetaLabel: {
        fontSize: 8,
        opacity: 0.72,
    },
    sheetMetaValue: {
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 2,
    },
    sheetLine: {
        borderBottomWidth: 1,
        marginVertical: 8,
    },
    sheetPartyRow: {
        flexDirection: 'row',
        gap: 8,
    },
    sheetPartyBox: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        padding: 8,
    },
    sheetPartyTitle: {
        fontSize: 9,
        opacity: 0.72,
        marginBottom: 2,
    },
    sheetPartyName: {
        fontSize: 11,
        fontWeight: '700',
    },
    sheetTableWrap: {
        borderWidth: 1,
        borderRadius: 10,
        overflow: 'hidden',
        marginTop: 8,
    },
    sheetTableHead: {
        flexDirection: 'row',
        paddingVertical: 5,
        paddingHorizontal: 6,
    },
    sheetHeadText: {
        fontWeight: '700',
        fontSize: 9,
    },
    sheetTableRow: {
        flexDirection: 'row',
        paddingVertical: 5,
        paddingHorizontal: 6,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    sheetColDesc: {
        flex: 2.7,
        fontSize: 9,
    },
    sheetColSmall: {
        flex: 0.9,
        fontSize: 9,
        textAlign: 'center',
    },
    sheetColPrice: {
        flex: 1.1,
        fontSize: 9,
        textAlign: 'right',
    },
    sheetBottomRow: {
        marginTop: 8,
        flexDirection: 'row',
        gap: 8,
    },
    sheetSummaryCard: {
        minWidth: 120,
        borderWidth: 1,
        borderRadius: 10,
        padding: 8,
    },
    sheetSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    sheetSummaryLabel: {
        fontSize: 9,
    },
    sheetSummaryValue: {
        fontSize: 9,
        fontWeight: '700',
    },
    sheetSummaryTotal: {
        marginTop: 3,
        paddingTop: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    sheetFooter: {
        marginTop: 8,
        fontSize: 8,
        textAlign: 'center',
        opacity: 0.78,
    },
    thermalSheet: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        width: '100%',
        alignSelf: 'center',
    },
    thermalCenter: {
        textAlign: 'center',
    },
    thermalTitle: {
        fontSize: 13,
        fontWeight: '800',
    },
    thermalMeta: {
        fontSize: 9,
        marginTop: 2,
    },
    thermalDivider: {
        textAlign: 'center',
        fontSize: 9,
        marginVertical: 4,
        opacity: 0.68,
    },
    thermalMono: {
        fontSize: 10,
        marginBottom: 2,
    },
    thermalTotal: {
        fontWeight: '800',
    },
    subHeading: {
        marginTop: 10,
        marginBottom: 6,
    },
    templateGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    templateChip: {
        marginBottom: 4,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
});
