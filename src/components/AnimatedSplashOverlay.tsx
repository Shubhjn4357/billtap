import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { Colors, Radius, Spacing, Typography, withAlpha } from '../constants/theme';

type AnimatedSplashOverlayProps = {
    ready: boolean;
    backgroundColor?: string;
};

const BRAND_LOGO = require('../../assets/images/logo-glow.png');

/**
 * Branded startup overlay shown while bootstrapping.
 * Keeps logo visible and animated instead of a plain background.
 */
export default function AnimatedSplashOverlay({
    ready,
    backgroundColor = Colors.light.primary,
}: AnimatedSplashOverlayProps) {
    const opacity = useRef(new Animated.Value(1)).current;
    const logoScale = useRef(new Animated.Value(0.9)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const brandOpacity = useRef(new Animated.Value(0)).current;
    const shimmerProgress = useRef(new Animated.Value(0)).current;
    const [visible, setVisible] = useState(true);
    const [logoFailed, setLogoFailed] = useState(false);

    useEffect(() => {
        if (!ready) {
            opacity.setValue(1);
            logoScale.setValue(0.9);
            logoOpacity.setValue(0);
            brandOpacity.setValue(0);
            shimmerProgress.setValue(0);
            setVisible(true);

            Animated.parallel([
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 260,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.spring(logoScale, {
                    toValue: 1,
                    damping: 14,
                    stiffness: 180,
                    mass: 0.8,
                    useNativeDriver: true,
                }),
                Animated.timing(brandOpacity, {
                    toValue: 1,
                    duration: 320,
                    delay: 80,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();

            const pulseLoop = Animated.loop(
                Animated.sequence([
                    Animated.timing(logoScale, {
                        toValue: 1.04,
                        duration: 1100,
                        easing: Easing.inOut(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(logoScale, {
                        toValue: 1,
                        duration: 1100,
                        easing: Easing.inOut(Easing.quad),
                        useNativeDriver: true,
                    }),
                ])
            );
            const shimmerLoop = Animated.loop(
                Animated.timing(shimmerProgress, {
                    toValue: 1,
                    duration: 1800,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                })
            );

            pulseLoop.start();
            shimmerLoop.start();

            return () => {
                pulseLoop.stop();
                shimmerLoop.stop();
            };
        }

        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 360,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(brandOpacity, {
                    toValue: 0,
                    duration: 240,
                    useNativeDriver: true,
                }),
            ]).start(({ finished }) => {
                if (finished) {
                    setVisible(false);
                }
            });
        }, 120);

        return () => clearTimeout(timer);
    }, [brandOpacity, logoOpacity, logoScale, opacity, ready, shimmerProgress]);

    if (!visible) return null;

    const shimmerTranslateX = shimmerProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [-120, 120],
    });

    return (
        <Animated.View
            style={[styles.overlay, { opacity, backgroundColor }]}
            pointerEvents="none"
        >
            <View style={styles.content}>
                <View style={styles.orbTop} />
                <View style={styles.orbBottom} />

                <Animated.View
                    style={[
                        styles.logoWrap,
                        {
                            opacity: logoOpacity,
                            transform: [{ scale: logoScale }],
                        },
                    ]}
                >
                    {!logoFailed ? (
                        <Image
                            source={BRAND_LOGO}
                            style={styles.logo}
                            resizeMode="contain"
                            onError={() => setLogoFailed(true)}
                        />
                    ) : (
                        <View style={styles.logoFallback}>
                            <Animated.Text style={[styles.logoFallbackText, { opacity: brandOpacity }]}>
                                V
                            </Animated.Text>
                        </View>
                    )}
                </Animated.View>

                <Animated.Text style={[styles.brand, { opacity: brandOpacity }]}>
                    VAHI
                </Animated.Text>
                <Animated.Text style={[styles.tagline, { opacity: brandOpacity }]}>
                    Smart Billing, GST and Inventory
                </Animated.Text>

                <View style={styles.shimmerTrack}>
                    <Animated.View
                        style={[
                            styles.shimmer,
                            { transform: [{ translateX: shimmerTranslateX }] },
                        ]}
                    />
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFill,
        zIndex: 999,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        overflow: 'hidden',
    },
    orbTop: {
        position: 'absolute',
        top: -120,
        right: -70,
        width: 260,
        height: 260,
        borderRadius: 260,
        backgroundColor: withAlpha('#ffffff', '18'),
    },
    orbBottom: {
        position: 'absolute',
        bottom: -120,
        left: -90,
        width: 280,
        height: 280,
        borderRadius: 280,
        backgroundColor: withAlpha('#ffffff', '14'),
    },
    logoWrap: {
        width: 152,
        height: 152,
        borderRadius: 76,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    logo: {
        width: 148,
        height: 148,
    },
    logoFallback: {
        width: 112,
        height: 112,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha('#ffffff', '22'),
        borderWidth: 1,
        borderColor: withAlpha('#ffffff', '54'),
    },
    logoFallbackText: {
        color: '#ffffff',
        fontSize: 52,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    brand: {
        color: '#ffffff',
        fontSize: Typography.headline.size,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    tagline: {
        marginTop: 2,
        color: withAlpha('#ffffff', 'D9'),
        fontSize: Typography.caption.size,
        fontWeight: '600',
        textAlign: 'center',
    },
    shimmerTrack: {
        marginTop: Spacing.md,
        width: 120,
        height: 3,
        borderRadius: Radius.pill,
        overflow: 'hidden',
        backgroundColor: withAlpha('#ffffff', '2E'),
    },
    shimmer: {
        width: 46,
        height: 3,
        borderRadius: Radius.pill,
        backgroundColor: '#ffffff',
    },
});
