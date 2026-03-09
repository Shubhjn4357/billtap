import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { storeBusinessId, toApiError, toUserMessage } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { extractUpiIdFromPayload, isValidUpiId, sanitizeUpiId } from '../../utils/upi';
import { SignatureCaptureSheet } from '../../components/signature/SignatureCaptureSheet';
import { AppTopBar } from '../../components/ui/AppTopBar';
import { AppInput } from '../../components/ui/AppInput';
import { DateField } from '../../components/ui/DateField';
import { SelectField } from '../../components/ui/SelectField';
import { AuthChip, AuthHero } from '../../components/ui/AuthBlocks';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY_CODE } from '../../constants/countryOptions';
import { INDIAN_STATE_LIST } from '../../constants/gstRates';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { secureStorage } from '../../services/secureStorage';
import { saveSettingsSection } from '../../repositories/settingsRepository';
import { useOrganizations } from '../../hooks/useOrganizations';
import { useOrganizationMutations } from '../../hooks/useOrganizationMutations';

type OrganizationLite = {
    id: string;
    name: string;
    code?: string | null;
    currency?: string | null;
    state?: string | null;
    city?: string | null;
    pincode?: string | null;
    booksStartDate?: string | null;
    openingCashInHand?: number | null;
    openingCashInBank?: number | null;
    role?: string | null;
};

const toOrganizationLite = (entry: {
    id: string;
    name: string;
    code?: string | null;
    currency?: string | null;
    state?: string | null;
    city?: string | null;
    pincode?: string | null;
    booksStartDate?: string | null;
    openingCashInHand?: number | null;
    openingCashInBank?: number | null;
}): OrganizationLite => ({
    id: entry.id,
    name: entry.name,
    code: entry.code ?? null,
    currency: entry.currency ?? 'INR',
    state: entry.state ?? null,
    city: entry.city ?? null,
    pincode: entry.pincode ?? null,
    booksStartDate: entry.booksStartDate ?? null,
    openingCashInHand: entry.openingCashInHand ?? null,
    openingCashInBank: entry.openingCashInBank ?? null,
    role: 'owner',
});

const PENDING_SETUP_KEY_PREFIX = 'vahi_pending_setup_';

const sanitizeBusinessCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

const deriveBusinessCode = (name: string) => {
    const compact = sanitizeBusinessCode(name.replace(/\s+/g, ''));
    if (compact.length >= 2) return compact.slice(0, 10);

    const words = name
        .split(/\s+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 4)
        .map((entry) => entry[0]?.toUpperCase() ?? '')
        .join('');

    const fallback = sanitizeBusinessCode(words);
    if (fallback.length >= 2) return fallback;
    return `VH${Date.now().toString().slice(-4)}`;
};

const todayDateString = () => new Date().toISOString().slice(0, 10);

const toPositiveNumber = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
};

const isCloudWriteRestriction = (error: unknown): boolean => {
    const message = toUserMessage(error, '').toLowerCase();
    return (
        message.includes('offline mode only') ||
        message.includes('cloud write actions are blocked') ||
        message.includes('read-only')
    );
};

export default function BusinessSelectScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const dialog = useAppDialog();
    const params = useLocalSearchParams<{ upiPayload?: string | string[]; scanAt?: string | string[] }>();

    const refreshUser = useAuthStore((state) => state.refreshUser);
    const signOut = useAuthStore((state) => state.signOut);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [businessName, setBusinessName] = useState('');
    const [businessCode, setBusinessCode] = useState('');
    const [currency, setCurrency] = useState(DEFAULT_CURRENCY_CODE);
    const [legalName, setLegalName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [gstNumber, setGstNumber] = useState('');
    const [address, setAddress] = useState('');
    const [stateCode, setStateCode] = useState('');
    const [city, setCity] = useState('');
    const [pincode, setPincode] = useState('');
    const [booksStartDate, setBooksStartDate] = useState<string | null>(todayDateString());
    const [openingCashInHand, setOpeningCashInHand] = useState('0');
    const [openingCashInBank, setOpeningCashInBank] = useState('0');
    const [switchingBusinessId, setSwitchingBusinessId] = useState<string | null>(null);
    const [paymentUpiId, setPaymentUpiId] = useState('');
    const [signatureUrl, setSignatureUrl] = useState('');
    const [signatureCaptureVisible, setSignatureCaptureVisible] = useState(false);

    const openInfoDialog = (title: string, message: string) => {
        dialog.alert(title, message);
    };

    const {
        organizations: organizationRows,
        isLoading,
        isFetching,
        refetch,
    } = useOrganizations({
        staleTime: 60_000,
    });
    const organizations = useMemo<OrganizationLite[]>(
        () => organizationRows.map(toOrganizationLite),
        [organizationRows]
    );
    const {
        createOrganization,
        deleteOrganization,
        isCreatingOrganization,
        isDeletingOrganization,
    } = useOrganizationMutations();

    useEffect(() => {
        if (!selectedId && organizations.length > 0) {
            setSelectedId(organizations[0].id);
        }
    }, [organizations, selectedId]);

    useEffect(() => {
        const payload = Array.isArray(params.upiPayload) ? params.upiPayload[0] : params.upiPayload;
        if (!payload) return;
        const extracted = extractUpiIdFromPayload(payload);
        if (!extracted) {
            dialog.alert('UPI', 'Scanned QR does not contain a valid UPI ID.');
            return;
        }
        setPaymentUpiId(extracted);
        dialog.alert('UPI', 'UPI ID captured. It will be saved in General settings after continue.');
    }, [dialog, params.scanAt, params.upiPayload]);

    const helperText = useMemo(() => {
        if (!businessName.trim()) return 'Business code auto-generates from business name.';
        return `Suggested code: ${deriveBusinessCode(businessName)}`;
    }, [businessName]);

    const handleRefresh = async () => {
        await refetch();
    };

    const persistBusinessSetup = async (receiverName?: string) => {
        const normalizedUpi = sanitizeUpiId(paymentUpiId);
        const normalizedSignature = signatureUrl.trim();
        const hasSetup = Boolean(normalizedUpi || normalizedSignature);
        if (!hasSetup) return;

        if (normalizedUpi && !isValidUpiId(normalizedUpi)) {
            throw new Error('Invalid UPI ID format. Use format like merchant@upi.');
        }

        await saveSettingsSection('GENERAL', {
            payment_upi_id: normalizedUpi || null,
            payment_receiver_name: receiverName?.trim() || null,
            signature_url: normalizedSignature || null,
            signature_data_url: normalizedSignature.startsWith('data:image/') ? normalizedSignature : null,
        });
    };

    const persistSetupOfflineDraft = async (businessId: string, receiverName?: string) => {
        const payload = {
            payment_upi_id: sanitizeUpiId(paymentUpiId) || null,
            payment_receiver_name: receiverName?.trim() || null,
            signature_url: signatureUrl.trim() || null,
        };
        await secureStorage.setItemAsync(`${PENDING_SETUP_KEY_PREFIX}${businessId}`, JSON.stringify(payload));
    };

    const handleContinue = async (businessId?: string, receiverName?: string) => {
        const nextBusinessId = businessId ?? selectedId;
        if (!nextBusinessId) {
            openInfoDialog('Select Business', 'Choose a business or create one to continue.');
            return;
        }

        setSwitchingBusinessId(nextBusinessId);
        try {
            await storeBusinessId(nextBusinessId);
            try {
                await persistBusinessSetup(receiverName);
            } catch (error) {
                if (isCloudWriteRestriction(error)) {
                    await persistSetupOfflineDraft(nextBusinessId, receiverName);
                } else {
                    openInfoDialog('Setup not saved', toUserMessage(error, 'Unable to save UPI/signature setup.'));
                }
            }
            await refreshUser();
            router.replace('/(main)');
        } catch (error) {
            const message = toUserMessage(error, 'Unable to switch business.');
            openInfoDialog('Could not continue', message);
        } finally {
            setSwitchingBusinessId(null);
        }
    };

    const handleCreateBusiness = async () => {
        const name = businessName.trim();
        if (name.length < 2) {
            openInfoDialog('Business Name Required', 'Enter a valid business name with at least 2 characters.');
            return;
        }

        const code = sanitizeBusinessCode(businessCode.trim()) || deriveBusinessCode(name);
        if (code.length < 2) {
            openInfoDialog('Business Code Invalid', 'Enter at least 2 alphanumeric characters for business code.');
            return;
        }

        try {
            const response = await createOrganization({
                name,
                code,
                currency,
                legalName: legalName.trim() || undefined,
                phoneNumber: phoneNumber.trim() || undefined,
                email: email.trim() || undefined,
                gstNumber: gstNumber.trim() || undefined,
                address: address.trim() || undefined,
                state: stateCode.trim() || undefined,
                city: city.trim() || undefined,
                pincode: pincode.trim() || undefined,
                booksStartDate: booksStartDate ?? undefined,
                openingCashInHand: toPositiveNumber(openingCashInHand),
                openingCashInBank: toPositiveNumber(openingCashInBank),
            });
            const id = response.data.id;
            setBusinessName('');
            setBusinessCode('');
            setLegalName('');
            setPhoneNumber('');
            setEmail('');
            setGstNumber('');
            setAddress('');
            setStateCode('');
            setCity('');
            setPincode('');
            setBooksStartDate(todayDateString());
            setOpeningCashInHand('0');
            setOpeningCashInBank('0');
            await refetch();
            setSelectedId(id);
            await handleContinue(id, name);
        } catch (error) {
            const normalized = toApiError(error);
            const message = toUserMessage(error, 'Failed to create business.');

            if (normalized.status === 409) {
                const existing = organizations[0];
                if (existing) {
                    dialog.alert('Business Limit Reached', message, [
                        {
                            text: 'Use Existing Business',
                            onPress: () => {
                                setSelectedId(existing.id);
                                void handleContinue(existing.id, existing.name);
                            },
                        },
                        { text: 'Cancel', style: 'cancel' },
                    ]);
                } else {
                    dialog.alert('Business Limit Reached', message);
                }
                return;
            }

            openInfoDialog('Create Business Failed', message);
        }
    };

    const handleDeleteBusiness = (org: OrganizationLite) => {
        dialog.confirm(
            'Delete Organization',
            `Delete "${org.name}"? This removes active access for this organization.`,
            () => {
                void (async () => {
                    try {
                        setSwitchingBusinessId(org.id);
                        await deleteOrganization(org.id);
                        const refreshed = await refetch();
                        const remaining = (refreshed.data?.data ?? []).map(toOrganizationLite);

                        if (selectedId === org.id) {
                            const next = remaining.find((entry) => entry.id !== org.id) ?? remaining[0] ?? null;
                            setSelectedId(next?.id ?? null);
                            if (next) {
                                await handleContinue(next.id, next.name);
                            }
                        }
                    } catch (error) {
                        openInfoDialog('Delete Failed', toUserMessage(error, 'Unable to delete organization.'));
                    } finally {
                        setSwitchingBusinessId(null);
                    }
                })();
            },
            'Delete'
        );
    };

    const handleSignOut = async () => {
        await signOut();
        router.replace('/(auth)/login');
    };

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
            <AppTopBar
                leftMode="none"
                title="Select Business"
                subtitle="Choose existing business or create a new one"
                rightAction={(
                    <Pressable style={[s.signOutTopBtn, { borderColor: colors.border }]} onPress={() => void handleSignOut()}>
                        <MaterialCommunityIcons name="logout" size={15} color={colors.textSecondary} />
                        <Text style={[s.signOutTopText, { color: colors.textSecondary }]}>Sign out</Text>
                    </Pressable>
                )}
            />
            <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    contentContainerStyle={s.container}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={(
                        <RefreshControl
                            refreshing={isFetching && !isLoading}
                            onRefresh={() => {
                                void handleRefresh();
                            }}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    )}
                >
                    <AuthHero
                        eyebrow="Workspace setup"
                        title="Choose your active business"
                        subtitle="Data, permissions, settings, and offline sync all stay isolated by the selected business."
                        icon="domain"
                    >
                        <AuthChip icon="database-outline" label="Local-first scope" />
                        <AuthChip icon="account-lock-outline" label="Role aware" />
                        <AuthChip icon="cloud-sync-outline" label="Sync later" />
                    </AuthHero>

                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Your Businesses</Text>
                        {isLoading ? (
                            <View style={s.loadingBox}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        ) : organizations.length === 0 ? (
                            <View style={s.emptyBox}>
                                <Text style={s.emptyText}>No business found yet. Create one below.</Text>
                            </View>
                        ) : (
                            organizations.map((org) => {
                                const isActive = selectedId === org.id;
                                const isSwitching = switchingBusinessId === org.id;
                                const canDelete = organizations.length > 1;
                                return (
                                    <Pressable
                                        key={org.id}
                                        style={[
                                            s.orgCard,
                                            isActive && {
                                                borderColor: colors.primary,
                                                backgroundColor: colors.surfaceVariant,
                                            },
                                        ]}
                                        onPress={() => setSelectedId(org.id)}
                                    >
                                        <View style={s.orgRow}>
                                            <Text style={s.orgName}>{org.name}</Text>
                                            <View style={[s.roleChip, { backgroundColor: colors.backgroundElement }]}>
                                                <Text style={s.roleChipText}>{(org.role ?? 'owner').toUpperCase()}</Text>
                                            </View>
                                        </View>
                                        <Text style={s.orgMeta}>
                                            Code: {org.code ?? '-'} | Currency: {org.currency ?? 'INR'}
                                        </Text>
                                        {org.state || org.city || org.pincode ? (
                                            <Text style={s.orgMeta}>
                                                {org.city ? `${org.city}, ` : ''}
                                                {org.state ?? ''}
                                                {org.pincode ? ` - ${org.pincode}` : ''}
                                            </Text>
                                        ) : null}
                                        {isActive ? (
                                            <Pressable
                                                style={[s.primaryButton, isSwitching && s.buttonDisabled]}
                                                onPress={() => handleContinue(org.id)}
                                                disabled={Boolean(isSwitching)}
                                            >
                                                {isSwitching ? (
                                                    <ActivityIndicator color={colors.onPrimary} />
                                                ) : (
                                                    <Text style={s.primaryButtonText}>Continue with this business</Text>
                                                )}
                                            </Pressable>
                                        ) : null}
                                        <Pressable
                                            style={[
                                                s.dangerButton,
                                                (!canDelete || isSwitching || isDeletingOrganization) && s.buttonDisabled,
                                            ]}
                                            onPress={() => handleDeleteBusiness(org)}
                                            disabled={Boolean(!canDelete || isSwitching || isDeletingOrganization)}
                                        >
                                            <MaterialCommunityIcons name="trash-can-outline" size={14} color={colors.error} />
                                            <Text style={s.dangerButtonText}>
                                                {canDelete ? 'Delete Organization' : 'At least one required'}
                                            </Text>
                                        </Pressable>
                                    </Pressable>
                                );
                            })
                        )}
                    </View>

                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Create New Business</Text>
                        <View style={s.formCard}>
                            <Text style={s.inputLabel}>Business Name</Text>
                            <AppInput
                                value={businessName}
                                onChangeText={setBusinessName}
                                inputType="name"
                                placeholder="e.g. Vahi Traders"
                                containerStyle={s.inputWrap}
                            />

                            <Text style={s.inputLabel}>Business Code (optional)</Text>
                            <AppInput
                                value={businessCode}
                                onChangeText={(value) => setBusinessCode(sanitizeBusinessCode(value))}
                                inputType="text"
                                placeholder="Auto-generated if left empty"
                                containerStyle={s.inputWrap}
                                autoCapitalize="characters"
                            />
                            <Text style={s.helperText}>{helperText}</Text>

                            <Text style={s.inputLabel}>Currency</Text>
                            <SelectField
                                value={currency}
                                onChange={setCurrency}
                                title="Business Currency"
                                placeholder="Select currency"
                                options={CURRENCY_OPTIONS.map((entry) => ({
                                    label: entry.code,
                                    value: entry.code,
                                    description: entry.label,
                                }))}
                            />

                            <Text style={s.inputLabel}>Legal Name (optional)</Text>
                            <AppInput
                                value={legalName}
                                onChangeText={setLegalName}
                                inputType="name"
                                placeholder="As per registration"
                                containerStyle={s.inputWrap}
                            />

                            <Text style={s.inputLabel}>Phone (optional)</Text>
                            <AppInput
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                inputType="phone"
                                placeholder="Business contact number"
                                containerStyle={s.inputWrap}
                            />

                            <Text style={s.inputLabel}>Email (optional)</Text>
                            <AppInput
                                value={email}
                                onChangeText={setEmail}
                                inputType="email"
                                placeholder="billing@business.com"
                                containerStyle={s.inputWrap}
                                autoCapitalize="none"
                            />

                            <Text style={s.inputLabel}>GST Number (optional)</Text>
                            <AppInput
                                value={gstNumber}
                                onChangeText={setGstNumber}
                                inputType="text"
                                placeholder="GSTIN"
                                containerStyle={s.inputWrap}
                                autoCapitalize="characters"
                            />

                            <Text style={s.inputLabel}>Address (optional)</Text>
                            <AppInput
                                value={address}
                                onChangeText={setAddress}
                                inputType="text"
                                placeholder="Street / area"
                                containerStyle={s.inputWrap}
                            />

                            <Text style={s.inputLabel}>State (optional)</Text>
                            <SelectField
                                value={stateCode}
                                onChange={setStateCode}
                                title="State"
                                placeholder="Select state"
                                options={INDIAN_STATE_LIST.map((entry) => ({
                                    label: entry.name,
                                    value: entry.code,
                                    description: entry.label,
                                }))}
                                allowClear
                                onClear={() => setStateCode('')}
                            />

                            <Text style={s.inputLabel}>City (optional)</Text>
                            <AppInput
                                value={city}
                                onChangeText={setCity}
                                inputType="name"
                                placeholder="City"
                                containerStyle={s.inputWrap}
                            />

                            <Text style={s.inputLabel}>Pincode (optional)</Text>
                            <AppInput
                                value={pincode}
                                onChangeText={setPincode}
                                inputType="number"
                                placeholder="Postal code"
                                containerStyle={s.inputWrap}
                            />

                            <Text style={s.inputLabel}>Books Opening Date</Text>
                            <DateField
                                value={booksStartDate}
                                onChange={setBooksStartDate}
                                placeholder="Select opening date"
                                title="Books opening date"
                                allowClear={false}
                            />

                            <Text style={s.inputLabel}>Opening Cash in Hand</Text>
                            <AppInput
                                value={openingCashInHand}
                                onChangeText={setOpeningCashInHand}
                                inputType="decimal"
                                placeholder="0"
                                containerStyle={s.inputWrap}
                            />

                            <Text style={s.inputLabel}>Opening Cash in Bank</Text>
                            <AppInput
                                value={openingCashInBank}
                                onChangeText={setOpeningCashInBank}
                                inputType="decimal"
                                placeholder="0"
                                containerStyle={s.inputWrap}
                            />

                            <Text style={s.inputLabel}>Payment UPI ID (optional)</Text>
                            <AppInput
                                value={paymentUpiId}
                                onChangeText={setPaymentUpiId}
                                inputType="upi"
                                placeholder="merchant@upi"
                                containerStyle={s.inputWrap}
                                autoCapitalize="none"
                            />
                            <Pressable
                                style={s.scanAction}
                                onPress={() => router.push({
                                    pathname: '/scan',
                                    params: {
                                        target: 'upi_profile',
                                        returnPath: '/(auth)/business-select',
                                    },
                                })}
                            >
                                <Text style={[s.scanActionText, { color: colors.primary }]}>Scan UPI QR</Text>
                            </Pressable>

                            <Text style={s.inputLabel}>Signature Image URL (optional)</Text>
                            <AppInput
                                value={signatureUrl}
                                onChangeText={setSignatureUrl}
                                inputType="url"
                                placeholder="https://.../signature.png"
                                containerStyle={s.inputWrap}
                                autoCapitalize="none"
                            />
                            <View style={s.signatureActions}>
                                <Pressable
                                    style={[s.secondaryInlineButton, { borderColor: colors.border }]}
                                    onPress={() => setSignatureCaptureVisible(true)}
                                >
                                    <Text style={[s.secondaryInlineButtonText, { color: colors.primary }]}>Draw Signature</Text>
                                </Pressable>
                                {signatureUrl ? (
                                    <Pressable
                                        style={[s.secondaryInlineButton, { borderColor: colors.border }]}
                                        onPress={() => setSignatureUrl('')}
                                    >
                                        <Text style={[s.secondaryInlineButtonText, { color: colors.error }]}>Clear</Text>
                                    </Pressable>
                                ) : null}
                            </View>
                            {signatureUrl ? (
                                <View style={s.signaturePreviewWrap}>
                                    <Image source={{ uri: signatureUrl }} style={s.signaturePreview} resizeMode="contain" />
                                </View>
                            ) : null}
                            <Text style={s.helperText}>UPI and signature setup will be saved into General settings of selected business.</Text>

                            <Pressable
                                style={[s.primaryButton, isCreatingOrganization && s.buttonDisabled]}
                                onPress={handleCreateBusiness}
                                disabled={isCreatingOrganization}
                            >
                                {isCreatingOrganization ? (
                                    <ActivityIndicator color={colors.onPrimary} />
                                ) : (
                                    <Text style={s.primaryButtonText}>Create and Continue</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
            <SignatureCaptureSheet
                visible={signatureCaptureVisible}
                onClose={() => setSignatureCaptureVisible(false)}
                onSave={(dataUrl) => {
                    setSignatureCaptureVisible(false);
                    setSignatureUrl(dataUrl);
                }}
            />
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        flex: { flex: 1 },
        container: {
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.xl,
            gap: Spacing.lg,
        },
        signOutTopBtn: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        signOutTopText: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        section: {
            gap: Spacing.sm,
        },
        sectionTitle: {
            fontSize: Typography.label.size,
            fontWeight: '700',
            color: colors.textSecondary,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
        },
        loadingBox: {
            backgroundColor: colors.surface,
            borderRadius: Radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: Spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptyBox: {
            backgroundColor: colors.surface,
            borderRadius: Radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            padding: Spacing.lg,
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: Typography.body.size,
        },
        orgCard: {
            backgroundColor: colors.card,
            borderRadius: Radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            padding: Spacing.md,
            gap: Spacing.sm,
            marginBottom: Spacing.sm,
            shadowColor: colors.text,
            shadowOpacity: 0.04,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
        },
        orgRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        orgName: {
            flex: 1,
            color: colors.text,
            fontSize: Typography.title.size,
            fontWeight: '600',
        },
        roleChip: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 3,
        },
        roleChipText: {
            color: colors.textSecondary,
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.4,
        },
        orgMeta: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
        },
        formCard: {
            backgroundColor: colors.card,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, '16'),
            padding: Spacing.md,
            gap: Spacing.sm,
            shadowColor: colors.text,
            shadowOpacity: 0.04,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
        },
        inputLabel: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            fontWeight: '600',
        },
        inputWrap: {
            marginBottom: Spacing.xs,
        },
        helperText: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
        },
        signatureActions: {
            flexDirection: 'row',
            gap: Spacing.sm,
            marginTop: Spacing.xs,
            alignItems: 'center',
        },
        secondaryInlineButton: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        secondaryInlineButtonText: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        signaturePreviewWrap: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.md,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            marginTop: Spacing.xs,
        },
        signaturePreview: {
            width: '100%',
            height: 120,
        },
        scanAction: {
            alignSelf: 'flex-start',
            marginTop: 2,
            marginBottom: 2,
        },
        scanActionText: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        primaryButton: {
            backgroundColor: colors.primary,
            borderRadius: Radius.pill,
            minHeight: 46,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: Spacing.xs,
            shadowColor: colors.primary,
            shadowOpacity: 0.16,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
        },
        primaryButtonText: {
            color: colors.onPrimary,
            fontWeight: '700',
            fontSize: Typography.body.size,
        },
        dangerButton: {
            borderRadius: Radius.pill,
            minHeight: 38,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: Spacing.xs,
            borderWidth: 1,
            borderColor: colors.error,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            gap: Spacing.xs,
        },
        dangerButtonText: {
            color: colors.error,
            fontWeight: '700',
            fontSize: Typography.caption.size,
        },
        buttonDisabled: {
            opacity: 0.7,
        },
    });
