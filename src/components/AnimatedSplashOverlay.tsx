import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useIsAuthenticated } from '../store/authStore';

/**
 * Animated splash/fade overlay that shows on first mount.
 * Fades out once the auth state is known.
 */
export default function AnimatedSplashOverlay() {
    const opacity = useRef(new Animated.Value(1)).current;
    const isAuthenticated = useIsAuthenticated();

    useEffect(() => {
        // Give it a short delay then fade out
        const timer = setTimeout(() => {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }, 600);
        return () => clearTimeout(timer);
    }, [isAuthenticated, opacity]);

    return (
        <Animated.View
            style={[styles.overlay, { opacity }]}
            pointerEvents="none"
        />
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#007B83',
        zIndex: 999,
    },
});
