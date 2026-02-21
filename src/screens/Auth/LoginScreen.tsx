import React, { useEffect, useRef, useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
    useWindowDimensions,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotionView } from '../../components/motion/Motion';
import { ActivityIndicator, Divider, Text, useTheme, type MD3Theme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { OtpInput } from '../../components/forms/OtpInput';
import { PhoneNumberInput } from '../../components/forms/PhoneNumberInput';
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

const FEATURE_BADGES = [
    { icon: '🧾', label: 'GST + Estimate' },
    { icon: '📡', label: 'Offline Safe' },
    { icon: '🏪', label: 'Multi-Store' },
    { icon: '📊', label: 'Analytics' },
] as const;

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

    // Animated card slide-up
    const cardSlide = useRef(new Animated.Value(60)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(cardSlide, {
                toValue: 0,
                useNativeDriver: true,
                tension: 60,
                friction: 10,
                delay: 200,
            }),
            Animated.timing(cardOpacity, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
                delay: 200,
            }),
        ]).start();
    }, [cardSlide, cardOpacity]);

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
            {/* Full-screen gradient hero background */}
            <LinearGradient
                colors={['#1a0533', '#2d1065', '#0f2a6b']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.gradientBackground}
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero Section */}
                    <MotionView
                        from={{ opacity: 0, translateY: -20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 500 }}
                        style={styles.heroSection}
                    >
                        <View style={styles.logoWrapper}>
                            <Image
                                source={require('../../../assets/images/icon.png')}
                                style={styles.logoImage}
                            />
                        </View>
                        <Text variant="displaySmall" style={styles.heroTitle}>Vahi</Text>
                        <Text variant="bodyMedium" style={styles.heroSubtitle}>
                            Smart Billing & Business Suite
                        </Text>
                        <View style={styles.badgeRow}>
                            {FEATURE_BADGES.map((b) => (
                                <View key={b.label} style={styles.badge}>
                                    <Text style={styles.badgeText}>{b.icon} {b.label}</Text>
                                </View>
                            ))}
                        </View>
                    </MotionView>

                    {/* Auth Card */}
                    <Animated.View
                        style={[
                            styles.authCard,
                            {
                                transform: [{ translateY: cardSlide }],
                                opacity: cardOpacity,
                            },
                        ]}
                    >
                        <View style={[styles.authCardInner, isWide && styles.authCardWide]}>
                            {!phoneMode ? (
                                /* ── Method Selection ── */
                                <>
                                    <Text variant="titleLarge" style={styles.cardTitle}>Sign in to continue</Text>
                                    <Text variant="bodySmall" style={styles.cardSubtitle}>
                                        Choose your preferred sign-in method
                                    </Text>

                                    <AppButton
                                        mode="contained"
                                        icon="google"
                                        onPress={handleGoogleSignIn}
                                        disabled={googleButtonDisabled}
                                        contentStyle={styles.buttonContent}
                                        style={styles.googleButton}
                                    >
                                        Continue with Google
                                    </AppButton>

                                    <View style={styles.separatorRow}>
                                        <Divider style={styles.separator} />
                                        <Text variant="labelSmall" style={styles.separatorLabel}>OR</Text>
                                        <Divider style={styles.separator} />
                                    </View>

                                    <AppButton
                                        mode="outlined"
                                        icon="phone"
                                        onPress={() => setPhoneMode(true)}
                                        disabled={isBusy}
                                        contentStyle={styles.buttonContent}
                                        style={styles.phoneButton}
                                    >
                                        Continue with Phone
                                    </AppButton>

                                    {isBusy && <ActivityIndicator style={styles.loadingIndicator} />}
                                </>
                            ) : (
                                /* ── Phone OTP Flow ── */
                                <>
                                    {/* Step indicator */}
                                    <View style={styles.stepRow}>
                                        <View style={[styles.stepDot, styles.stepDotActive]} />
                                        <View style={[styles.stepLine, isOtpStep && styles.stepLineActive]} />
                                        <View style={[styles.stepDot, isOtpStep && styles.stepDotActive]} />
                                    </View>
                                    <Text variant="labelSmall" style={styles.stepLabel}>
                                        {isOtpStep ? 'Step 2 of 2 — Enter OTP' : 'Step 1 of 2 — Enter Phone'}
                                    </Text>

                                        <MotionView
                                            key={isOtpStep ? 'otp' : 'phone'}
                                            from={{ opacity: 0, translateX: isOtpStep ? 30 : -30 }}
                                            animate={{ opacity: 1, translateX: 0 }}
                                            transition={{ type: 'timing', duration: 260 }}
                                        >
                                            <Text variant="titleLarge" style={styles.cardTitle}>
                                                {isOtpStep ? 'Enter verification code' : 'Enter your phone number'}
                                            </Text>
                                            <Text variant="bodySmall" style={styles.cardSubtitle}>
                                                {isOtpStep
                                                    ? 'We sent a 6-digit code to your number.'
                                                    : 'We\'ll send a one-time code via SMS.'}
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
                                                        disabled={isBusy || phoneNumber.length < 6}
                                                        contentStyle={styles.buttonContent}
                                                        style={styles.googleButton}
                                                    >
                                                        Send Code
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
                                                            contentStyle={styles.buttonContent}
                                                            style={styles.googleButton}
                                                        >
                                                        Verify & Sign In
                                                    </AppButton>
                                                </>
                                            )}

                                            <View style={styles.footerRow}>
                                                <AppButton
                                                    mode="text"
                                                    onPress={handleBackToMethodSelection}
                                                    disabled={isBusy}
                                                >
                                                    ← Back
                                                </AppButton>
                                                {isOtpStep && (
                                                    <ResendTimer onResend={handleSendVerification} disabled={isBusy} />
                                                )}
                                            </View>
                                        </MotionView>

                                        {isBusy && <ActivityIndicator style={styles.loadingIndicator} />}
                                </>
                            )}

                            <Text variant="labelSmall" style={styles.legalText}>
                                By continuing, you agree to our Terms of Service and Privacy Policy.
                            </Text>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        gradientBackground: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        },
        keyboard: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'flex-end',
        },

        // Hero
        heroSection: {
            alignItems: 'center',
            paddingTop: 48,
            paddingBottom: DesignSystem.spacing.xl,
            paddingHorizontal: DesignSystem.spacing.xl,
            flex: 1,
            justifyContent: 'center',
        },
        logoWrapper: {
            width: 80,
            height: 80,
            borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.25)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: DesignSystem.spacing.md,
            shadowColor: '#a78bfa',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.5,
            shadowRadius: 20,
            elevation: 10,
        },
        logoImage: {
            width: 56,
            height: 56,
            borderRadius: 14,
        },
        heroTitle: {
            color: '#ffffff',
            fontWeight: '800',
            letterSpacing: 1,
            marginBottom: 4,
        },
        heroSubtitle: {
            color: 'rgba(255,255,255,0.65)',
            marginBottom: DesignSystem.spacing.md,
            textAlign: 'center',
        },
        badgeRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: DesignSystem.spacing.xs,
            justifyContent: 'center',
        },
        badge: {
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
            paddingHorizontal: 10,
            paddingVertical: 5,
        },
        badgeText: {
            color: 'rgba(255,255,255,0.85)',
            fontSize: 12,
            fontWeight: '500',
        },

        // Auth card
        authCard: {
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingTop: DesignSystem.spacing.xl,
            paddingBottom: DesignSystem.spacing.xl,
            paddingHorizontal: DesignSystem.spacing.xl,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 12,
        },
        authCardInner: {
            width: '100%',
        },
        authCardWide: {
            maxWidth: 420,
            alignSelf: 'center',
        },

        // Typography
        cardTitle: {
            fontWeight: '700',
            color: theme.colors.onSurface,
            marginBottom: 4,
        },
        cardSubtitle: {
            color: theme.colors.onSurfaceVariant,
            marginBottom: DesignSystem.spacing.lg,
        },

        // Buttons
        buttonContent: {
            minHeight: 52,
        },
        googleButton: {
            marginBottom: DesignSystem.spacing.sm,
        },
        phoneButton: {
            borderColor: theme.colors.outline,
        },

        // Separator
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
            color: theme.colors.onSurfaceVariant,
            letterSpacing: 1,
        },

        // Step indicator
        stepRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: DesignSystem.spacing.xs,
        },
        stepDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: theme.colors.surfaceVariant,
        },
        stepDotActive: {
            backgroundColor: theme.colors.primary,
        },
        stepLine: {
            flex: 1,
            height: 2,
            backgroundColor: theme.colors.surfaceVariant,
            marginHorizontal: 4,
        },
        stepLineActive: {
            backgroundColor: theme.colors.primary,
        },
        stepLabel: {
            color: theme.colors.onSurfaceVariant,
            marginBottom: DesignSystem.spacing.md,
        },

        // Footer
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
        legalText: {
            color: theme.colors.outline,
            textAlign: 'center',
            marginTop: DesignSystem.spacing.lg,
        },
    });
