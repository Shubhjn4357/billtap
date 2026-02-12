import * as Google from 'expo-auth-session/providers/google';

import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

import { CustomRecaptchaModal, CustomRecaptchaModalRef } from '../../components/auth/CustomRecaptchaModal';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAuth } from '../../hooks/useAuth';

WebBrowser.maybeCompleteAuthSession();

export const LoginScreen = () => {
    const { signInWithGoogle, sendPhoneVerification, confirmPhoneVerification, loading: authLoading } = useAuth();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [phoneMode, setPhoneMode] = useState(false);

    const [googleRequest, googleResponse, promptAsync] = Google.useAuthRequest({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        // androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
        // iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    });

    const recaptchaVerifier = useRef<CustomRecaptchaModalRef>(null);
    const theme = useTheme();
    

    useEffect(() => {
        if (googleResponse?.type === 'success') {
            const { id_token } = googleResponse.params;
            signInWithGoogle(id_token).catch(e => Alert.alert('Login Error', e.message));
        }
    }, [googleResponse, signInWithGoogle]);

    const handleSendVerification = async () => {
        if (!phoneNumber) return Alert.alert('Error', 'Enter phone number');
        setLoading(true);
        try {
            // Attempt to use the verifier if available, otherwise pass undefined/null if user claims it's optional
            // Attempt to use the verifier if available, otherwise pass undefined/null if user claims it's optional
            const vid = await sendPhoneVerification(phoneNumber, recaptchaVerifier.current || undefined);
            setVerificationId(vid);
            Alert.alert('Success', 'OTP Sent');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmVerification = async () => {
        if (!verificationCode) return Alert.alert('Error', 'Enter code');
        setLoading(true);
        try {
            await confirmPhoneVerification(verificationId, verificationCode);
            // Router redirect handled by layout auth listener or useAuth state
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper style={{ justifyContent: 'center' }}>
            <CustomRecaptchaModal ref={recaptchaVerifier} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.form}>
                <View style={styles.logoContainer}>
                    <Image source={require('@/assets/icon.png')} style={styles.logo} />
                    <Text variant="headlineLarge" style={{ color: theme.colors.primary, fontWeight: 'bold', marginTop: 16 }}>BillTap</Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>Sign in to continue</Text>
                </View>

                {phoneMode ? (
                    <>
                        {!verificationId ? (
                            <>
                                <AppInput
                                    label="Phone Number"
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                    keyboardType="phone-pad"
                                    autoComplete="tel"
                                />
                                <AppButton mode="contained" onPress={handleSendVerification} loading={loading}>
                                    Send Code
                                </AppButton>
                            </>
                        ) : (
                            <>
                                <AppInput
                                    label="Verification Code"
                                    value={verificationCode}
                                    onChangeText={setVerificationCode}
                                    keyboardType="number-pad"
                                />
                                <AppButton mode="contained" onPress={handleConfirmVerification} loading={loading}>
                                    Verify Code
                                </AppButton>
                            </>
                        )}
                        <AppButton mode="text" onPress={() => { setPhoneMode(false); setVerificationId(''); }}>
                            Back
                        </AppButton>
                    </>
                ) : (
                    <>
                        <AppButton 
                            mode="outlined" 
                            icon="google" 
                            onPress={() => promptAsync()} 
                            disabled={!googleRequest}
                        >
                            Sign in with Google
                        </AppButton>
                            <AppButton
                                mode="contained"
                                icon="phone"
                            style={{ marginTop: 12 }}
                            onPress={() => setPhoneMode(true)}
                        >
                            Sign in with Phone
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
    logoContainer: { alignItems: 'center', marginBottom: 40 },
    logo: { width: 100, height: 100, borderRadius: 20 }
});
