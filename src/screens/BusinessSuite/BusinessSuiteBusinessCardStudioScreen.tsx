import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Chip, Text, useTheme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { businessSuiteService, type StaffPermissions } from '../../api/businessSuiteService';
import { useAuth } from '../../hooks/useAuth';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { useOrganizationStore } from '../../store';
import { DesignSystem } from '../../constants/DesignSystem';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { BUSINESS_CARD_TEMPLATES, shareBusinessCardPdf } from '../../utils/businessCard';

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const getInitials = (value: string): string => {
    const parts = value
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0) return 'BS';
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
};

const isValidHttpUrl = (value: string): boolean => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

export const BusinessSuiteBusinessCardStudioScreen = () => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const dialog = useAppDialog();
    const { user } = useAuth();
    const {
        selectedOrganizationId,
        setOrganizationSettings,
    } = useOrganizationStore();

    const [organizationName, setOrganizationName] = useState('Business');
    const [templateKey, setTemplateKey] = useState(BUSINESS_CARD_TEMPLATES[0]?.key ?? 'sunrise_orange');
    const [ownerName, setOwnerName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [website, setWebsite] = useState('');
    const [tagline, setTagline] = useState('');
    const [address, setAddress] = useState('');
    const [gstNumber, setGstNumber] = useState('');
    const [customImageUrl, setCustomImageUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [canManageBusinessCards, setCanManageBusinessCards] = useState(false);
    const isWide = width >= 960;

    const cardQuery = useQuery({
        queryKey: ['business-suite-business-card-studio', selectedOrganizationId ?? 'auto', user?.uid ?? 'guest'] as const,
        enabled: Boolean(user),
        staleTime: 30_000,
        queryFn: async () => {
            return await businessSuiteService.getCurrentOrganization(selectedOrganizationId ?? undefined);
        },
    });
    const { refetch: refetchBusinessCardStudio } = cardQuery;

    useEffect(() => {
        if (!cardQuery.data) return;

        const settings = asRecord(cardQuery.data.context.settings);
        const businessCard = asRecord(settings.businessCard);
        const permissions = asRecord(cardQuery.data.context.permissions) as StaffPermissions;
        const ownerOrAdmin = cardQuery.data.context.role === 'owner' || user?.role === 'admin';
        const allowed = ownerOrAdmin || Boolean(permissions.can_manage_templates);

        setCanManageBusinessCards(allowed);
        setOrganizationName(cardQuery.data.organization.name || 'Business');
        setTemplateKey(
            typeof businessCard.templateKey === 'string'
                ? businessCard.templateKey
                : (BUSINESS_CARD_TEMPLATES[0]?.key ?? 'sunrise_orange')
        );
        setOwnerName(
            typeof businessCard.ownerName === 'string'
                ? businessCard.ownerName
                : (user?.displayName || user?.phoneNumber || 'Owner')
        );
        setPhoneNumber(
            typeof businessCard.phoneNumber === 'string'
                ? businessCard.phoneNumber
                : (cardQuery.data.organization.phoneNumber || user?.phoneNumber || '')
        );
        setEmail(
            typeof businessCard.email === 'string'
                ? businessCard.email
                : (cardQuery.data.organization.email || user?.email || '')
        );
        setWebsite(typeof businessCard.website === 'string' ? businessCard.website : '');
        setTagline(typeof businessCard.tagline === 'string' ? businessCard.tagline : '');
        setAddress(
            typeof businessCard.address === 'string'
                ? businessCard.address
                : (cardQuery.data.organization.address || '')
        );
        setGstNumber(
            typeof businessCard.gstNumber === 'string'
                ? businessCard.gstNumber
                : (cardQuery.data.organization.gstNumber || user?.gstNumber || '')
        );
        setCustomImageUrl(typeof businessCard.customImageUrl === 'string' ? businessCard.customImageUrl : '');
    }, [cardQuery.data, user?.displayName, user?.email, user?.gstNumber, user?.phoneNumber, user?.role]);

    const activeTemplate = useMemo(() => {
        return BUSINESS_CARD_TEMPLATES.find((entry) => entry.key === templateKey) ?? BUSINESS_CARD_TEMPLATES[0];
    }, [templateKey]);

    const payload = useMemo(() => ({
        templateKey,
        businessName: organizationName.trim() || 'Business Name',
        ownerName: ownerName.trim() || 'Owner',
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        website: website.trim(),
        tagline: tagline.trim(),
        address: address.trim(),
        gstNumber: gstNumber.trim(),
    }), [address, email, gstNumber, organizationName, ownerName, phoneNumber, tagline, templateKey, website]);

    useFocusRefresh(async () => {
        await refetchBusinessCardStudio();
    }, {
        enabled: Boolean(user),
        minIntervalMs: 10_000,
        delayMs: 120,
    });

    const handleSave = useCallback(async () => {
        if (!canManageBusinessCards) {
            dialog.alert('Access Denied', 'You do not have permission to manage business cards.');
            return;
        }
        const normalizedCustomImage = customImageUrl.trim();
        if (normalizedCustomImage && !isValidHttpUrl(normalizedCustomImage)) {
            dialog.alert('Business Card', 'Custom image must be a valid http/https URL.');
            return;
        }
        setSaving(true);
        try {
            const settings = await businessSuiteService.updateOrganizationSettings({
                businessCard: {
                    ...payload,
                    customImageUrl: normalizedCustomImage,
                },
            }, selectedOrganizationId ?? undefined);
            setOrganizationSettings(settings);
            dialog.alert('Business Card', 'Business card settings saved.');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Business Card', error instanceof Error ? error.message : 'Failed to save business card.');
            }
        } finally {
            setSaving(false);
        }
    }, [canManageBusinessCards, customImageUrl, dialog, payload, selectedOrganizationId, setOrganizationSettings]);

    const handleShare = useCallback(async () => {
        if (!canManageBusinessCards) {
            dialog.alert('Access Denied', 'You do not have permission to share business cards.');
            return;
        }
        setSharing(true);
        try {
            const customUrl = customImageUrl.trim();
            if (customUrl && !isValidHttpUrl(customUrl)) {
                dialog.alert('Business Card', 'Custom image must be a valid http/https URL.');
                return;
            }
            if (customUrl) {
                await Share.share({
                    title: `${payload.businessName} Business Card`,
                    message: `${payload.businessName}\n${customUrl}`,
                });
            } else {
                await shareBusinessCardPdf(payload);
            }
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Business Card', error instanceof Error ? error.message : 'Failed to share business card.');
            }
        } finally {
            setSharing(false);
        }
    }, [canManageBusinessCards, customImageUrl, dialog, payload]);

    const queryError = cardQuery.error && !isNetworkLikeError(cardQuery.error)
        ? (cardQuery.error instanceof Error ? cardQuery.error.message : 'Failed to load business card data.')
        : null;
    const initials = getInitials(payload.businessName);

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                <PageHeaderCard
                    title="Business Card Studio"
                    subtitle={`${organizationName} - Live preview updates instantly`}
                />

                {queryError ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
                        {queryError}
                    </Text>
                ) : null}

                {cardQuery.isFetching && !cardQuery.data && (
                    <AppCard animationDelay={30}>
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" />
                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                Loading business card settings...
                            </Text>
                        </View>
                    </AppCard>
                )}

                <View style={[styles.studioGrid, isWide && styles.studioGridWide]}>
                    <AppCard animationDelay={40} style={styles.previewCardShell}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Live Card Preview
                        </Text>
                        <View style={styles.templateMetaRow}>
                            <Chip compact icon="palette-outline">{activeTemplate.name}</Chip>
                            <Chip compact icon="credit-card-outline">Front + Back</Chip>
                        </View>

                        {customImageUrl.trim() ? (
                            <View
                                style={[
                                    styles.customImageWrap,
                                    {
                                        borderColor: activeTemplate.accent,
                                        backgroundColor: theme.colors.elevation.level1,
                                    },
                                ]}
                            >
                                <Image source={{ uri: customImageUrl.trim() }} style={styles.previewImage} />
                                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                                    Custom image override is active. Save to use this image in shared card output.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.previewStack}>
                                <View
                                    style={[
                                        styles.frontCard,
                                        {
                                            backgroundColor: activeTemplate.background,
                                            borderColor: activeTemplate.accent,
                                        },
                                    ]}
                                >
                                    <View style={styles.frontTopRow}>
                                        <View
                                            style={[
                                                styles.brandBadge,
                                                {
                                                    borderColor: activeTemplate.accent,
                                                    backgroundColor: theme.colors.surface,
                                                },
                                            ]}
                                        >
                                            <Text style={[styles.brandBadgeText, { color: activeTemplate.accent }]}>
                                                {initials}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.previewBusinessName, { color: activeTemplate.foreground }]}>
                                                {payload.businessName}
                                            </Text>
                                            <Text style={[styles.previewOwner, { color: activeTemplate.accent }]}>
                                                {payload.ownerName}
                                            </Text>
                                        </View>
                                    </View>

                                    {!!payload.tagline && (
                                        <Text style={[styles.previewTagline, { color: activeTemplate.foreground }]}>
                                            {payload.tagline}
                                        </Text>
                                    )}

                                    <View style={styles.contactRows}>
                                        <Text style={[styles.previewMeta, { color: activeTemplate.foreground }]}>
                                            {payload.phoneNumber || '-'}
                                        </Text>
                                        <Text style={[styles.previewMeta, { color: activeTemplate.foreground }]}>
                                            {payload.email || '-'}
                                        </Text>
                                        <Text style={[styles.previewMeta, { color: activeTemplate.foreground }]}>
                                            {payload.website || '-'}
                                        </Text>
                                    </View>
                                </View>

                                <View
                                    style={[
                                        styles.backCard,
                                        {
                                            backgroundColor: activeTemplate.accent,
                                            borderColor: activeTemplate.foreground,
                                        },
                                    ]}
                                >
                                    <View style={styles.backTopRow}>
                                        <Text style={[styles.backBusinessName, { color: '#FFFFFF' }]}>
                                            {payload.businessName}
                                        </Text>
                                        <View style={styles.qrFrame}>
                                            <View style={styles.qrInner} />
                                        </View>
                                    </View>
                                    <Text style={styles.backAddress}>
                                        {payload.address || 'Address not set'}
                                    </Text>
                                    {!!payload.gstNumber && (
                                        <Text style={styles.backAddress}>GSTIN: {payload.gstNumber}</Text>
                                    )}
                                </View>
                            </View>
                        )}
                    </AppCard>

                    <AppCard animationDelay={80} style={styles.controlCardShell}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Card Settings
                        </Text>
                        <View style={styles.templateGrid}>
                            {BUSINESS_CARD_TEMPLATES.map((template) => (
                                <Chip
                                    key={template.key}
                                    selected={templateKey === template.key}
                                    mode={templateKey === template.key ? 'flat' : 'outlined'}
                                    onPress={() => setTemplateKey(template.key)}
                                    style={styles.templateChip}
                                >
                                    {template.name}
                                </Chip>
                            ))}
                        </View>

                        <AppInput label="Owner Name" inputType="name" value={ownerName} onChangeText={setOwnerName} placeholder="Owner" />
                        <AppInput label="Phone Number" inputType="phone" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="+91..." />
                        <AppInput label="Email" inputType="email" value={email} onChangeText={setEmail} placeholder="name@business.com" />
                        <AppInput label="Website" inputType="url" value={website} onChangeText={setWebsite} placeholder="https://..." />
                        <AppInput label="Tagline" inputType="text" value={tagline} onChangeText={setTagline} placeholder="Quality first" />
                        <AppInput label="Address" inputType="text" value={address} onChangeText={setAddress} placeholder="Store address" />
                        <AppInput label="GST Number" inputType="text" value={gstNumber} onChangeText={setGstNumber} placeholder="GSTIN" />
                        <AppInput
                            label="Custom Card Image URL (optional)"
                            inputType="url"
                            value={customImageUrl}
                            onChangeText={setCustomImageUrl}
                            placeholder="https://..."
                        />

                        <View style={styles.actionRow}>
                            <AppButton
                                mode="contained"
                                style={styles.actionButton}
                                onPress={() => { void handleSave(); }}
                                loading={saving || cardQuery.isFetching}
                                disabled={!canManageBusinessCards}
                            >
                                Save Card
                            </AppButton>
                            <AppButton
                                mode="contained-tonal"
                                style={styles.actionButton}
                                onPress={() => { void handleShare(); }}
                                loading={sharing}
                                disabled={!canManageBusinessCards}
                            >
                                Share Card
                            </AppButton>
                        </View>
                    </AppCard>
                </View>
                </View>
            </ScrollView>
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
    templateMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
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
    customImageWrap: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 10,
    },
    previewStack: {
        gap: 10,
    },
    frontCard: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
        minHeight: 160,
    },
    backCard: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
        minHeight: 110,
    },
    frontTopRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    brandBadge: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    brandBadgeText: {
        fontSize: 14,
        fontWeight: '800',
    },
    previewBusinessName: {
        fontWeight: '800',
        fontSize: 18,
        lineHeight: 21,
    },
    previewOwner: {
        fontWeight: '700',
        marginTop: 2,
        marginBottom: 6,
    },
    previewTagline: {
        fontSize: 12,
        lineHeight: 16,
        marginBottom: 6,
    },
    contactRows: {
        gap: 3,
    },
    previewMeta: {
        fontSize: 12,
        lineHeight: 15,
    },
    previewImage: {
        width: '100%',
        minHeight: 200,
        borderRadius: 14,
        resizeMode: 'cover',
    },
    backTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    backBusinessName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '800',
        lineHeight: 19,
    },
    qrFrame: {
        width: 46,
        height: 46,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qrInner: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#101828',
        borderRadius: 4,
    },
    backAddress: {
        marginTop: 8,
        color: '#FFFFFF',
        fontSize: 11,
        lineHeight: 14,
        opacity: 0.95,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    actionButton: {
        flex: 1,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
});
