import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Chip, Text, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { OtpInput } from '../../components/forms/OtpInput';
import { PhoneNumberInput } from '../../components/forms/PhoneNumberInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SignatureCaptureModal } from '../../components/signature/SignatureCaptureModal';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { DEFAULT_COUNTRY_DIAL_CODE } from '../../constants/countryDialCodes';
import { DesignSystem } from '../../constants/DesignSystem';
import { useAuth } from '../../hooks/useAuth';
import { useNetworkStore, useOrganizationStore, useUserStore } from '../../store';
import { businessSuiteService } from '../../api/businessSuiteService';
import { userService } from '../../api/userService';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { buildE164PhoneNumber, sanitizePhoneLocal, splitPhoneNumber } from '../../utils/phone';
import { extractUpiIdFromPayload, sanitizeUpiId } from '../../utils/upi';
import { profileSchema, upiSettingsSchema } from '../../validation/forms';

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

export const ProfileSetupScreen = () => {
    const dialog = useAppDialog();
    const { user, sendPhoneVerification } = useAuth();
    const router = useRouter();
    const params = useLocalSearchParams<{ upiPayload?: string | string[] }>();
    const { setUser } = useUserStore();
    const { isConnected, isInternetReachable } = useNetworkStore();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const organizationSettings = useOrganizationStore((state) => state.context.settings);
    const setOrganizationSettings = useOrganizationStore((state) => state.setOrganizationSettings);
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const [isUiPending, startUiTransition] = useTransition();

    const isOffline = isConnected === false || isInternetReachable === false;
    const isWide = width >= 980;

    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [address, setAddress] = useState('');

    const [phoneDialCode, setPhoneDialCode] = useState(DEFAULT_COUNTRY_DIAL_CODE);
    const [phoneInput, setPhoneInput] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [verificationCode, setVerificationCode] = useState('');

    const [savingProfile, setSavingProfile] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [linkingPhone, setLinkingPhone] = useState(false);
    const [signatureModalVisible, setSignatureModalVisible] = useState(false);
    const [signatureImageUrl, setSignatureImageUrl] = useState('');
    const [savingSignature, setSavingSignature] = useState(false);
    const [upiId, setUpiId] = useState('');
    const [upiReceiverName, setUpiReceiverName] = useState('');
    const [savingUpi, setSavingUpi] = useState(false);
    const handledUpiPayloadRef = useRef('');

    useEffect(() => {
        setDisplayName(user?.displayName ?? '');
        setEmail(user?.email ?? '');
        setBusinessName(user?.businessName ?? '');
        setAddress(user?.address ?? '');
        const split = splitPhoneNumber(user?.phoneNumber ?? '');
        setPhoneDialCode(split.dialCode);
        setPhoneInput(split.localNumber);
    }, [user?.address, user?.businessName, user?.displayName, user?.email, user?.phoneNumber]);

    useEffect(() => {
        const settings = asRecord(organizationSettings);
        const customization = asRecord(settings.customization);
        const payment = asRecord(settings.payment);
        const nextSignature = typeof settings.signatureImageUrl === 'string'
            ? settings.signatureImageUrl
            : (typeof customization.signatureImageUrl === 'string' ? customization.signatureImageUrl : '');
        const nextUpiId = typeof payment.upiId === 'string' ? sanitizeUpiId(payment.upiId) : '';
        const nextReceiverName = typeof payment.receiverName === 'string'
            ? payment.receiverName
            : (user?.businessName ?? user?.displayName ?? '');
        setSignatureImageUrl(nextSignature);
        setUpiId(nextUpiId);
        setUpiReceiverName(nextReceiverName);
    }, [organizationSettings, user?.businessName, user?.displayName]);

    useEffect(() => {
        const scannedPayload = Array.isArray(params.upiPayload) ? params.upiPayload[0] : params.upiPayload;
        if (!scannedPayload || handledUpiPayloadRef.current === scannedPayload) return;

        handledUpiPayloadRef.current = scannedPayload;
        const extracted = extractUpiIdFromPayload(scannedPayload);
        if (!extracted) {
            dialog.alert('UPI', 'Scanned QR does not contain a valid UPI ID.');
            return;
        }

        setUpiId(extracted);
        dialog.alert('UPI', 'UPI ID captured from QR. Tap "Save UPI Details" to apply.');
    }, [dialog, params.upiPayload]);

    const profileSubtitle = useMemo(
        () => user?.email || user?.phoneNumber || 'Complete your profile and contact details',
        [user?.email, user?.phoneNumber]
    );

    const handleSaveProfile = useCallback(async () => {
        if (!user) {
            dialog.alert('Profile', 'You must be logged in.');
            return;
        }

        const validation = profileSchema.safeParse({
            displayName,
            email,
            businessName,
            address,
        });
        if (!validation.success) {
            dialog.alert('Profile', validation.error.issues[0]?.message || 'Please check profile details.');
            return;
        }

        const values = validation.data;
        setSavingProfile(true);
        try {
            const updatedUser = await userService.updateCurrentUser({
                displayName: values.displayName.trim() || null,
                email: values.email?.trim() ? values.email.trim() : null,
                businessName: values.businessName?.trim() || undefined,
                address: values.address?.trim() || undefined,
            });
            setUser(updatedUser);
            dialog.alert('Profile', 'Profile updated successfully.');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Profile', error instanceof Error ? error.message : 'Failed to update profile.');
            }
        } finally {
            setSavingProfile(false);
        }
    }, [address, businessName, dialog, displayName, email, setUser, user]);

    const handleSaveUpiDetails = useCallback(async () => {
        const validation = upiSettingsSchema.safeParse({
            upiId,
            receiverName: upiReceiverName,
        });
        if (!validation.success) {
            dialog.alert('UPI', validation.error.issues[0]?.message || 'Enter valid UPI details.');
            return;
        }

        setSavingUpi(true);
        try {
            const values = validation.data;
            const baseSettings = asRecord(organizationSettings);
            const payment = asRecord(baseSettings.payment);
            const nextSettings = {
                ...baseSettings,
                payment: {
                    ...payment,
                    upiId: sanitizeUpiId(values.upiId),
                    receiverName: values.receiverName?.trim()
                        || businessName.trim()
                        || user?.displayName
                        || user?.businessName
                        || '',
                },
            };
            const updatedSettings = await businessSuiteService.updateOrganizationSettings(
                nextSettings,
                selectedOrganizationId ?? undefined
            );
            setOrganizationSettings(updatedSettings);
            dialog.alert('UPI', 'UPI profile updated successfully.');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('UPI', error instanceof Error ? error.message : 'Failed to update UPI profile.');
            }
        } finally {
            setSavingUpi(false);
        }
    }, [
        businessName,
        dialog,
        organizationSettings,
        selectedOrganizationId,
        setOrganizationSettings,
        upiId,
        upiReceiverName,
        user?.businessName,
        user?.displayName,
    ]);

    const handleSendOtp = useCallback(async () => {
        if (isOffline) {
            dialog.alert('Phone Link', 'Phone verification requires internet connection.');
            return;
        }

        const normalizedPhone = buildE164PhoneNumber(phoneDialCode, phoneInput);
        if (!normalizedPhone || normalizedPhone.length < 8) {
            dialog.alert('Phone Link', 'Enter a valid phone number with country code.');
            return;
        }

        setSendingOtp(true);
        try {
            const session = await sendPhoneVerification(normalizedPhone);
            setVerificationId(session.verificationId);
            const message = session.testCode
                ? `OTP sent.\n\nTest OTP: ${session.testCode}`
                : 'OTP sent successfully.';
            dialog.alert('Phone Link', message);
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Phone Link', error instanceof Error ? error.message : 'Failed to send OTP.');
            }
        } finally {
            setSendingOtp(false);
        }
    }, [dialog, isOffline, phoneDialCode, phoneInput, sendPhoneVerification]);

    const handleVerifyAndLink = useCallback(async () => {
        if (isOffline) {
            dialog.alert('Phone Link', 'Phone verification requires internet connection.');
            return;
        }
        if (!verificationId) {
            dialog.alert('Phone Link', 'Send OTP first.');
            return;
        }

        const normalizedCode = verificationCode.replace(/\D/g, '');
        if (normalizedCode.length !== 6) {
            dialog.alert('Phone Link', 'Enter the 6-digit OTP.');
            return;
        }

        setLinkingPhone(true);
        try {
            const updatedUser = await userService.linkPhoneNumber(verificationId, normalizedCode);
            setUser(updatedUser);
            setVerificationId('');
            setVerificationCode('');
            startUiTransition(() => {
                const split = splitPhoneNumber(updatedUser.phoneNumber ?? '');
                setPhoneDialCode(split.dialCode);
                setPhoneInput(split.localNumber);
            });
            dialog.alert('Phone Link', 'Phone number linked successfully.');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Phone Link', error instanceof Error ? error.message : 'Failed to link phone number.');
            }
        } finally {
            setLinkingPhone(false);
        }
    }, [dialog, isOffline, setUser, verificationCode, verificationId]);

    const handleSaveSignature = useCallback(async (dataUrl: string) => {
        if (!dataUrl) return;

        setSignatureModalVisible(false);
        setSavingSignature(true);
        setSignatureImageUrl(dataUrl);

        try {
            const signatureName = `${displayName.trim() || businessName.trim() || 'Owner'} Signature`;
            const signatureId = await businessSuiteService.createSignature(
                {
                    name: signatureName,
                    signatureData: dataUrl,
                    isDefault: true,
                },
                selectedOrganizationId ?? undefined
            );
            await businessSuiteService.setDefaultSignature(signatureId, selectedOrganizationId ?? undefined);

            const baseSettings = asRecord(organizationSettings);
            const customization = asRecord(baseSettings.customization);
            const nextSettings = {
                ...baseSettings,
                signatureImageUrl: dataUrl,
                customization: {
                    ...customization,
                    signatureImageUrl: dataUrl,
                },
            };
            const updatedSettings = await businessSuiteService.updateOrganizationSettings(
                nextSettings,
                selectedOrganizationId ?? undefined
            );
            setOrganizationSettings(updatedSettings);
            dialog.alert('Signature', 'Signature saved and set as default for billing.');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Signature', error instanceof Error ? error.message : 'Failed to save signature.');
            }
        } finally {
            setSavingSignature(false);
        }
    }, [
        businessName,
        dialog,
        displayName,
        organizationSettings,
        selectedOrganizationId,
        setOrganizationSettings,
    ]);

    const handleClearSignature = useCallback(async () => {
        setSavingSignature(true);
        try {
            const baseSettings = asRecord(organizationSettings);
            const customization = asRecord(baseSettings.customization);
            const nextSettings = {
                ...baseSettings,
                signatureImageUrl: '',
                customization: {
                    ...customization,
                    signatureImageUrl: '',
                },
            };
            const updatedSettings = await businessSuiteService.updateOrganizationSettings(
                nextSettings,
                selectedOrganizationId ?? undefined
            );
            setOrganizationSettings(updatedSettings);
            setSignatureImageUrl('');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Signature', error instanceof Error ? error.message : 'Failed to clear signature.');
            }
        } finally {
            setSavingSignature(false);
        }
    }, [dialog, organizationSettings, selectedOrganizationId, setOrganizationSettings]);

    if (!user) {
        return (
            <ScreenWrapper>
                <AppCard animationDelay={40}>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                        Login required
                    </Text>
                    <Text variant="bodySmall" style={{ marginTop: 6, color: theme.colors.outline }}>
                        Please sign in to update profile details.
                    </Text>
                </AppCard>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: DesignSystem.layout.pageBottom }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                <PageHeaderCard
                    title="Profile Setup"
                    subtitle={profileSubtitle}
                />

                <AppCard animationDelay={30} style={styles.statusCard}>
                    <View style={styles.statusRow}>
                        <Chip compact icon={isOffline ? 'wifi-off' : 'wifi'}>
                            {isOffline ? 'Offline mode' : 'Online'}
                        </Chip>
                        <Chip compact icon="account-badge-outline">
                            Role: {user?.role ?? 'owner'}
                        </Chip>
                        <Chip compact icon="cellphone-link-off">
                            {user?.phoneNumber ? 'Phone linked' : 'Phone not linked'}
                        </Chip>
                    </View>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {isOffline
                            ? 'Profile edits are queued and synced automatically when internet returns.'
                            : 'Keep your profile up to date for bill headers, card templates and notifications.'}
                    </Text>
                </AppCard>

                <View style={[styles.grid, isWide && styles.gridWide]}>
                    <AppCard animationDelay={50} style={[styles.gridCard, isWide && styles.gridCardWide]}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Account Profile
                        </Text>
                        <AppInput
                            label="Display Name"
                            value={displayName}
                            onChangeText={setDisplayName}
                            inputType="name"
                            placeholder="Your name"
                        />
                        <AppInput
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            inputType="email"
                            placeholder="name@example.com"
                        />
                        <AppInput
                            label="Business Name"
                            value={businessName}
                            onChangeText={setBusinessName}
                            inputType="name"
                            placeholder="Business name"
                        />
                        <AppInput
                            label="Address"
                            value={address}
                            onChangeText={setAddress}
                            inputType="text"
                            placeholder="Business address"
                            multiline
                            numberOfLines={2}
                        />
                        <AppButton
                            mode="contained"
                            onPress={() => {
                                void handleSaveProfile();
                            }}
                            loading={savingProfile}
                            disabled={isUiPending || savingProfile}
                        >
                            Save Profile
                        </AppButton>
                    </AppCard>

                    <AppCard animationDelay={75} style={[styles.gridCard, isWide && styles.gridCardWide]}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Mobile Number Linking
                        </Text>
                        <Text variant="bodySmall" style={styles.helperText}>
                            Current linked phone: {user?.phoneNumber || 'Not linked'}
                        </Text>
                        <PhoneNumberInput
                            label="Mobile Number"
                            dialCode={phoneDialCode}
                            onDialCodeChange={setPhoneDialCode}
                            phoneNumber={phoneInput}
                            onPhoneNumberChange={(next) => setPhoneInput(sanitizePhoneLocal(next))}
                            placeholder="9876543210"
                        />
                        <AppButton
                            mode="outlined"
                            onPress={() => {
                                void handleSendOtp();
                            }}
                            loading={sendingOtp}
                            disabled={sendingOtp || isOffline}
                        >
                            Send OTP
                        </AppButton>

                        {verificationId ? (
                            <View style={styles.verifySection}>
                                <OtpInput
                                    label="Verification Code"
                                    value={verificationCode}
                                    onChange={setVerificationCode}
                                />
                                <AppButton
                                    mode="contained-tonal"
                                    onPress={() => {
                                        void handleVerifyAndLink();
                                    }}
                                    loading={linkingPhone}
                                    disabled={linkingPhone || verificationCode.replace(/\D/g, '').length !== 6 || isOffline}
                                >
                                    Verify and Link
                                </AppButton>
                            </View>
                        ) : null}
                    </AppCard>
                </View>

                <AppCard animationDelay={95}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        UPI Payment Profile
                    </Text>
                    <Text variant="bodySmall" style={styles.helperText}>
                        This UPI ID is used to generate QR with exact bill amount after checkout.
                    </Text>
                    <AppInput
                        label="UPI ID"
                        value={upiId}
                        onChangeText={setUpiId}
                        inputType="upi"
                        placeholder="merchant@bank"
                    />
                    <AppInput
                        label="Receiver Name"
                        value={upiReceiverName}
                        onChangeText={setUpiReceiverName}
                        inputType="name"
                        placeholder="Store or Owner name"
                    />
                    <View style={styles.signatureActionRow}>
                        <AppButton
                            mode="outlined"
                            onPress={() => router.push({ pathname: '/scan', params: { target: 'upi', returnPath: '/profile' } })}
                            style={styles.signatureActionButton}
                        >
                            Scan UPI QR
                        </AppButton>
                        <AppButton
                            mode="contained"
                            onPress={() => { void handleSaveUpiDetails(); }}
                            loading={savingUpi}
                            disabled={savingUpi}
                            style={styles.signatureActionButton}
                        >
                            Save UPI Details
                        </AppButton>
                    </View>
                </AppCard>

                <AppCard animationDelay={95}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Billing Signature
                    </Text>
                    <Text variant="bodySmall" style={styles.helperText}>
                        Signature is printed automatically on A4 invoices and shared PDFs.
                    </Text>
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
                                No signature saved yet.
                            </Text>
                        </View>
                    )}
                    <View style={styles.signatureActionRow}>
                        <AppButton
                            mode="contained"
                            onPress={() => setSignatureModalVisible(true)}
                            loading={savingSignature}
                            disabled={savingSignature}
                            style={styles.signatureActionButton}
                        >
                            Capture Signature
                        </AppButton>
                        {signatureImageUrl ? (
                            <AppButton
                                mode="outlined"
                                onPress={() => { void handleClearSignature(); }}
                                loading={savingSignature}
                                disabled={savingSignature}
                                style={styles.signatureActionButton}
                            >
                                Clear
                            </AppButton>
                        ) : null}
                    </View>
                </AppCard>
                </View>
            </ScrollView>
            <SignatureCaptureModal
                visible={signatureModalVisible}
                onClose={() => setSignatureModalVisible(false)}
                onSave={(dataUrl) => { void handleSaveSignature(dataUrl); }}
            />
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
    sectionTitle: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.xs,
    },
    helperText: {
        marginBottom: DesignSystem.spacing.sm,
        opacity: 0.8,
    },
    verifySection: {
        marginTop: DesignSystem.spacing.xs,
    },
    signaturePreview: {
        width: '100%',
        height: 120,
        borderRadius: DesignSystem.radius.sm,
        borderWidth: 1,
        resizeMode: 'contain',
    },
    signaturePlaceholder: {
        width: '100%',
        height: 96,
        borderWidth: 1,
        borderRadius: DesignSystem.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: DesignSystem.spacing.xs,
    },
    signatureActionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
        marginTop: DesignSystem.spacing.xs,
    },
    signatureActionButton: {
        flexGrow: 1,
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
});
