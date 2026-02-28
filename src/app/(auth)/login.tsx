// @ts-nocheck
import { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, Pressable, Image,
    useColorScheme, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/endpoints';
import { getColors, Spacing, Radius, Typography, type ColorPalette } from '../../constants/theme';
import { storeBusinessId } from '../../api/client';

const APP_LOGO = require('../../../assets/icon.png');

export default function LoginScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];
    const { setAuth, isAuthenticated } = useAuthStore();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/(main)');
        }
    }, [isAuthenticated]);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            // For now we handle the flow through expo-auth-session
            // The actual token exchange with Google SDK will be wired on device
            // Development: navigate directly if token available
            Alert.alert(
                'Connect your Google Account',
                'You will be redirected to sign in with Google.',
                [{ text: 'OK' }]
            );
        } catch (err) {
            Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Please try again.');
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
                    <Text style={s.tagline}>Minimal. Fast. GST-Ready billing for India.</Text>
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
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={s.googleIcon}>G</Text>
                                <Text style={s.googleBtnText}>Continue with Google</Text>
                            </>
                        )}
                    </Pressable>

                    <Text style={s.terms}>
                        By continuing you agree to our Terms of Service and Privacy Policy
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const FEATURES = [
    { icon: '🧾', text: 'GST compliant invoices in seconds' },
    { icon: '📦', text: 'Inventory tracking with low-stock alerts' },
    { icon: '📊', text: 'Profit & GSTR reports on the go' },
    { icon: '🔄', text: 'Sync across devices & the web' },
];

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, paddingBottom: Spacing.xl, justifyContent: 'space-between' },
    hero: { alignItems: 'center', marginTop: Spacing.xxl },
    logo: { width: 80, height: 80, borderRadius: Radius.lg, marginBottom: Spacing.md },
    appName: { fontSize: 36, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
    tagline: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
    features: { gap: Spacing.md, marginVertical: Spacing.xl },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    featureIcon: { fontSize: 22, width: 32 },
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
    googleIcon: { color: '#fff', fontWeight: '700', fontSize: 20 },
    googleBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
    terms: { textAlign: 'center', fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
});


