import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Chip, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { businessSuiteService, type StaffPermissions } from '../../api/businessSuiteService';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationStore } from '../../store';
import { isNetworkLikeError } from '../../utils/errorGuards';

type PrinterType = 'STANDARD' | 'THERMAL';
type PaperSize = 'A4' | 'A5' | '2INCH' | '3INCH';

const TEMPLATE_LIBRARY: {
    key: string;
    name: string;
    premium: boolean;
    color: string;
    accent: string;
}[] = [
    { key: 'modern_minimal', name: 'Modern Minimal', premium: false, color: '#f8fafc', accent: '#0ea5e9' },
    { key: 'traditional_red', name: 'Traditional Red', premium: false, color: '#fff1f2', accent: '#dc2626' },
    { key: 'gst_official', name: 'GST Official', premium: false, color: '#eff6ff', accent: '#2563eb' },
    { key: 'thermal_receipt', name: 'Thermal Receipt', premium: false, color: '#f8fafc', accent: '#334155' },
    { key: 'royal_blue', name: 'Royal Blue', premium: true, color: '#eef2ff', accent: '#1d4ed8' },
    { key: 'elegant_gold', name: 'Elegant Gold', premium: true, color: '#fffbeb', accent: '#b45309' },
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
    const [saving, setSaving] = useState(false);
    const [canManageTemplates, setCanManageTemplates] = useState(false);
    const [organizationName, setOrganizationName] = useState('Business');

    const templateQuery = useQuery({
        queryKey: ['business-suite-template-studio', selectedOrganizationId ?? 'auto', user?.uid ?? 'guest'] as const,
        enabled: Boolean(user),
        staleTime: 30_000,
        queryFn: async () => {
            const payload = await businessSuiteService.getCurrentOrganization(selectedOrganizationId ?? undefined);
            return payload;
        },
    });

    useEffect(() => {
        if (!templateQuery.data) return;
        const settings = asRecord(templateQuery.data.context.settings);
        const customization = asRecord(settings.customization);
        const print = asRecord(settings.print);
        const permissions = asRecord(templateQuery.data.context.permissions) as StaffPermissions;
        const ownerOrAdmin = templateQuery.data.context.role === 'owner' || user?.role === 'admin';
        const allowed = ownerOrAdmin || Boolean(permissions.can_manage_templates);

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

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content}>
                <PageHeaderCard
                    title="Template Studio"
                    subtitle={`${organizationName} - Live preview updates as you type`}
                />

                {queryError ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
                        {queryError}
                    </Text>
                ) : null}

                <AppCard animationDelay={40}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Live Bill Preview
                    </Text>
                    <View
                        style={[
                            styles.previewCard,
                            {
                                backgroundColor: activeTemplate.color,
                                borderColor: activeTemplate.accent,
                            },
                        ]}
                    >
                        <Text
                            variant="labelSmall"
                            style={[
                                styles.previewCenter,
                                {
                                    color: activeTemplate.accent,
                                },
                            ]}
                        >
                            {godHeaderText.trim() || '|| Add Header Blessing ||'}
                        </Text>
                        <Text variant="titleMedium" style={[styles.previewCenter, { fontWeight: '800' }]}>
                            {organizationName}
                        </Text>
                        <Text variant="bodySmall" style={styles.previewMuted}>
                            Template: {activeTemplate.name} - {printerType} / {paperSize}
                        </Text>
                        <View style={styles.previewDivider} />
                        <Text variant="bodySmall" style={styles.previewLine}>1 x Premium Notebook              120.00</Text>
                        <Text variant="bodySmall" style={styles.previewLine}>2 x Gel Pen                       40.00</Text>
                        <Text variant="bodySmall" style={[styles.previewLine, { fontWeight: '700' }]}>TOTAL                              160.00</Text>
                        <View style={styles.previewDivider} />
                        <Text variant="labelSmall" style={styles.previewCenter}>
                            {ackText.trim() || 'Acknowledgment will appear here'}
                        </Text>
                        <Text variant="labelSmall" style={[styles.previewCenter, styles.previewFooter]}>
                            {footerText.trim() || 'Footer note will appear here'}
                        </Text>
                    </View>
                </AppCard>

                <AppCard animationDelay={80}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Choose Template
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
                        onValueChange={(value) => setPrinterType(value as PrinterType)}
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
                    >
                        Save Template Settings
                    </AppButton>
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingBottom: 28,
        gap: 12,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: 8,
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
    previewCard: {
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    previewCenter: {
        textAlign: 'center',
    },
    previewMuted: {
        textAlign: 'center',
        opacity: 0.75,
        marginBottom: 4,
    },
    previewDivider: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(100,116,139,0.3)',
        marginVertical: 6,
    },
    previewLine: {
        fontFamily: 'monospace',
        marginBottom: 2,
    },
    previewFooter: {
        marginTop: 4,
        opacity: 0.8,
    },
});
