import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Chip, Text, useTheme } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { AppAccordion } from '../../components/common/AppAccordion';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { AppPullToRefresh } from '../../components/common/AppPullToRefresh';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { SelectorSheet, type SelectorOption } from '../../components/common/SelectorSheet';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { businessSuiteService } from '../../api/businessSuiteService';
import { DesignSystem } from '../../constants/DesignSystem';
import { useAuth } from '../../hooks/useAuth';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { generateBillHTML } from '../../utils/billTemplate';
import { buildUpiPaymentUri, buildUpiQrImageUrl } from '../../utils/upi';
import type { Bill } from '../../types';
import {
    type PaperSize,
    type PrinterType,
    equalTemplateStudioModel,
    parseTemplateStudioMeta,
    parseTemplateStudioModel,
    toTemplateStudioSettingsPatch,
} from './studioModels';

const TEMPLATE_LIBRARY = [
    { key: 'modern_minimal', name: 'Modern Minimal', premium: false, tone: 'Clean grayscale layout', accent: '#155EEF' },
    { key: 'traditional_red', name: 'Traditional Red', premium: false, tone: 'Classic red invoice style', accent: '#DC2626' },
    { key: 'gst_official', name: 'GST Official', premium: false, tone: 'Tax-first table layout', accent: '#2563EB' },
    { key: 'thermal_receipt', name: 'Thermal Receipt', premium: false, tone: 'Narrow POS receipt', accent: '#334155' },
    { key: 'royal_blue', name: 'Royal Blue', premium: true, tone: 'Premium executive style', accent: '#1D4ED8' },
    { key: 'elegant_gold', name: 'Elegant Gold', premium: true, tone: 'Luxury accent style', accent: '#B45309' },
] as const;

const TEMPLATE_KEYS = TEMPLATE_LIBRARY.map((entry) => entry.key);
const DEFAULT_MODEL = parseTemplateStudioModel({}, TEMPLATE_KEYS);

const PillGroup = ({
    value,
    options,
    onChange,
    disabled = false,
}: {
    value: string;
    options: { label: string; value: string }[];
    onChange: (value: string) => void;
    disabled?: boolean;
}) => {
    const theme = useTheme();
    return (
        <View style={styles.pillRow}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <Pressable
                        key={option.value}
                        disabled={disabled}
                        onPress={() => onChange(option.value)}
                        style={[
                            styles.pill,
                            {
                                borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                                backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface,
                                opacity: disabled ? 0.6 : 1,
                            },
                        ]}
                    >
                        <Text variant="labelMedium" style={{ color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }}>
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
};

export const BusinessSuiteTemplateStudioScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const dialog = useAppDialog();
    const { user } = useAuth();
    const {
        selectedOrganizationId,
        canManageTemplates,
        canAccessSettings,
        isOwner,
        setOrganizationSettings,
    } = useOrganizationAccess();
    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [model, setModel] = useState(DEFAULT_MODEL);
    const [baseModel, setBaseModel] = useState(DEFAULT_MODEL);
    const [organizationLabel, setOrganizationLabel] = useState('Business');
    const [organizationContact, setOrganizationContact] = useState('');
    const [upiId, setUpiId] = useState('');
    const [saving, setSaving] = useState(false);
    const canEdit = canManageTemplates && (canAccessSettings || isOwner);
    const isWide = width >= 940;

    const query = useQuery({
        queryKey: ['template-studio', selectedOrganizationId ?? 'auto', user?.uid ?? 'guest'] as const,
        enabled: Boolean(user),
        staleTime: 30_000,
        queryFn: async () => businessSuiteService.getCurrentOrganization(selectedOrganizationId ?? undefined),
    });

    useFocusRefresh(async () => { await query.refetch(); }, { enabled: Boolean(user), minIntervalMs: 10_000, delayMs: 120 });

    useEffect(() => {
        if (!query.data) return;
        const nextModel = parseTemplateStudioModel(query.data.context.settings, TEMPLATE_KEYS);
        const meta = parseTemplateStudioMeta(query.data.context.settings);
        setModel(nextModel);
        setBaseModel(nextModel);
        setUpiId(meta.upiId);
        setOrganizationLabel(query.data.organization.name || 'Business');
        setOrganizationContact([query.data.organization.phoneNumber, query.data.organization.gstNumber].filter(Boolean).join(' · '));
    }, [query.data]);

    const hasChanges = useMemo(() => !equalTemplateStudioModel(model, baseModel), [baseModel, model]);
    const activeTemplate = useMemo(() => TEMPLATE_LIBRARY.find((entry) => entry.key === model.templateKey) ?? TEMPLATE_LIBRARY[0], [model.templateKey]);
    const templateOptions = useMemo<SelectorOption[]>(
        () => TEMPLATE_LIBRARY.map((entry) => ({ key: entry.key, label: entry.name, abbr: entry.premium ? 'PRO' : 'FREE' })),
        []
    );
    const queryError = query.error && !isNetworkLikeError(query.error) ? (query.error instanceof Error ? query.error.message : 'Failed to load studio data.') : null;
    const livePreviewHtml = useMemo(() => {
        const now = new Date().toISOString();
        const qrPayload = buildUpiPaymentUri({
            upiId: upiId || 'merchant@bank',
            amount: 1520,
            payeeName: organizationLabel || 'Business',
            note: 'Preview Invoice',
            transactionRef: 'TPL-PREVIEW',
            currency: 'INR',
        });
        const sampleBill: Bill = {
            id: 'preview-bill',
            userId: user?.uid || 'preview-user',
            type: 'SALE',
            billMode: 'GST',
            customerName: 'Preview Customer',
            customerPhone: '+91 9000000000',
            customerAddress: 'Sample Customer Address',
            businessName: organizationLabel || 'Business',
            businessAddress: organizationContact || 'Business Address',
            gstNumber: '27ABCDE1234F1Z5',
            currency: 'INR',
            billNumber: 'INV-PREVIEW',
            billDate: now,
            paymentMode: 'CASH',
            printerType: model.printerType,
            paperSize: model.paperSize,
            acknowledgmentText: model.acknowledgmentText,
            footerText: model.footerText,
            upiId: upiId || undefined,
            qrImageDataUrl: qrPayload ? buildUpiQrImageUrl(qrPayload, 220) : undefined,
            items: [
                { id: 'p1', name: 'Preview Item A', quantity: 2, price: 250, tax: 5, total: 525 },
                { id: 'p2', name: 'Preview Item B', quantity: 1, price: 900, tax: 12, total: 1008 },
            ],
            taxAmount: 108,
            total: 1533,
            createdAt: now,
        };
        return generateBillHTML(sampleBill);
    }, [
        model.acknowledgmentText,
        model.footerText,
        model.paperSize,
        model.printerType,
        organizationContact,
        organizationLabel,
        upiId,
        user?.uid,
    ]);

    const handleSave = useCallback(async () => {
        if (!canEdit) {
            dialog.alert('Template Studio', 'Read-only access. Only organization owners with settings access can save.');
            return;
        }
        if (!hasChanges) return;
        const isPremium = TEMPLATE_LIBRARY.some((entry) => entry.key === model.templateKey && entry.premium);
        if (isPremium && user?.subscriptionStatus !== 'active') {
            dialog.alert('Upgrade Required', 'Premium templates require an active Pro subscription.');
            return;
        }
        setSaving(true);
        try {
            const settings = await businessSuiteService.updateOrganizationSettings(toTemplateStudioSettingsPatch(model), selectedOrganizationId ?? undefined);
            setOrganizationSettings(settings);
            setBaseModel(model);
            dialog.alert('Template Studio', 'Template settings saved.');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Template Studio', error instanceof Error ? error.message : 'Failed to save template settings.');
            }
        } finally {
            setSaving(false);
        }
    }, [canEdit, dialog, hasChanges, model, selectedOrganizationId, setOrganizationSettings, user?.subscriptionStatus]);

    return (
        <ScreenWrapper>
            <AppPullToRefresh refreshing={query.isFetching} onRefresh={() => { void query.refetch(); }}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={[styles.inner, isWide && styles.innerWide]}>
                        <PageHeaderCard
                            title="Template Studio"
                            subtitle={`${organizationLabel} · dynamic bill formatting`}
                            right={<AppButton mode="contained-tonal" compact style={styles.pillButton} onPress={() => setTemplatePickerOpen(true)}>Templates</AppButton>}
                        />
                        {queryError ? <Text variant="bodySmall" style={{ color: theme.colors.error }}>{queryError}</Text> : null}
                        {query.isFetching && !query.data ? <AppCard><View style={styles.loadingRow}><ActivityIndicator size="small" /><Text variant="bodySmall">Loading template data...</Text></View></AppCard> : null}

                        <AppCard>
                            <View style={styles.metaRow}>
                                <Chip compact icon="office-building-outline">{organizationLabel}</Chip>
                                <Chip compact icon={canEdit ? 'lock-open-outline' : 'eye-outline'}>{canEdit ? 'Editable' : 'Read Only'}</Chip>
                                <Chip compact icon={hasChanges ? 'pencil-outline' : 'check-circle-outline'}>{hasChanges ? 'Unsaved' : 'Saved'}</Chip>
                            </View>
                        </AppCard>

                        <View style={[styles.grid, isWide && styles.gridWide]}>
                            <AppCard style={styles.previewCard}>
                                <Text variant="titleMedium" style={styles.sectionTitle}>Preview</Text>
                                <View style={styles.metaRow}>
                                    <Chip compact icon="palette-outline">{activeTemplate.name}</Chip>
                                    <Chip compact icon="printer-outline">{model.printerType} / {model.paperSize}</Chip>
                                </View>
                                <View style={[styles.previewPane, { borderColor: theme.colors.outline, backgroundColor: theme.colors.elevation.level1 }]}>
                                    <WebView
                                        originWhitelist={['*']}
                                        source={{ html: livePreviewHtml }}
                                        style={styles.previewWebView}
                                        scrollEnabled
                                    />
                                </View>
                            </AppCard>

                            <AppCard style={styles.controlCard}>
                                <Text variant="titleMedium" style={styles.sectionTitle}>Controls</Text>
                                <View style={styles.actionRow}>
                                    <AppButton mode="contained-tonal" style={styles.actionBtn} onPress={() => setTemplatePickerOpen(true)}>Choose</AppButton>
                                    <AppButton mode="contained" style={styles.actionBtn} onPress={() => { void handleSave(); }} disabled={!canEdit || !hasChanges} loading={saving}>Save</AppButton>
                                </View>
                                <AppAccordion title="Text & Branding" icon="format-letter-case" defaultExpanded>
                                    <AppInput label="God Header" value={model.godHeaderText} onChangeText={(value) => setModel((prev) => ({ ...prev, godHeaderText: value }))} editable={canEdit} />
                                    <AppInput label="Acknowledgment" value={model.acknowledgmentText} onChangeText={(value) => setModel((prev) => ({ ...prev, acknowledgmentText: value }))} editable={canEdit} />
                                    <AppInput label="Footer" value={model.footerText} onChangeText={(value) => setModel((prev) => ({ ...prev, footerText: value }))} editable={canEdit} />
                                </AppAccordion>
                                <AppAccordion title="Print Setup" icon="printer-outline" defaultExpanded>
                                    <Text variant="labelMedium" style={styles.groupTitle}>Printer Type</Text>
                                    <PillGroup
                                        value={model.printerType}
                                        disabled={!canEdit}
                                        onChange={(value) => setModel((prev) => {
                                            const printerType = value as PrinterType;
                                            const paperSize: PaperSize = printerType === 'THERMAL'
                                                ? (prev.paperSize === '2INCH' || prev.paperSize === '3INCH' ? prev.paperSize : '3INCH')
                                                : (prev.paperSize === 'A4' || prev.paperSize === 'A5' ? prev.paperSize : 'A4');
                                            return { ...prev, printerType, paperSize };
                                        })}
                                        options={[{ label: 'Standard', value: 'STANDARD' }, { label: 'Thermal', value: 'THERMAL' }]}
                                    />
                                    <Text variant="labelMedium" style={styles.groupTitle}>Paper Size</Text>
                                    <PillGroup value={model.paperSize} disabled={!canEdit} onChange={(value) => setModel((prev) => ({ ...prev, paperSize: value as PaperSize }))} options={model.printerType === 'THERMAL' ? [{ label: '2 inch', value: '2INCH' }, { label: '3 inch', value: '3INCH' }] : [{ label: 'A4', value: 'A4' }, { label: 'A5', value: 'A5' }]} />
                                </AppAccordion>
                            </AppCard>
                        </View>
                    </View>
                </ScrollView>
            </AppPullToRefresh>
            <SelectorSheet visible={templatePickerOpen} onDismiss={() => setTemplatePickerOpen(false)} onSelect={(option) => setModel((prev) => ({ ...prev, templateKey: option.key }))} options={templateOptions} selectedKey={model.templateKey} title="Choose Template" allowCustom={false} />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingTop: DesignSystem.layout.pageTop, alignItems: 'center' },
    inner: { width: '100%', paddingBottom: DesignSystem.layout.pageBottom, gap: 12 },
    innerWide: { maxWidth: DesignSystem.layout.workspaceMaxWidth },
    grid: { gap: 12 },
    gridWide: { flexDirection: 'row', alignItems: 'flex-start' },
    previewCard: { flex: 1.1 },
    controlCard: { flex: 0.9 },
    sectionTitle: { fontWeight: '700', marginBottom: 8 },
    previewPane: { borderWidth: 1, borderRadius: DesignSystem.radius.sm, minHeight: 520, overflow: 'hidden' },
    previewWebView: { flex: 1, minHeight: 520, backgroundColor: 'transparent' },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    actionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    actionBtn: { flex: 1, borderRadius: DesignSystem.radius.pill },
    groupTitle: { marginBottom: 6, marginTop: 4 },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    pill: { minHeight: 34, borderRadius: DesignSystem.radius.pill, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
    pillButton: { borderRadius: DesignSystem.radius.pill },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
