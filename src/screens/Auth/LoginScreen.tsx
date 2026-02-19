import React, { useEffect, useRef, useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import { MotionView } from '../../components/motion/Motion';
import { ActivityIndicator, Divider, Text, useTheme, type MD3Theme } from 'react-native-paper';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { OtpInput } from '../../components/forms/OtpInput';
import { PhoneNumberInput } from '../../components/forms/PhoneNumberInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DEFAULT_COUNTRY_DIAL_CODE } from '../../constants/countryDialCodes';
import { DesignSystem } from '../../constants/DesignSystem';
import { AUTH_TEXT, COMMON_TEXT } from '../../constants/staticText';
import { useAuth } from '../../hooks/useAuth';
import {
    configureNativeGoogleSignIn,
    getNativeGoogleErrorMessage,
    signInWithNativeGoogle,
} from '../../utils/googleNativeSignIn';
import { useWebGoogleAuth } from '../../utils/googleWebAuth';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { buildE164PhoneNumber, sanitizePhoneLocal } from '../../utils/phone';

const LOGIN_CAPABILITY_BADGES = ['GST + Estimate', 'Offline Safe', 'Multi-Store'] as const;

export const LoginScreen = () => {
    const { signInWithGoogle, sendPhoneVerification, confirmPhoneVerification, loading: authLoading } = useAuth();
    const [countryDialCode, setCountryDialCode] = useState(DEFAULT_COUNTRY_DIAL_CODE);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [phoneMode, setPhoneMode] = useState(false);
    const [androidNativeGoogleReady, setAndroidNativeGoogleReady] = useState(Platform.OS !== 'android');
    const googleSignInInFlightRef = useRef(false);
    const sendOtpInFlightRef = useRef(false);
    const verifyOtpInFlightRef = useRef(false);

    const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    const {
        requestReady: webGoogleRequestReady,
        idToken: webGoogleIdToken,
        prompt: promptWebGoogle,
    } = useWebGoogleAuth({
        webClientId: googleWebClientId,
        androidClientId: googleAndroidClientId,
        iosClientId: googleIosClientId,
    });

    const theme = useTheme();
    const styles = createStyles(theme);
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const isBusy = loading || authLoading;
    const isOtpStep = verificationId.length > 0;

    const useNativeGoogleOnAndroid = Platform.OS === 'android';
    const googleConfigured = useNativeGoogleOnAndroid
        ? !!googleWebClientId && androidNativeGoogleReady
        : Platform.select({
            web: !!googleWebClientId && webGoogleRequestReady,
            android: false,
            ios: (!!googleIosClientId || !!googleWebClientId) && webGoogleRequestReady,
            default: false,
        });
    const googleButtonDisabled = isBusy || !googleConfigured;

    useEffect(() => {
        if (!useNativeGoogleOnAndroid) return;

        setAndroidNativeGoogleReady(false);
        configureNativeGoogleSignIn({
            webClientId: googleWebClientId,
            androidClientId: googleAndroidClientId,
        })
            .then(() => setAndroidNativeGoogleReady(true))
            .catch(() => setAndroidNativeGoogleReady(false));
    }, [useNativeGoogleOnAndroid, googleWebClientId, googleAndroidClientId]);

    const dialog = useAppDialog();

    useEffect(() => {
        if (useNativeGoogleOnAndroid) return;
        if (!webGoogleIdToken) return;

        signInWithGoogle(webGoogleIdToken).catch((e: unknown) =>
            dialog.alert(
                AUTH_TEXT.login.loginErrorTitle,
                e instanceof Error ? e.message : AUTH_TEXT.login.unableToVerifyCode
            )
        );
    }, [webGoogleIdToken, signInWithGoogle, useNativeGoogleOnAndroid, dialog]);

    const handleBackToMethodSelection = () => {
        setPhoneMode(false);
        setVerificationId('');
        setVerificationCode('');
    };

    const handleGoogleSignIn = () => {
        if (!googleConfigured) {
            dialog.alert(
                AUTH_TEXT.login.googleSignInNotConfiguredTitle,
                AUTH_TEXT.login.googleSignInNotConfiguredBody
            );
            return;
        }
        if (isBusy || googleSignInInFlightRef.current) return;

        if (useNativeGoogleOnAndroid) {
            googleSignInInFlightRef.current = true;
            setLoading(true);

            // Separate async function to isolate errors
            (async () => {
                let idToken: string;
                try {
                    const result = await signInWithNativeGoogle();
                    idToken = result.idToken;
                } catch (error: unknown) {
                    dialog.alert(AUTH_TEXT.login.loginErrorTitle, getNativeGoogleErrorMessage(error));
                    setLoading(false);
                    googleSignInInFlightRef.current = false;
                    return;
                }

                try {
                    const user = await signInWithGoogle(idToken);

                    // Unified Auth: If user doesn't have a phone number, prompt for it
                    if (!user.phoneNumber) {
                        dialog.alert(
                            'Add Phone Number',
                            'Please link your phone number to complete your profile.',
                            [{ text: 'OK', onPress: () => setPhoneMode(true) }]
                        );
                    }
                } catch (error: unknown) {
                    dialog.alert(AUTH_TEXT.login.loginErrorTitle, error instanceof Error ? error.message : 'API Error');
                } finally {
                    setLoading(false);
                    googleSignInInFlightRef.current = false;
                }
            })();

            return;
        }

        promptWebGoogle();
    };

    const handleSendVerification = async () => {
        if (isBusy || sendOtpInFlightRef.current) return;
        if (!phoneNumber) return dialog.alert(COMMON_TEXT.alerts.error, AUTH_TEXT.login.enterPhoneNumber);
        sendOtpInFlightRef.current = true;
        setLoading(true);
        try {
            const formattedPhone = buildE164PhoneNumber(countryDialCode, phoneNumber);
            if (!formattedPhone || formattedPhone.length < 8) {
                dialog.alert(COMMON_TEXT.alerts.error, AUTH_TEXT.login.enterPhoneNumber);
                return;
            }
            const session = await sendPhoneVerification(formattedPhone);
            setVerificationId(session.verificationId);
            const otpMessage = session.testCode
                ? `${AUTH_TEXT.login.otpSent}\n\nTest OTP: ${session.testCode}`
                : AUTH_TEXT.login.otpSent;
            dialog.alert(COMMON_TEXT.alerts.success, otpMessage);
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : AUTH_TEXT.login.unableToSendOtp);
        } finally {
            setLoading(false);
            sendOtpInFlightRef.current = false;
        }
    };

    const handleConfirmVerification = async () => {
        if (isBusy || verifyOtpInFlightRef.current) return;
        if (!verificationId) return dialog.alert(COMMON_TEXT.alerts.error, AUTH_TEXT.login.unableToSendOtp);
        const normalizedCode = verificationCode.replace(/\D/g, '');
        if (normalizedCode.length !== 6) return dialog.alert(COMMON_TEXT.alerts.error, AUTH_TEXT.login.enterCode);
        verifyOtpInFlightRef.current = true;
        setLoading(true);
        try {
            await confirmPhoneVerification(verificationId, normalizedCode);
            setVerificationCode('');
            setVerificationId('');
            setPhoneMode(false);
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : AUTH_TEXT.login.unableToVerifyCode);
        } finally {
            setLoading(false);
            verifyOtpInFlightRef.current = false;
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.container}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title={AUTH_TEXT.login.title}
                            subtitle={AUTH_TEXT.login.subtitle}
                        />

                        <MotionView
                            from={{ opacity: 0, translateY: 12 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ type: 'timing', duration: 260 }}
                        >
                            <AppCard disableMotion style={styles.heroPanel}>
                                <View style={styles.brandRow}>
                                    <View
                                        style={[
                                            styles.logoFrame,
                                            {
                                                backgroundColor: theme.colors.surface,
                                                borderColor: theme.colors.primary,
                                            },
                                        ]}
                                    >
                                        <Image source={require('../../../assets/images/icon.png')} style={styles.logo} />
                                    </View>
                                    <View style={styles.brandTextWrap}>
                                        <Text variant="labelLarge" style={[styles.brandLabel, { color: theme.colors.primary }]}>
                                                Vahi OS 2026
                                        </Text>
                                        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
                                            Secure Sign-In
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.capabilityRow}>
                                    {LOGIN_CAPABILITY_BADGES.map((badge) => (
                                        <View
                                            key={badge}
                                        style={[
                                            styles.capabilityBadge,
                                            {
                                                backgroundColor: theme.colors.surfaceVariant,
                                                borderColor: theme.colors.outlineVariant,
                                            },
                                        ]}
                                    >
                                            <Text variant="labelSmall" style={{ color: theme.colors.onSurface }}>
                                                {badge}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </AppCard>
                        </MotionView>

                        <MotionView
                            from={{ opacity: 0, translateY: 18, scale: 0.98 }}
                            animate={{ opacity: 1, translateY: 0, scale: 1 }}
                            transition={{ type: 'timing', duration: 280, delay: 80 }}
                        >
                            <AppCard
                                disableMotion
                                style={[
                                    styles.authCard,
                                    {
                                        backgroundColor: theme.colors.surface,
                                        borderColor: theme.colors.outlineVariant,
                                    },
                                ]}
                            >
                            <View style={styles.modeRow}>
                                <View
                                    style={[
                                        styles.modeChip,
                                        {
                                            backgroundColor: theme.colors.primaryContainer,
                                            borderColor: theme.colors.primary,
                                        },
                                    ]}
                                >
                                    <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                                        {phoneMode ? (isOtpStep ? 'Phone OTP' : 'Phone Login') : 'Google Login'}
                                    </Text>
                                </View>
                                {phoneMode && (
                                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {isOtpStep ? 'Verification code step' : 'Phone number step'}
                                    </Text>
                                )}
                            </View>
                            {phoneMode ? (
                                <>
                                    <View
                                        style={[
                                            styles.stepBadge,
                                            { backgroundColor: theme.colors.primaryContainer },
                                        ]}
                                    >
                                        <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                                            {isOtpStep ? 'Step 2 of 2' : 'Step 1 of 2'}
                                        </Text>
                                    </View>

                                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 6 }}>
                                        {isOtpStep ? AUTH_TEXT.login.verificationCodeLabel : AUTH_TEXT.login.phoneNumberLabel}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
                                        {isOtpStep
                                            ? 'Enter the 6-digit code sent to your number.'
                                            : 'Use your country code. Example: +1 555 123 4567'}
                                    </Text>

                                    {!isOtpStep ? (
                                        <>
                                            <PhoneNumberInput
                                                dialCode={countryDialCode}
                                                onDialCodeChange={setCountryDialCode}
                                                phoneNumber={phoneNumber}
                                                onPhoneNumberChange={(next) => setPhoneNumber(sanitizePhoneLocal(next))}
                                                label={AUTH_TEXT.login.phoneNumberLabel}
                                                placeholder="9876543210"
                                            />
                                            <AppButton
                                                mode="contained"
                                                icon="message-text-outline"
                                                onPress={handleSendVerification}
                                                loading={loading}
                                                disabled={isBusy}
                                                contentStyle={styles.primaryButtonContent}
                                            >
                                                {AUTH_TEXT.login.sendCodeButton}
                                            </AppButton>
                                        </>
                                    ) : (
                                        <>
                                            <OtpInput
                                                value={verificationCode}
                                                onChange={setVerificationCode}
                                                label={AUTH_TEXT.login.verificationCodeLabel}
                                            />
                                            <AppButton
                                                mode="contained"
                                                icon="check-circle-outline"
                                                onPress={handleConfirmVerification}
                                                loading={loading}
                                                disabled={isBusy || verificationCode.replace(/\D/g, '').length !== 6}
                                                contentStyle={styles.primaryButtonContent}
                                            >
                                                {AUTH_TEXT.login.verifyCodeButton}
                                            </AppButton>
                                        </>
                                    )}

                                    <View style={styles.footerRow}>
                                        <AppButton
                                            mode="text"
                                            onPress={handleBackToMethodSelection}
                                            disabled={isBusy}
                                        >
                                            {COMMON_TEXT.actions.back}
                                        </AppButton>
                                        {isOtpStep && (
                                            <ResendTimer onResend={handleSendVerification} disabled={isBusy} />
                                        )}
                                    </View>
                                </>
                            ) : (
                                <>
                                    <AppButton
                                        mode="outlined"
                                        icon="google"
                                        onPress={handleGoogleSignIn}
                                        disabled={googleButtonDisabled}
                                        contentStyle={styles.primaryButtonContent}
                                    >
                                        {AUTH_TEXT.login.signInWithGoogleButton}
                                    </AppButton>

                                    <View style={styles.separatorRow}>
                                        <Divider style={styles.separator} />
                                        <Text variant="labelSmall" style={[styles.separatorLabel, { color: theme.colors.onSurfaceVariant }]}>
                                            or
                                        </Text>
                                        <Divider style={styles.separator} />
                                    </View>

                                    <AppButton
                                        mode="contained"
                                        icon="phone"
                                        onPress={() => setPhoneMode(true)}
                                        disabled={isBusy}
                                        contentStyle={styles.primaryButtonContent}
                                    >
                                        {AUTH_TEXT.login.signInWithPhoneButton}
                                    </AppButton>
                                </>
                            )}

                            {isBusy && <ActivityIndicator style={styles.loadingIndicator} />}
                            </AppCard>
                        </MotionView>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </ScreenWrapper>
    );
};

const ResendTimer = ({ onResend, disabled = false }: { onResend: () => void; disabled?: boolean }) => {
    const [seconds, setSeconds] = useState(30);
    const theme = useTheme();

    useEffect(() => {
        if (seconds > 0) {
            const timer = setTimeout(() => setSeconds(seconds - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [seconds]);

    if (seconds > 0) {
        return (
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Resend in {seconds}s
            </Text>
        );
    }

    return (
        <AppButton
            mode="text"
            onPress={() => {
                setSeconds(30);
                onResend();
            }}
            disabled={disabled}
        >
            Resend Code
        </AppButton>
    );
};

const createStyles = (theme: MD3Theme) =>
    StyleSheet.create({
        container: {
            flex: 1,
        },
        keyboard: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            paddingVertical: DesignSystem.layout.pageTop,
            alignItems: 'center',
        },
        contentInner: {
            width: '100%',
        },
        contentInnerWide: {
            maxWidth: DesignSystem.layout.compactMaxWidth,
        },
        heroPanel: {
            marginBottom: DesignSystem.spacing.xs,
        },
        brandRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        brandTextWrap: {
            flex: 1,
            marginLeft: DesignSystem.spacing.sm,
        },
        brandLabel: {
            fontWeight: '700',
            letterSpacing: 0.4,
        },
        logoFrame: {
            width: 72,
            height: 72,
            borderRadius: 22,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: theme.colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.16,
            shadowRadius: 18,
            elevation: 4,
        },
        logo: {
            width: 52,
            height: 52,
            borderRadius: 14,
        },
        title: {
            fontWeight: '700',
        },
        subtitle: {
            marginTop: DesignSystem.spacing.xs,
        },
        capabilityRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: DesignSystem.spacing.sm,
            gap: DesignSystem.spacing.xs,
        },
        capabilityBadge: {
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: DesignSystem.spacing.sm,
            paddingVertical: 5,
        },
        authCard: {
            marginBottom: DesignSystem.spacing.xs,
        },
        modeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: DesignSystem.spacing.sm,
            gap: DesignSystem.spacing.xs,
        },
        modeChip: {
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: DesignSystem.spacing.sm,
            paddingVertical: 5,
        },
        stepBadge: {
            alignSelf: 'flex-start',
            borderRadius: 999,
            paddingHorizontal: DesignSystem.spacing.sm,
            paddingVertical: 4,
            marginBottom: DesignSystem.spacing.sm,
        },
        primaryButtonContent: {
            minHeight: 48,
        },
        separatorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: DesignSystem.spacing.sm,
        },
        separator: {
            flex: 1,
        },
        separatorLabel: {
            marginHorizontal: DesignSystem.spacing.sm,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        footerRow: {
            marginTop: DesignSystem.spacing.sm,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: 36,
        },
        loadingIndicator: {
            marginTop: DesignSystem.spacing.sm,
        },
    });
