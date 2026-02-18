import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { DesignSystem } from '../../constants/DesignSystem';

interface LoadingScreenProps {
    message?: string;
}

const LOADER_DURATION_MS = DesignSystem.motion.loader;
const LOADER_WIDTH = 80;
const LOADER_HEIGHT = 50;
const PILL_SIZE = 16;
const PILL_TRAVEL = LOADER_WIDTH - PILL_SIZE;

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading...' }) => {
    const theme = useTheme();
    const progress = useRef(new Animated.Value(0)).current;
    const palette = useMemo(() => ({
        text: theme.colors.primary,
        load: theme.dark ? theme.colors.secondary : theme.colors.primary,
        inner: theme.dark ? theme.colors.primaryContainer : theme.colors.secondaryContainer,
    }), [
        theme.colors.primary,
        theme.colors.primaryContainer,
        theme.colors.secondary,
        theme.colors.secondaryContainer,
        theme.dark,
    ]);

    useEffect(() => {
        progress.setValue(0);
        const loop = Animated.loop(
            Animated.timing(progress, {
                toValue: 1,
                duration: LOADER_DURATION_MS,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: false,
            })
        );
        loop.start();
        return () => {
            loop.stop();
        };
    }, [progress]);

    const textTranslateX = useMemo(() => progress.interpolate({
        inputRange: [0, 0.4, 0.8, 0.9, 1],
        outputRange: [0, 26, 32, 0, 0],
    }), [progress]);

    const textLetterSpacing = useMemo(() => progress.interpolate({
        inputRange: [0, 0.4, 0.8, 0.9, 1],
        outputRange: [1, 2, 1, 2, 1],
    }), [progress]);

    const loadWidth = useMemo(() => progress.interpolate({
        inputRange: [0, 0.4, 0.8, 0.9, 1],
        outputRange: [PILL_SIZE, LOADER_WIDTH, PILL_SIZE, LOADER_WIDTH, PILL_SIZE],
    }), [progress]);

    const loadTranslateX = useMemo(() => progress.interpolate({
        inputRange: [0, 0.4, 0.8, 0.9, 1],
        outputRange: [0, 0, PILL_TRAVEL, 0, 0],
    }), [progress]);

    const innerWidth = useMemo(() => progress.interpolate({
        inputRange: [0, 0.4, 0.8, 0.9, 1],
        outputRange: [PILL_SIZE, 64, 80, 64, PILL_SIZE],
    }), [progress]);

    const innerTranslateX = useMemo(() => progress.interpolate({
        inputRange: [0, 0.4, 0.8, 0.9, 1],
        outputRange: [0, 0, 0, 15, 0],
    }), [progress]);

    const helperMessage = useMemo(() => {
        const trimmed = message.trim();
        if (!trimmed) return null;
        if (trimmed.toLowerCase() === 'loading...' || trimmed.toLowerCase() === 'loading') return null;
        return trimmed;
    }, [message]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.loader}>
                <Animated.Text
                    style={[
                        styles.loaderText,
                        {
                            color: palette.text,
                            letterSpacing: textLetterSpacing,
                            transform: [{ translateX: textTranslateX }],
                        },
                    ]}
                >
                    loading
                </Animated.Text>

                <Animated.View
                    style={[
                        styles.load,
                        {
                            backgroundColor: palette.load,
                            width: loadWidth,
                            transform: [{ translateX: loadTranslateX }],
                        },
                    ]}
                >
                    <Animated.View
                        style={[
                            styles.loadInner,
                            {
                                backgroundColor: palette.inner,
                                width: innerWidth,
                                transform: [{ translateX: innerTranslateX }],
                            },
                        ]}
                    />
                </Animated.View>
            </View>
            {helperMessage ? (
                <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                    {helperMessage}
                </Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loader: {
        width: LOADER_WIDTH,
        height: LOADER_HEIGHT,
        position: 'relative',
    },
    loaderText: {
        position: 'absolute',
        top: 0,
        margin: 0,
        padding: 0,
        fontSize: 12,
        textTransform: 'lowercase',
    },
    load: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        height: PILL_SIZE,
        borderRadius: 50,
        overflow: 'hidden',
    },
    loadInner: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        borderRadius: 50,
    },
    message: {
        marginTop: 16,
        opacity: 0.92,
        fontSize: 13,
    },
});
