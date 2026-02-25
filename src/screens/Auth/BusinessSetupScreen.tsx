import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Href } from 'expo-router';
import { Chip, Text, useTheme } from 'react-native-paper';
import { businessSuiteService } from '../../api/businessSuiteService';
import { userService } from '../../api/userService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { SignatureCaptureModal } from '../../components/signature/SignatureCaptureModal';
import { Config } from '../../constants/Config';
import { DesignSystem } from '../../constants/DesignSystem';
import { BUSINESS_SETUP_TEXT, COMMON_TEXT } from '../../constants/staticText';
import { useNetworkStore, useOrganizationStore, useSettingsStore, useUserStore } from '../../store';
import { normalizeCurrencyCode } from '../../utils/formatters';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { extractUpiIdFromPayload, isValidUpiId, sanitizeUpiId } from '../../utils/upi';
import { businessSetupSchema } from '../../validation/forms';

const CATEGORY_OPTIONS = ['Retail', 'Wholesale', 'Services', 'Manufacturing', 'Other'] as const;

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const getSingleParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export default function BusinessSetupScreen() {
    const { user, setUser } = useUserStore();
    const { setCurrency } = useSettingsStore();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const organizationSettings = useOrganizationStore((state) => state.context.settings);
    const setOrganizationSettings = useOrganizationStore((state) => state.setOrganizationSettings);
    const { isConnected, isInternetReachable } = useNetworkStore();
    const router = useRouter();
    const params = useLocalSearchParams<{ upiPayload?: string | string[]; scanAt?: string | string[] }>();
    const theme = useTheme();
    const dialog = useAppDialog();
    const { width } = useWindowDimensions();
    const [isUiPending, startUiTransition] = useTransition();
    const handledUpiPayloadRef = useRef('');

    const [businessName, setBusinessName] = useState(user?.businessName ?? '');
    const [address, setAddress] = useState(user?.address ?? '');
    const [gst, setGst] = useState(user?.gstNumber ?? '');
    const [currency, setSelectedCurrency] = useState(
        normalizeCurrencyCode(user?.currency ?? Config.defaultCurrency)
    );
    const [category, setCategory] = useState(user?.category || '');
    const [upiId, setUpiId] = useState('');
    const [upiReceiverName, setUpiReceiverName] = useState('');
    const [signatureImageUrl, setSignatureImageUrl] = useState('');
    const [cashInHandInput, setCashInHandInput] = useState('');
    const [cashAtBankInput, setCashAtBankInput] = useState('');
    const [cashInAppInput, setCashInAppInput] = useState('');
    const [signatureModalVisible, setSignatureModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    const isOffline = isConnected === false || isInternetReachable === false;
    const isWide = width >= 980;
    const canSave = businessName.trim().length > 0 && !loading;
    const supportedCurrencies = useMemo(() => Config.supportedCurrencies.slice(0, 8), []);

    useEffect(() => {
        if (!user) return;
        setBusinessName(user.businessName ?? '');
        setAddress(user.address ?? '');
        setGst(user.gstNumber ?? '');
        setSelectedCurrency(normalizeCurrencyCode(user.currency ?? Config.defaultCurrency));
        setCategory(user.category ?? '');
    }, [user]);

    useEffect(() => {
        const settings = asRecord(organizationSettings);
        const payment = asRecord(settings.payment);
        const customization = asRecord(settings.customization);
        const openingBalances = asRecord(settings.openingBalances);
        const nextUpiId = typeof payment.upiId === 'string' ? sanitizeUpiId(payment.upiId) : '';
        const nextReceiverName = typeof payment.receiverName === 'string'
            ? payment.receiverName
            : (user?.businessName ?? user?.displayName ?? '');
        const nextSignature = typeof settings.signatureImageUrl === 'string'
            ? settings.signatureImageUrl
            : (typeof customization.signatureImageUrl === 'string' ? customization.signatureImageUrl : '');
        const cashInHand = typeof openingBalances.cashInHand === 'number' ? openingBalances.cashInHand : Number(openingBalances.cashInHand ?? 0);
        const cashAtBank = typeof openingBalances.cashAtBank === 'number' ? openingBalances.cashAtBank : Number(openingBalances.cashAtBank ?? 0);
        const cashInApp = typeof openingBalances.cashInApp === 'number' ? openingBalances.cashInApp : Number(openingBalances.cashInApp ?? 0);

        setUpiId(nextUpiId);
        setUpiReceiverName(nextReceiverName);
        setSignatureImageUrl(nextSignature);
        setCashInHandInput(Number.isFinite(cashInHand) && cashInHand > 0 ? String(cashInHand) : '');
        setCashAtBankInput(Number.isFinite(cashAtBank) && cashAtBank > 0 ? String(cashAtBank) : '');
        setCashInAppInput(Number.isFinite(cashInApp) && cashInApp > 0 ? String(cashInApp) : '');
    }, [organizationSettings, user?.businessName, user?.displayName]);

    useEffect(() => {
        const scannedPayload = getSingleParam(params.upiPayload);
        const scanSignal = getSingleParam(params.scanAt);
        const scanKey = `${scannedPayload || ''}::${scanSignal || ''}`;
        if (!scannedPayload || handledUpiPayloadRef.current === scanKey) return;

        handledUpiPayloadRef.current = scanKey;
        const extracted = extractUpiIdFromPayload(scannedPayload);
        if (!extracted) {
            dialog.alert('UPI', 'Scanned QR does not contain a valid UPI ID.');
            return;
        }

        setUpiId(extracted);
        dialog.alert('UPI', 'UPI ID captured from QR. Review and continue setup.');
    }, [dialog, params.scanAt, params.upiPayload]);

    const handleSelectCurrency = useCallback((nextCurrency: string) => {
        startUiTransition(() => {
            setSelectedCurrency(normalizeCurrencyCode(nextCurrency));
        });
    }, []);

    const handleSelectCategory = useCallback((nextCategory: string) => {
        startUiTransition(() => {
            setCategory(nextCategory);
        });
    }, []);

    const handleSave = useCallback(async () => {
        const validation = businessSetupSchema.safeParse({
            businessName,
            address,
            gst,
            category,
            currency,
        });
        if (!validation.success) {
            dialog.alert(COMMON_TEXT.alerts.validation, validation.error.issues[0]?.message || BUSINESS_SETUP_TEXT.requiredBusinessName);
            return;
        }
        const values = validation.data;
        const cashInHand = Number(cashInHandInput.replace(/[^0-9.]/g, '')) || 0;
        const cashAtBank = Number(cashAtBankInput.replace(/[^0-9.]/g, '')) || 0;
        const cashInApp = Number(cashInAppInput.replace(/[^0-9.]/g, '')) || 0;
        if (cashInHand < 0 || cashAtBank < 0 || cashInApp < 0) {
            dialog.alert(COMMON_TEXT.alerts.validation, 'Opening balances must be zero or positive.');
            return;
        }
        const normalizedUpiId = sanitizeUpiId(upiId);
        if (normalizedUpiId && !isValidUpiId(normalizedUpiId)) {
            dialog.alert(COMMON_TEXT.alerts.validation, 'Enter a valid UPI ID like merchant@bank.');
            return;
        }

        setLoading(true);
        try {
            const normalizedCurrency = normalizeCurrencyCode(values.currency);
            const updatedUser = await userService.updateCurrentUser({
                businessName: values.businessName.trim(),
                address: values.address?.trim() || undefined,
                gstNumber: values.gst?.trim().toUpperCase() || undefined,
                gstEnabled: !!values.gst?.trim(),
                currency: normalizedCurrency,
                category: values.category?.trim() || undefined,
            });

            setUser(updatedUser);
            setCurrency(normalizedCurrency);
            try {
                const baseSettings = asRecord(organizationSettings);
                const payment = asRecord(baseSettings.payment);
                const customization = asRecord(baseSettings.customization);
                const nextSettings = {
                    ...baseSettings,
                    payment: {
                        ...payment,
                        upiId: normalizedUpiId,
                        receiverName: upiReceiverName.trim()
                            || values.businessName.trim()
                            || user?.displayName
                            || '',
                    },
                    signatureImageUrl: signatureImageUrl || '',
                    openingBalances: {
                        cashInHand,
                        cashAtBank,
                        cashInApp,
                    },
                    customization: {
                        ...customization,
                        signatureImageUrl: signatureImageUrl || '',
                    },
                };
                const updatedSettings = await businessSuiteService.updateOrganizationSettings(
                    nextSettings,
                    selectedOrganizationId ?? undefined
                );
                setOrganizationSettings(updatedSettings);
            } catch (settingsError: unknown) {
                if (!isNetworkLikeError(settingsError)) {
                    dialog.alert(
                        COMMON_TEXT.alerts.error,
                        settingsError instanceof Error ? settingsError.message : 'Failed to save payment and signature settings.'
                    );
                }
            }
            router.replace('/(main)/(tabs)/home' as Href);
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert(
                    COMMON_TEXT.alerts.error,
                    error instanceof Error ? error.message : BUSINESS_SETUP_TEXT.saveFailed
                );
            }
        } finally {
            setLoading(false);
        }
    }, [
        address,
        businessName,
        category,
        currency,
        dialog,
        gst,
        organizationSettings,
        router,
        selectedOrganizationId,
        setCurrency,
        setOrganizationSettings,
        setUser,
        signatureImageUrl,
        cashAtBankInput,
        cashInAppInput,
        cashInHandInput,
        upiId,
        upiReceiverName,
        user?.displayName,
    ]);

    return (
        <ScreenWrapper>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={[
                        styles.container,
                        { paddingBottom: DesignSystem.layout.pageBottom },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title={BUSINESS_SETUP_TEXT.title}
                            subtitle={BUSINESS_SETUP_TEXT.subtitle}
                        />

                        <AppCard animationDelay={30} style={styles.statusCard}>
                            <View style={styles.statusRow}>
                                <Chip compact icon={isOffline ? 'wifi-off' : 'wifi'} mode="flat">
                                    {isOffline ? 'Offline mode' : 'Online'}
                                </Chip>
                                <Chip compact icon="store-outline" mode="flat">
                                    {category || 'Category not set'}
                                </Chip>
                            </View>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                {isOffline
                                    ? 'Changes are saved locally and sync automatically when connection returns.'
                                    : 'Changes sync instantly and are available across your devices.'}
                            </Text>
                        </AppCard>

                        <View style={[styles.grid, isWide && styles.gridWide]}>
                            <AppCard animationDelay={50} style={[styles.gridCard, isWide && styles.gridCardWide]}>
                                <Text variant="titleSmall" style={styles.sectionTitle}>
                                    Business Profile
                                </Text>
                                <AppInput
                                    label={BUSINESS_SETUP_TEXT.fields.businessName}
                                    value={businessName}
                                    onChangeText={setBusinessName}
                                    inputType="name"
                                    returnKeyType="next"
                                />

                                <AppInput
                                    label={BUSINESS_SETUP_TEXT.fields.businessAddress}
                                    value={address}
                                    onChangeText={setAddress}
                                    inputType="text"
                                    multiline
                                    numberOfLines={3}
                                    returnKeyType="done"
                                />

                                <AppInput
                                    label={BUSINESS_SETUP_TEXT.fields.gstNumber}
                                    value={gst}
                                    onChangeText={(value) => setGst(value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                                    inputType="text"
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    placeholder="27ABCDE1234F1Z5"
                                />
                            </AppCard>

                            <AppCard animationDelay={75} style={[styles.gridCard, isWide && styles.gridCardWide]}>
                                <Text variant="titleSmall" style={styles.sectionTitle}>
                                    Preferences
                                </Text>

                                <Text variant="labelMedium" style={styles.controlLabel}>
                                    {BUSINESS_SETUP_TEXT.fields.defaultCurrency}
                                </Text>
                                <View style={styles.chipWrap}>
                                    {supportedCurrencies.map((entry) => (
                                        <Chip
                                            key={entry.code}
                                            compact
                                            mode={entry.code === currency ? 'flat' : 'outlined'}
                                            selected={entry.code === currency}
                                            onPress={() => handleSelectCurrency(entry.code)}
                                        >
                                            {entry.code}
                                        </Chip>
                                    ))}
                                </View>

                                <Text variant="labelMedium" style={styles.controlLabel}>
                                    Business Category
                                </Text>
                                <View style={styles.chipWrap}>
                                    {CATEGORY_OPTIONS.map((entry) => (
                                        <Chip
                                            key={entry}
                                            compact
                                            mode={entry === category ? 'flat' : 'outlined'}
                                            selected={entry === category}
                                            onPress={() => handleSelectCategory(entry)}
                                        >
                                            {entry}
                                        </Chip>
                                    ))}
                                </View>
                            </AppCard>
                        </View>

                        <AppCard animationDelay={95}>
                            <Text variant="titleSmall" style={styles.sectionTitle}>
                                Payment & Signature (Optional)
                            </Text>
                            <Text variant="bodySmall" style={[styles.optionalHint, { color: theme.colors.onSurfaceVariant }]}>
                                Add UPI and signature now so your first bill can include QR payment and authorized sign.
                            </Text>
                            <AppInput
                                label="UPI ID"
                                value={upiId}
                                onChangeText={setUpiId}
                                inputType="upi"
                                placeholder="merchant@bank"
                            />
                            <AppInput
                                label="UPI Receiver Name"
                                value={upiReceiverName}
                                onChangeText={setUpiReceiverName}
                                inputType="name"
                                placeholder="Business or owner name"
                            />
                            <View style={styles.actionRow}>
                                <AppButton
                                    mode="outlined"
                                    onPress={() => router.push({
                                        pathname: '/scan',
                                        params: { target: 'upi', returnPath: '/business-setup' },
                                    })}
                                    style={styles.flexActionButton}
                                >
                                    Scan UPI QR
                                </AppButton>
                            </View>

                            <Text variant="labelMedium" style={styles.openingBalanceTitle}>
                                Opening Balances (Optional)
                            </Text>
                            <View style={styles.openingBalanceRow}>
                                <AppInput
                                    label="Cash in Hand"
                                    value={cashInHandInput}
                                    onChangeText={(value) => setCashInHandInput(value.replace(/[^0-9.]/g, ''))}
                                    inputType="decimal"
                                    style={styles.openingBalanceInput}
                                />
                                <AppInput
                                    label="Cash at Bank"
                                    value={cashAtBankInput}
                                    onChangeText={(value) => setCashAtBankInput(value.replace(/[^0-9.]/g, ''))}
                                    inputType="decimal"
                                    style={styles.openingBalanceInput}
                                />
                            </View>
                            <AppInput
                                label="Cash in UPI/App"
                                value={cashInAppInput}
                                onChangeText={(value) => setCashInAppInput(value.replace(/[^0-9.]/g, ''))}
                                inputType="decimal"
                            />

                            {signatureImageUrl ? (
                                <Image
                                    source={{ uri: signatureImageUrl }}
                                    style={[
                                        styles.signaturePreview,
                                        {
                                            borderColor: theme.colors.outlineVariant,
                                            backgroundColor: theme.colors.surfaceVariant,
                                        },
                                    ]}
                                />
                            ) : (
                                <View style={[styles.signaturePlaceholder, { borderColor: theme.colors.outline }]}>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        No signature captured yet.
                                    </Text>
                                </View>
                            )}

                            <View style={styles.actionRow}>
                                <AppButton
                                    mode="contained-tonal"
                                    onPress={() => setSignatureModalVisible(true)}
                                    style={styles.flexActionButton}
                                >
                                    Capture Signature
                                </AppButton>
                                {signatureImageUrl ? (
                                    <AppButton
                                        mode="outlined"
                                        onPress={() => setSignatureImageUrl('')}
                                        style={styles.flexActionButton}
                                    >
                                        Clear
                                    </AppButton>
                                ) : null}
                            </View>
                        </AppCard>

                        <AppButton
                            mode="contained"
                            onPress={() => {
                                void handleSave();
                            }}
                            loading={loading}
                            disabled={!canSave || isUiPending}
                            style={styles.button}
                        >
                            {BUSINESS_SETUP_TEXT.actions.startBilling}
                        </AppButton>
                        <Text variant="bodySmall" style={[styles.note, { color: theme.colors.outline }]}>
                            You can update these details later from Profile and Settings.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <SignatureCaptureModal
                visible={signatureModalVisible}
                onClose={() => setSignatureModalVisible(false)}
                onSave={(dataUrl) => {
                    setSignatureModalVisible(false);
                    setSignatureImageUrl(dataUrl);
                }}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        paddingTop: DesignSystem.layout.pageTop,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        gap: DesignSystem.layout.sectionGap,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    statusCard: {
        marginBottom: 0,
    },
    statusRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.xs,
    },
    grid: {
        gap: DesignSystem.spacing.sm,
    },
    gridWide: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gridCard: {
        marginBottom: 0,
    },
    gridCardWide: {
        width: '49%',
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.xs,
    },
    controlLabel: {
        marginBottom: DesignSystem.spacing.xs,
        marginTop: DesignSystem.spacing.xs,
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.xs,
    },
    optionalHint: {
        marginBottom: DesignSystem.spacing.sm,
    },
    openingBalanceTitle: {
        marginTop: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.xs,
    },
    openingBalanceRow: {
        flexDirection: 'row',
        gap: DesignSystem.spacing.xs,
    },
    openingBalanceInput: {
        flex: 1,
    },
    actionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
        marginTop: DesignSystem.spacing.xs,
    },
    flexActionButton: {
        flexGrow: 1,
    },
    signaturePreview: {
        width: '100%',
        height: 120,
        borderRadius: DesignSystem.radius.sm,
        borderWidth: 1,
        resizeMode: 'contain',
        marginTop: DesignSystem.spacing.xs,
    },
    signaturePlaceholder: {
        width: '100%',
        height: 96,
        borderWidth: 1,
        borderRadius: DesignSystem.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: DesignSystem.spacing.xs,
    },
    button: {
        marginTop: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.xs,
    },
    note: {
        textAlign: 'center',
    },
});
