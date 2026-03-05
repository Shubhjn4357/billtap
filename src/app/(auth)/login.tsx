import { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image,
    useColorScheme,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/endpoints';
import {
    configureNativeGoogleSignIn,
    getNativeGoogleErrorMessage,
    signInWithNativeGoogle,
} from '../../utils/googleNativeSignIn';
import { getApiBaseUrl, toUserMessage } from '../../api/client';
import { getColors, Spacing, Radius, Typography, type ColorPalette } from '../../constants/theme';
import { useAppDialog } from '../../components/providers/DialogProvider';

const APP_LOGO = require('../../../assets/images/icon.png');

export default function LoginScreen() {
    const scheme = useColorScheme();
    const colors = getColors(scheme === 'dark' ? 'dark' : 'light');
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const setAuth = useAuthStore((state) => state.setAuth);

    const [loading, setLoading] = useState(false);
    const [nativeConfigured, setNativeConfigured] = useState(false);
    const dialog = useAppDialog();

    const googleConfig = useMemo(
        () => ({
            webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
            androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
            iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        }),
        []
    );

    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/(auth)/business-select');
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            setNativeConfigured(false);
            return;
        }

        let active = true;
        (async () => {
            try {
                await configureNativeGoogleSignIn(googleConfig);
                if (active) setNativeConfigured(true);
            } catch {
                if (active) setNativeConfigured(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [googleConfig]);

    const exchangeIdToken = async (idToken: string) => {
        const platform: 'ANDROID' | 'IOS' | 'WEB' =
            Platform.OS === 'android' ? 'ANDROID' : Platform.OS === 'ios' ? 'IOS' : 'WEB';

        const response = await authApi.googleSignIn({ idToken, platform });
        if (!response.ok || !response.token) {
            throw new Error('Google sign-in failed on server.');
        }

        await setAuth(response);
    };

    const toReadableSignInError = (error: unknown): string => {
        const apiMessage = toUserMessage(error, '').trim();
        if (apiMessage.length > 0 && !apiMessage.toLowerCase().includes('error')) {
            return apiMessage;
        }
        const message = getNativeGoogleErrorMessage(error);
        if (message.toLowerCase().includes('network error')) {
            return `Cannot reach API at ${getApiBaseUrl()}. Check EXPO_PUBLIC_API_BASE_URL and internet/VPN/firewall.`;
        }
        return message;
    };

    const handleGoogleSignIn = async () => {
        if (Platform.OS === 'web') {
            dialog.alert(
                'Google Login in Native Build',
                'This login uses react-native-google-signin. Run Android/iOS build (dev client or release) to use it.'
            );
            return;
        }

        if (!nativeConfigured) {
            dialog.alert(
                'Google Sign-In Not Configured',
                'Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (required) and platform client IDs in your environment.'
            );
            return;
        }

        if (loading) return;

        setLoading(true);
        try {
            const result = await signInWithNativeGoogle();
            await exchangeIdToken(result.idToken);
        } catch (error) {
            dialog.alert('Sign in failed', toReadableSignInError(error));
        } finally {
            setLoading(false);
        }
    };

    const s = styles(colors);

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.container}>
                <View style={s.hero}>
                    <Image source={APP_LOGO} style={s.logo} resizeMode="contain" />
                    <Text style={s.appName}>Vahi</Text>
                    <Text style={s.tagline}>Minimal. Fast. GST-ready billing for India.</Text>
                </View>

                <View style={s.features}>
                    {FEATURES.map((f) => (
                        <View key={f.text} style={s.featureRow}>
                            <Text style={s.featureIcon}>{f.icon}</Text>
                            <Text style={s.featureText}>{f.text}</Text>
                        </View>
                    ))}
                </View>

                <View style={s.actions}>
                    <Pressable
                        style={({ pressed }) => [s.googleBtn, pressed && s.googleBtnPressed]}
                        onPress={handleGoogleSignIn}
                        disabled={loading}
                        accessibilityRole="button"
                        accessibilityLabel="Sign in with Google"
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.onPrimary} />
                        ) : (
                            <>
                                <Text style={s.googleIcon}>G</Text>
                                <Text style={s.googleBtnText}>Continue with Google</Text>
                            </>
                        )}
                    </Pressable>

                    <Text style={s.terms}>By continuing you agree to our</Text>
                    <View style={s.termsLinksRow}>
                        <Pressable onPress={() => router.push('/legal/terms')}>
                            <Text style={s.termsLink}>Terms of Service</Text>
                        </Pressable>
                        <Text style={s.termsAnd}>and</Text>
                        <Pressable onPress={() => router.push('/legal/privacy')}>
                            <Text style={s.termsLink}>Privacy Policy</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const FEATURES = [
    { icon: '*', text: 'GST compliant invoices in seconds' },
    { icon: '*', text: 'Inventory tracking with low-stock alerts' },
    { icon: '*', text: 'Profit and GST reports on the go' },
    { icon: '*', text: 'Sync across devices and web' },
];

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        container: {
            flex: 1,
            paddingHorizontal: Spacing.xl,
            paddingTop: Spacing.xxl,
            paddingBottom: Spacing.xl,
            justifyContent: 'space-between',
        },
        hero: { alignItems: 'center', marginTop: Spacing.xxl },
        logo: { width: 80, height: 80, borderRadius: Radius.lg, marginBottom: Spacing.md },
        appName: { fontSize: 36, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
        tagline: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
        features: { gap: Spacing.md, marginVertical: Spacing.xl },
        featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
        featureIcon: { fontSize: 22, width: 24, color: colors.primary },
        featureText: { fontSize: Typography.body.size, color: colors.text, flex: 1 },
        actions: { gap: Spacing.md },
        googleBtn: {
            backgroundColor: colors.primary,
            borderRadius: Radius.pill,
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
        },
        googleBtnPressed: { opacity: 0.85 },
        googleIcon: { color: colors.onPrimary, fontWeight: '700', fontSize: 20 },
        googleBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: 16 },
        terms: { textAlign: 'center', fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
        termsLinksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs },
        termsLink: { fontSize: 12, fontWeight: '700', color: colors.primary },
        termsAnd: { fontSize: 11, color: colors.textSecondary },
    });
