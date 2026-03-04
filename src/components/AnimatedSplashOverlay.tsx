import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

type AnimatedSplashOverlayProps = {
    ready: boolean;
    backgroundColor?: string;
};

/**
 * Keeps a solid splash overlay visible while bootstrapping.
 * Fade-out only begins after the app is actually ready.
 */
export default function AnimatedSplashOverlay({
    ready,
    backgroundColor = '#007B83',
}: AnimatedSplashOverlayProps) {
    const opacity = useRef(new Animated.Value(1)).current;
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (!ready) {
            opacity.setValue(1);
            setVisible(true);
            return;
        }

        const timer = setTimeout(() => {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 320,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) {
                    setVisible(false);
                }
            });
        }, 120);

        return () => clearTimeout(timer);
    }, [opacity, ready]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[styles.overlay, { opacity, backgroundColor }]}
            pointerEvents="none"
        />
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
    },
});
