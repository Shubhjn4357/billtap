
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSegments } from 'expo-router';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { offlineSyncService } from '../../api/offlineSyncService';
import { useNetworkStore } from '../../store';
import { getTabAwareBottomSpacing } from './tabBarMetrics';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    disableTabPadding?: boolean;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children, style, disableTabPadding = false }) => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const segments = useSegments() as string[];
    const { isConnected, isInternetReachable } = useNetworkStore();
    const isOffline = isConnected === false || isInternetReachable === false;
    const [queuedMutations, setQueuedMutations] = useState(0);
    const [showReconnected, setShowReconnected] = useState(false);
    const previousOfflineRef = useRef(isOffline);
    const horizontalPadding = width >= 900 ? 24 : 16;
    const constrainContent = width >= 1100;
    const insideTabs = segments.includes('(tabs)');
    const bottomSpacing = !disableTabPadding && insideTabs ? getTabAwareBottomSpacing(insets.bottom) : 0;

    useEffect(() => {
        let active = true;
        const syncQueueStats = async () => {
            try {
                const stats = await offlineSyncService.getQueueStats();
                if (active) {
                    setQueuedMutations(stats.pendingCount);
                }
            } catch {
                if (active) {
                    setQueuedMutations(0);
                }
            }
        };

        void syncQueueStats();
        const interval = setInterval(() => {
            void syncQueueStats();
        }, 8000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        const wasOffline = previousOfflineRef.current;
        previousOfflineRef.current = isOffline;

        if (wasOffline && !isOffline) {
            setShowReconnected(true);
            const timer = setTimeout(() => setShowReconnected(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isOffline]);

    const statusLabel = isOffline
        ? `Offline mode${queuedMutations > 0 ? ` · ${queuedMutations} queued` : ''}`
        : 'Back online. Sync resumed.';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
            <StatusBar 
                barStyle={theme.dark ? 'light-content' : 'dark-content'} 
                backgroundColor={theme.colors.background}
            />
            <View
                pointerEvents="none"
                style={[
                    styles.backgroundOrbTop,
                    { backgroundColor: theme.colors.primaryContainer, opacity: theme.dark ? 0.18 : 0.44 },
                ]}
            />
            <View
                pointerEvents="none"
                style={[
                    styles.backgroundOrbBottom,
                    { backgroundColor: theme.colors.secondaryContainer, opacity: theme.dark ? 0.16 : 0.4 },
                ]}
            />
            {(isOffline || showReconnected) && (
                <View
                    style={[
                        styles.statusPill,
                        {
                            top: insets.top + 8,
                            backgroundColor: isOffline ? theme.colors.errorContainer : theme.colors.primaryContainer,
                            borderColor: isOffline ? 'rgba(185,28,28,0.24)' : 'rgba(14,116,144,0.26)',
                        },
                    ]}
                >
                    <Text
                        variant="labelMedium"
                        style={{
                            color: isOffline ? theme.colors.onErrorContainer : theme.colors.onPrimaryContainer,
                            fontWeight: '700',
                        }}
                        numberOfLines={1}
                    >
                        {statusLabel}
                    </Text>
                </View>
            )}
            <View style={[styles.viewport, { paddingHorizontal: horizontalPadding, paddingBottom: bottomSpacing }]}>
                <View style={[styles.content, constrainContent && styles.contentConstrained]}>
                    {children}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backgroundOrbTop: {
        position: 'absolute',
        top: -84,
        right: -68,
        width: 240,
        height: 240,
        borderRadius: 120,
    },
    backgroundOrbBottom: {
        position: 'absolute',
        bottom: -120,
        left: -80,
        width: 280,
        height: 280,
        borderRadius: 140,
    },
    statusPill: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 20,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    viewport: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    contentConstrained: {
        width: '100%',
        maxWidth: 1120,
        alignSelf: 'center',
    },
});
