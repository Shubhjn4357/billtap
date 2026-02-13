import * as Google from 'expo-auth-session/providers/google';

import * as WebBrowser from 'expo-web-browser';
import type { ApplicationVerifier } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

import { auth } from '../../api/firebaseConfig';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AUTH_TEXT, COMMON_TEXT } from '../../constants/staticText';
import { useAuth } from '../../hooks/useAuth';

WebBrowser.maybeCompleteAuthSession();

type WebRecaptchaVerifier = ApplicationVerifier & {
    render: () => Promise<number>;
    clear: () => void;
};

export const LoginScreen = () => {
    const { signInWithGoogle, sendPhoneVerification, confirmPhoneVerification, loading: authLoading } = useAuth();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [phoneMode, setPhoneMode] = useState(false);
    const [webRecaptchaReady, setWebRecaptchaReady] = useState(Platform.OS !== 'web');
    const [webRecaptchaError, setWebRecaptchaError] = useState<string | null>(null);
    const [webRecaptchaVerifier, setWebRecaptchaVerifier] = useState<WebRecaptchaVerifier | null>(null);

    const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID;
    const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

    const [googleRequest, googleResponse, promptAsync] = Google.useAuthRequest({
        webClientId: googleWebClientId,
        androidClientId: googleAndroidClientId,
        iosClientId: googleIosClientId,
    });

    const theme = useTheme();
    const phoneAuthSupported = Platform.OS !== 'web' || webRecaptchaReady;

    const googleConfigured = Platform.select({
        web: !!googleWebClientId,
        android: !!googleAndroidClientId,
        ios: !!googleIosClientId,
        default: false,
    });

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (typeof window === 'undefined') return;

        let mounted = true;
        let verifier: WebRecaptchaVerifier | null = null;

        const setupRecaptcha = async () => {
            try {
                const { RecaptchaVerifier } = await import('firebase/auth');
                verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    size: 'invisible',
                }) as unknown as WebRecaptchaVerifier;
                await verifier.render();

                if (!mounted) return;
                setWebRecaptchaVerifier(verifier);
                setWebRecaptchaReady(true);
                setWebRecaptchaError(null);
            } catch (error: unknown) {
                if (!mounted) return;
                setWebRecaptchaReady(false);
                setWebRecaptchaError(error instanceof Error ? error.message : AUTH_TEXT.login.recaptchaInitFailed);
            }
        };

        void setupRecaptcha();

        return () => {
            mounted = false;
            if (verifier) {
                verifier.clear();
            }
            setWebRecaptchaVerifier(null);
        };
    }, []);

    useEffect(() => {
        if (googleResponse?.type === 'success') {
            const { id_token } = googleResponse.params;
            signInWithGoogle(id_token).catch(e => Alert.alert(AUTH_TEXT.login.loginErrorTitle, e.message));
        }
    }, [googleResponse, signInWithGoogle]);

    const normalizePhoneNumber = (value: string) => {
        const digits = value.replace(/[^\d+]/g, '');
        if (digits.startsWith('+')) return digits;
        return `+${digits}`;
    };

    const handleGoogleSignIn = () => {
        if (!googleConfigured) {
            Alert.alert(
                AUTH_TEXT.login.googleSignInNotConfiguredTitle,
                AUTH_TEXT.login.googleSignInNotConfiguredBody
            );
            return;
        }
        promptAsync();
    };

    const handleSendVerification = async () => {
        if (!phoneAuthSupported) {
            Alert.alert(AUTH_TEXT.login.phoneNotSupportedTitle, AUTH_TEXT.login.phoneNotSupportedBody);
            return;
        }
        if (!phoneNumber) return Alert.alert(COMMON_TEXT.alerts.error, AUTH_TEXT.login.enterPhoneNumber);
        setLoading(true);
        try {
            const formattedPhone = normalizePhoneNumber(phoneNumber);
            const vid = await sendPhoneVerification(formattedPhone, webRecaptchaVerifier ?? undefined);
            setVerificationId(vid);
            Alert.alert(COMMON_TEXT.alerts.success, AUTH_TEXT.login.otpSent);
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : AUTH_TEXT.login.unableToSendOtp);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmVerification = async () => {
        if (!verificationCode) return Alert.alert(COMMON_TEXT.alerts.error, AUTH_TEXT.login.enterCode);
        setLoading(true);
        try {
            await confirmPhoneVerification(verificationId, verificationCode);
            // Router redirect handled by layout auth listener or useAuth state
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : AUTH_TEXT.login.unableToVerifyCode);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper style={{ justifyContent: 'center' }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.form}>
                {Platform.OS === 'web' && (
                    <View>
                        <View nativeID="recaptcha-container" style={styles.recaptchaContainer} />
                        {webRecaptchaError && (
                            <Text variant="labelSmall" style={{ color: theme.colors.error, textAlign: 'center', marginBottom: 8 }}>
                                {webRecaptchaError}
                            </Text>
                        )}
                    </View>
                )}

                <View style={styles.logoContainer}>
                    <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
                    <Text variant="headlineLarge" style={{ color: theme.colors.primary, fontWeight: 'bold', marginTop: 16 }}>{AUTH_TEXT.login.title}</Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>{AUTH_TEXT.login.subtitle}</Text>
                </View>

                {phoneMode ? (
                    <>
                        {!verificationId ? (
                            <>
                                <AppInput
                                    label={AUTH_TEXT.login.phoneNumberLabel}
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                    keyboardType="phone-pad"
                                    autoComplete="tel"
                                />
                                <AppButton mode="contained" onPress={handleSendVerification} loading={loading}>
                                    {AUTH_TEXT.login.sendCodeButton}
                                </AppButton>
                            </>
                        ) : (
                            <>
                                <AppInput
                                    label={AUTH_TEXT.login.verificationCodeLabel}
                                    value={verificationCode}
                                    onChangeText={setVerificationCode}
                                    keyboardType="number-pad"
                                />
                                <AppButton mode="contained" onPress={handleConfirmVerification} loading={loading}>
                                    {AUTH_TEXT.login.verifyCodeButton}
                                </AppButton>
                            </>
                        )}
                        <AppButton mode="text" onPress={() => { setPhoneMode(false); setVerificationId(''); }}>
                            {COMMON_TEXT.actions.back}
                        </AppButton>
                    </>
                ) : (
                    <>
                        <AppButton 
                            mode="outlined" 
                            icon="google" 
                            onPress={handleGoogleSignIn}
                            disabled={!googleRequest || !googleConfigured}
                        >
                            {AUTH_TEXT.login.signInWithGoogleButton}
                        </AppButton>
                            <AppButton
                                mode="contained"
                                icon="phone"
                                style={{ marginTop: 12 }}
                                disabled={!phoneAuthSupported}
                                onPress={() => setPhoneMode(true)}
                        >
                            {AUTH_TEXT.login.signInWithPhoneButton}
                        </AppButton>
                    </>
                )}

                {(loading || authLoading) && <ActivityIndicator style={{ marginTop: 20 }} />}
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    form: { flex: 1, justifyContent: 'center' },
    recaptchaContainer: { width: 1, height: 1, opacity: 0 },
    logoContainer: { alignItems: 'center', marginBottom: 40 },
    logo: { width: 100, height: 100, borderRadius: 20 }
});
