import React, { useEffect, useRef, useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { ActivityIndicator, Divider, Text, useTheme, type MD3Theme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AUTH_TEXT, COMMON_TEXT } from '../../constants/staticText';
import { useAuth } from '../../hooks/useAuth';
import {
    configureNativeGoogleSignIn,
    getNativeGoogleErrorMessage,
    signInWithNativeGoogle,
} from '../../utils/googleNativeSignIn';
import { useWebGoogleAuth } from '../../utils/googleWebAuth';
import { useAppDialog } from '../../components/providers/DialogProvider';

export const LoginScreen = () => {
    const { signInWithGoogle, sendPhoneVerification, confirmPhoneVerification, loading: authLoading } = useAuth();
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

    const normalizePhoneNumber = (value: string) => {
        const digits = value.replace(/\D/g, '');
        if (!digits) return '';
        return `+${digits}`;
    };

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
                    console.log('Starting Native Google Sign-In...');
                    const result = await signInWithNativeGoogle();
                    console.log('Native Google Sign-In Success:', result ? 'Token received' : 'No result');
                    idToken = result.idToken;
                } catch (error: unknown) {
                    console.error('Native Google Sign-In Failed:', error);
                    dialog.alert(AUTH_TEXT.login.loginErrorTitle, getNativeGoogleErrorMessage(error));
                    setLoading(false);
                    googleSignInInFlightRef.current = false;
                    return;
                }

                try {
                    console.log('Starting API Sign-In with Google Token...');
                    const user = await signInWithGoogle(idToken);
                    console.log('API Sign-In Success', user);

                    // Unified Auth: If user doesn't have a phone number, prompt for it
                    if (!user.phoneNumber) {
                        dialog.alert(
                            'Add Phone Number',
                            'Please link your phone number to complete your profile.',
                            [{ text: 'OK', onPress: () => setPhoneMode(true) }]
                        );
                    }
                } catch (error: unknown) {
                    console.error('API Google Sign-In Failed:', error);
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
            const formattedPhone = normalizePhoneNumber(phoneNumber);
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
                <View style={[styles.orbTop, { backgroundColor: theme.colors.primaryContainer }]} pointerEvents="none" />
                <View style={[styles.orbBottom, { backgroundColor: theme.colors.secondaryContainer }]} pointerEvents="none" />

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.logoContainer}>
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
                            <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
                                {AUTH_TEXT.login.title}
                            </Text>
                            <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                                {AUTH_TEXT.login.subtitle}
                            </Text>
                        </View>

                        <View
                            style={[
                                styles.authCard,
                                {
                                    backgroundColor: theme.dark ? 'rgba(17,26,45,0.82)' : 'rgba(255,255,255,0.8)',
                                    borderColor: theme.dark ? 'rgba(148,163,184,0.18)' : 'rgba(30,41,59,0.14)',
                                },
                            ]}
                        >
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
                                            <AppInput
                                                label={AUTH_TEXT.login.phoneNumberLabel}
                                                value={phoneNumber}
                                                onChangeText={setPhoneNumber}
                                                keyboardType="phone-pad"
                                                autoComplete="tel"
                                                placeholder="+1 555 123 4567"
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
                                            <AppInput
                                                label={AUTH_TEXT.login.verificationCodeLabel}
                                                value={verificationCode}
                                                onChangeText={(text) => setVerificationCode(text.replace(/\D/g, '').slice(0, 6))}
                                                keyboardType="number-pad"
                                                autoComplete="one-time-code"
                                                textContentType="oneTimeCode"
                                                placeholder="123456"
                                                maxLength={6}
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
            paddingVertical: 24,
        },
        orbTop: {
            position: 'absolute',
            top: -120,
            right: -80,
            width: 240,
            height: 240,
            borderRadius: 120,
            opacity: 0.45,
        },
        orbBottom: {
            position: 'absolute',
            bottom: -140,
            left: -90,
            width: 260,
            height: 260,
            borderRadius: 130,
            opacity: 0.3,
        },
        logoContainer: {
            alignItems: 'center',
            marginBottom: 22,
        },
        logoFrame: {
            width: 96,
            height: 96,
            borderRadius: 28,
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
            width: 72,
            height: 72,
            borderRadius: 18,
        },
        title: {
            marginTop: 14,
            fontWeight: '700',
        },
        subtitle: {
            marginTop: 6,
            textAlign: 'center',
            paddingHorizontal: 12,
        },
        authCard: {
            borderRadius: 24,
            borderWidth: 1,
            paddingHorizontal: 16,
            paddingVertical: 18,
            shadowColor: '#020617',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.14,
            shadowRadius: 24,
            elevation: 8,
        },
        stepBadge: {
            alignSelf: 'flex-start',
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
            marginBottom: 12,
        },
        primaryButtonContent: {
            minHeight: 48,
        },
        separatorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 12,
        },
        separator: {
            flex: 1,
        },
        separatorLabel: {
            marginHorizontal: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        footerRow: {
            marginTop: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: 36,
        },
        loadingIndicator: {
            marginTop: 14,
        },
    });
