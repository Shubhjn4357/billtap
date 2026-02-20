import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { Chip, Text, useTheme } from 'react-native-paper';
import { userService } from '../../api/userService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { DesignSystem } from '../../constants/DesignSystem';
import { useNetworkStore, useUserStore } from '../../store';
import { isNetworkLikeError } from '../../utils/errorGuards';
import { useAuth } from '../../hooks/useAuth';
import { PhoneNumberInput } from '../../components/forms/PhoneNumberInput';
import { OtpInput } from '../../components/forms/OtpInput';
import { DEFAULT_COUNTRY_DIAL_CODE } from '../../constants/countryDialCodes';
import { buildE164PhoneNumber, sanitizePhoneLocal } from '../../utils/phone';

export default function PhoneSetupScreen() {
    const { setUser } = useUserStore();
    const { sendPhoneVerification } = useAuth();
    const { isConnected, isInternetReachable } = useNetworkStore();
    const router = useRouter();
    const theme = useTheme();
    const dialog = useAppDialog();
    const { width } = useWindowDimensions();

    const [phoneDialCode, setPhoneDialCode] = useState(DEFAULT_COUNTRY_DIAL_CODE);
    const [phoneInput, setPhoneInput] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [linkingPhone, setLinkingPhone] = useState(false);

    const isOffline = isConnected === false || isInternetReachable === false;
    const isWide = width >= 980;

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
            // After successfully linking, route to dashboard.
            // (If businessName is somehow still missing, layout will redirect to business-setup automatically)
            router.replace('/(main)/(tabs)/home' as Href);
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Phone Link', error instanceof Error ? error.message : 'Failed to link phone number.');
            }
        } finally {
            setLinkingPhone(false);
        }
    }, [dialog, isOffline, router, setUser, verificationCode, verificationId]);

    return (
        <ScreenWrapper>
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
                        title="Link Phone Number"
                        subtitle="A verified phone number is required to proceed."
                    />

                    <AppCard animationDelay={30} style={styles.statusCard}>
                        <View style={styles.statusRow}>
                            <Chip compact icon={isOffline ? 'wifi-off' : 'wifi'} mode="flat">
                                {isOffline ? 'Offline mode' : 'Online'}
                            </Chip>
                        </View>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            We use your phone number for bill sharing and SMS notifications.
                        </Text>
                    </AppCard>

                    <AppCard animationDelay={50} style={styles.gridCard}>
                        <Text variant="titleSmall" style={styles.sectionTitle}>
                            Mobile Number
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
                            disabled={sendingOtp || isOffline || phoneInput.length < 7}
                        >
                            {verificationId ? 'Resend OTP' : 'Send OTP'}
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
                                    Verify and Continue
                                </AppButton>
                            </View>
                        ) : null}
                    </AppCard>

                </View>
            </ScrollView>
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
    gridCard: {
        marginBottom: 0,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.xs,
    },
    verifySection: {
        marginTop: DesignSystem.spacing.md,
    },
});
