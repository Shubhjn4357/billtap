import React, { useRef, useEffect } from 'react';
import { RefreshControl, RefreshControlProps } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTheme } from 'react-native-paper';
import AppAnimation from "@/assets/animations/moneytransfer.json";
export interface AppRefreshControlProps extends Omit<RefreshControlProps, 'refreshing'> {
    refreshing: boolean;
    onRefresh: () => void | Promise<void>;
}

export const AppRefreshControl = ({ refreshing, onRefresh, ...props }: AppRefreshControlProps) => {
    const animationRef = useRef<LottieView>(null);
    const theme = useTheme();

    useEffect(() => {
        if (refreshing) {
            animationRef.current?.play();
        } else {
            animationRef.current?.reset();
        }
    }, [refreshing]);

    return (
        <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['transparent']}
            style={{ backgroundColor: 'transparent' }}
            {...props}
        >
            {refreshing && (
                <LottieView
                    ref={animationRef}
                    // Users drop their downloaded json here in assets/pull-to-refresh.json
                    source={AppAnimation} // Fallback until actual lottie json is added by user
                    autoPlay
                    loop
                    style={{ width: 60, height: 60, alignSelf: 'center', marginTop: 10 }}
                />
            )}
        </RefreshControl>
    );
};
