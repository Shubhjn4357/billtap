import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Chip, Text, useTheme } from 'react-native-paper';
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
import { BUSINESS_CARD_TEMPLATES, shareBusinessCardPdf } from '../../utils/businessCard';
import { isNetworkLikeError } from '../../utils/errorGuards';
import {
    equalBusinessCardStudioModel,
    parseBusinessCardStudioModel,
    toBusinessCardSettingsPatch,
} from './studioModels';

const getInitials = (value: string): string => {
    const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length === 0) return 'BS';
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
};

export const BusinessSuiteBusinessCardStudioScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const dialog = useAppDialog();
    const { user } = useAuth();
    const {
        selectedOrganizationId,
        canManageBusinessCards,
        canAccessSettings,
        isOwner,
        setOrganizationSettings,
    } = useOrganizationAccess();
    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [organizationName, setOrganizationName] = useState('Business');
    const [model, setModel] = useState(() => parseBusinessCardStudioModel({}, null, user ?? null));
    const [baseModel, setBaseModel] = useState(() => parseBusinessCardStudioModel({}, null, user ?? null));
    const canEdit = canManageBusinessCards && (canAccessSettings || isOwner);
    const isWide = width >= 940;

    const query = useQuery({
        queryKey: ['business-card-studio', selectedOrganizationId ?? 'auto', user?.uid ?? 'guest'] as const,
        enabled: Boolean(user),
        staleTime: 30_000,
        queryFn: async () => businessSuiteService.getCurrentOrganization(selectedOrganizationId ?? undefined),
    });

    useFocusRefresh(async () => { await query.refetch(); }, { enabled: Boolean(user), minIntervalMs: 10_000, delayMs: 120 });

    useEffect(() => {
        if (!query.data) return;
        const nextModel = parseBusinessCardStudioModel(query.data.context.settings, query.data.organization, user ?? null);
        setModel(nextModel);
        setBaseModel(nextModel);
        setOrganizationName(query.data.organization.name || 'Business');
    }, [query.data, user]);

    const activeTemplate = useMemo(
        () => BUSINESS_CARD_TEMPLATES.find((entry) => entry.key === model.templateKey) ?? BUSINESS_CARD_TEMPLATES[0],
        [model.templateKey]
    );
    const initials = useMemo(() => getInitials(organizationName), [organizationName]);
    const hasChanges = useMemo(() => !equalBusinessCardStudioModel(model, baseModel), [baseModel, model]);
    const templateOptions = useMemo<SelectorOption[]>(
        () => BUSINESS_CARD_TEMPLATES.map((entry) => ({ key: entry.key, label: entry.name })),
        []
    );
    const queryError = query.error && !isNetworkLikeError(query.error) ? (query.error instanceof Error ? query.error.message : 'Failed to load card data.') : null;

    const handleSave = useCallback(async () => {
        if (!canEdit) {
            dialog.alert('Business Card Studio', 'Read-only access. Only organization owners with settings access can save.');
            return;
        }
        if (!hasChanges) return;
        setSaving(true);
        try {
            const settings = await businessSuiteService.updateOrganizationSettings(toBusinessCardSettingsPatch(model), selectedOrganizationId ?? undefined);
            setOrganizationSettings(settings);
            setBaseModel(model);
            dialog.alert('Business Card Studio', 'Card settings saved.');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Business Card Studio', error instanceof Error ? error.message : 'Failed to save card settings.');
            }
        } finally {
            setSaving(false);
        }
    }, [canEdit, dialog, hasChanges, model, selectedOrganizationId, setOrganizationSettings]);

    const handleShare = useCallback(async () => {
        if (!canManageBusinessCards) {
            dialog.alert('Business Card Studio', 'You do not have permission to share business cards.');
            return;
        }
        setSharing(true);
        try {
            await shareBusinessCardPdf({
                templateKey: model.templateKey,
                businessName: organizationName,
                ownerName: model.ownerName,
                phoneNumber: model.phoneNumber,
                email: model.email,
                website: model.website,
                tagline: model.tagline,
                address: model.address,
                gstNumber: model.gstNumber,
            });
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Business Card Studio', error instanceof Error ? error.message : 'Unable to share business card.');
            }
        } finally {
            setSharing(false);
        }
    }, [canManageBusinessCards, dialog, model, organizationName]);

    return (
        <ScreenWrapper>
            <AppPullToRefresh refreshing={query.isFetching} onRefresh={() => { void query.refetch(); }}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={[styles.inner, isWide && styles.innerWide]}>
                        <PageHeaderCard
                            title="Business Card Studio"
                            subtitle={`${organizationName} · real organization-backed card details`}
                            right={<AppButton mode="contained-tonal" compact style={styles.pillButton} onPress={() => setTemplatePickerOpen(true)}>Templates</AppButton>}
                        />
                        {queryError ? <Text variant="bodySmall" style={{ color: theme.colors.error }}>{queryError}</Text> : null}
                        {query.isFetching && !query.data ? <AppCard><View style={styles.loadingRow}><ActivityIndicator size="small" /><Text variant="bodySmall">Loading business card data...</Text></View></AppCard> : null}

                        <AppCard>
                            <View style={styles.metaRow}>
                                <Chip compact icon="office-building-outline">{organizationName}</Chip>
                                <Chip compact icon={canEdit ? 'lock-open-outline' : 'eye-outline'}>{canEdit ? 'Editable' : 'Read Only'}</Chip>
                                <Chip compact icon={hasChanges ? 'pencil-outline' : 'check-circle-outline'}>{hasChanges ? 'Unsaved' : 'Saved'}</Chip>
                            </View>
                        </AppCard>

                        <View style={[styles.grid, isWide && styles.gridWide]}>
                            <AppCard style={styles.previewCard}>
                                <Text variant="titleMedium" style={styles.sectionTitle}>Preview</Text>
                                <View style={styles.metaRow}>
                                    <Chip compact icon="palette-outline">{activeTemplate.name}</Chip>
                                    <Chip compact icon="card-account-details-outline">{model.ownerName || 'Owner'}</Chip>
                                </View>
                                <View style={[styles.frontCard, { backgroundColor: activeTemplate.background, borderColor: activeTemplate.accent }]}>
                                    <View style={styles.frontHead}>
                                        <View style={[styles.initialBadge, { borderColor: activeTemplate.accent }]}><Text style={{ color: activeTemplate.accent, fontWeight: '700' }}>{initials}</Text></View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.previewName, { color: activeTemplate.foreground }]}>{organizationName}</Text>
                                            <Text style={[styles.previewOwner, { color: activeTemplate.accent }]}>{model.ownerName || 'Owner'}</Text>
                                        </View>
                                    </View>
                                    {!!model.tagline ? <Text style={[styles.previewText, { color: activeTemplate.foreground }]}>{model.tagline}</Text> : null}
                                    <Text style={[styles.previewText, { color: activeTemplate.foreground }]}>{model.phoneNumber || 'Phone missing'}</Text>
                                    <Text style={[styles.previewText, { color: activeTemplate.foreground }]}>{model.email || 'Email missing'}</Text>
                                    <Text style={[styles.previewText, { color: activeTemplate.foreground }]}>{model.website || 'Website missing'}</Text>
                                </View>
                            </AppCard>

                            <AppCard style={styles.controlCard}>
                                <Text variant="titleMedium" style={styles.sectionTitle}>Controls</Text>
                                <View style={styles.actionRow}>
                                    <AppButton mode="contained-tonal" style={styles.actionBtn} onPress={() => setTemplatePickerOpen(true)}>Choose</AppButton>
                                    <AppButton mode="contained" style={styles.actionBtn} onPress={() => { void handleSave(); }} disabled={!canEdit || !hasChanges} loading={saving}>Save</AppButton>
                                    <AppButton mode="outlined" style={styles.actionBtn} onPress={() => { void handleShare(); }} loading={sharing}>Share</AppButton>
                                </View>

                                <AppAccordion title="Identity" icon="badge-account-horizontal-outline" defaultExpanded>
                                    <AppInput label="Owner Name" inputType="name" value={model.ownerName} onChangeText={(value) => setModel((prev) => ({ ...prev, ownerName: value }))} editable={canEdit} />
                                    <AppInput label="Tagline" value={model.tagline} onChangeText={(value) => setModel((prev) => ({ ...prev, tagline: value }))} editable={canEdit} />
                                </AppAccordion>
                                <AppAccordion title="Contact" icon="phone-outline" defaultExpanded>
                                    <AppInput label="Phone Number" inputType="phone" value={model.phoneNumber} onChangeText={(value) => setModel((prev) => ({ ...prev, phoneNumber: value }))} editable={canEdit} />
                                    <AppInput label="Email" inputType="email" value={model.email} onChangeText={(value) => setModel((prev) => ({ ...prev, email: value }))} editable={canEdit} />
                                    <AppInput label="Website" inputType="url" value={model.website} onChangeText={(value) => setModel((prev) => ({ ...prev, website: value }))} editable={canEdit} />
                                    <AppInput label="Address" value={model.address} onChangeText={(value) => setModel((prev) => ({ ...prev, address: value }))} editable={canEdit} />
                                </AppAccordion>
                                <AppAccordion title="Compliance" icon="file-document-outline">
                                    <AppInput label="GST Number" value={model.gstNumber} onChangeText={(value) => setModel((prev) => ({ ...prev, gstNumber: value }))} editable={canEdit} />
                                </AppAccordion>
                            </AppCard>
                        </View>
                    </View>
                </ScrollView>
            </AppPullToRefresh>
            <SelectorSheet visible={templatePickerOpen} onDismiss={() => setTemplatePickerOpen(false)} onSelect={(option) => setModel((prev) => ({ ...prev, templateKey: option.key }))} options={templateOptions} selectedKey={model.templateKey} title="Choose Card Template" allowCustom={false} />
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
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    actionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    actionBtn: { flex: 1, borderRadius: DesignSystem.radius.pill },
    frontCard: { borderWidth: 1, borderRadius: DesignSystem.radius.sm, padding: 12, gap: 4 },
    frontHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    initialBadge: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    previewName: { fontWeight: '800', fontSize: 17 },
    previewOwner: { fontWeight: '700', fontSize: 13 },
    previewText: { fontSize: 12, opacity: 0.9 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pillButton: { borderRadius: DesignSystem.radius.pill },
});
