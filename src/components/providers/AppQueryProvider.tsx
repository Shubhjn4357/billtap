import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { appQueryClient } from '../../lib/queryClient';

let managersConfigured = false;

const configureManagers = () => {
    if (managersConfigured) return;
    managersConfigured = true;

    NetInfo.configure({
        // Web reachability probes are noisy and often produce false negatives in dev.
        reachabilityShouldRun: () => Platform.OS !== 'web',
        reachabilityRequestTimeout: 3000,
        reachabilityShortTimeout: 4000,
        reachabilityLongTimeout: 12_000,
    });

    onlineManager.setEventListener((setOnline) => {
        return NetInfo.addEventListener((state) => {
            const online = Platform.OS === 'web'
                ? state.isConnected !== false
                : Boolean(state.isConnected) && state.isInternetReachable !== false;
            setOnline(online);
        });
    });

    if (Platform.OS !== 'web') {
        focusManager.setEventListener((onFocus) => {
            const subscription = AppState.addEventListener('change', (status) => {
                onFocus(status === 'active');
            });

            return () => {
                subscription.remove();
            };
        });
    }
};

export const AppQueryProvider = ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
        configureManagers();
    }, []);

    return (
        <QueryClientProvider client={appQueryClient}>
            {children}
        </QueryClientProvider>
    );
};
