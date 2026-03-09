import { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { authRepository } from '../../repositories/authRepository';
import {
    configureNativeGoogleSignIn,
    getNativeGoogleErrorMessage,
    signInWithNativeGoogle,
} from '../../utils/googleNativeSignIn';
import { getApiBaseUrl, toUserMessage } from '../../api/client';
import { LOGIN_FEATURES } from '../../constants/appShellOptions';
import { Spacing, Radius, Typography, withAlpha, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { AuthChip, AuthHero, AuthPanel } from '../../components/ui/AuthBlocks';

const APP_LOGO = require('../../../assets/images/icon.png');

export default function LoginScreen() {
    const colors = useAppColors();
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

        const response = await authRepository.googleSignIn({ idToken, platform });
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
                <AuthHero
                    eyebrow="Offline-first billing"
                    title="Run Vahi from anywhere"
                    subtitle="Sales, stock, GST, and accounting stay available even when the network does not."
                    icon="storefront-outline"
                >
                    <AuthChip icon="shield-check-outline" label="Business scoped" />
                    <AuthChip icon="cloud-sync-outline" label="Silent sync" />
                    <AuthChip icon="file-percent-outline" label="GST ready" />
                </AuthHero>

                <View style={s.brandCard}>
                    <View style={[s.logoFrame, { backgroundColor: withAlpha(colors.primary, '10') }]}>
                        <Image source={APP_LOGO} style={s.logo} resizeMode="contain" />
                    </View>
                    <Text style={s.appName}>Vahi</Text>
                    <Text style={s.tagline}>Minimal. Fast. GST-ready billing for India.</Text>
                </View>

                <AuthPanel
                    title="What you get"
                    description="The app is optimized for quick invoice entry, connected inventory, and stable offline workflow."
                >
                    <View style={s.features}>
                        {LOGIN_FEATURES.map((f) => (
                            <View key={f.text} style={s.featureRow}>
                                <View style={[s.featureIconWrap, { backgroundColor: withAlpha(colors.primary, '10') }]}>
                                    <MaterialCommunityIcons name={f.icon} size={18} color={colors.primary} />
                                </View>
                                <Text style={s.featureText}>{f.text}</Text>
                            </View>
                        ))}
                    </View>
                </AuthPanel>

                <AuthPanel
                    title="Continue"
                    description="Google sign-in restores your organizations, permissions, and local offline scope."
                >
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
                </AuthPanel>
            </View>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        container: {
            flex: 1,
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.lg,
            paddingBottom: Spacing.xl,
            gap: Spacing.md,
        },
        brandCard: {
            alignItems: 'center',
            backgroundColor: colors.card,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, '14'),
            paddingVertical: Spacing.lg,
            paddingHorizontal: Spacing.md,
            shadowColor: colors.text,
            shadowOpacity: 0.04,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
        },
        logoFrame: {
            width: 84,
            height: 84,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: Spacing.md,
        },
        logo: { width: 64, height: 64, borderRadius: Radius.lg },
        appName: { fontSize: 34, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
        tagline: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
        features: { gap: Spacing.sm },
        featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
        featureIconWrap: {
            width: 36,
            height: 36,
            borderRadius: Radius.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        featureText: { fontSize: Typography.body.size, color: colors.text, flex: 1, lineHeight: 20 },
        googleBtn: {
            backgroundColor: colors.primary,
            borderRadius: Radius.pill,
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
            shadowColor: colors.primary,
            shadowOpacity: 0.18,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
        },
        googleBtnPressed: { opacity: 0.85 },
        googleIcon: { color: colors.onPrimary, fontWeight: '700', fontSize: 20 },
        googleBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: 16 },
        terms: { textAlign: 'center', fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
        termsLinksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs },
        termsLink: { fontSize: 12, fontWeight: '700', color: colors.primary },
        termsAnd: { fontSize: 11, color: colors.textSecondary },
    });
