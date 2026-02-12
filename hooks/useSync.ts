import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from 'react-native-paper';

export const useSync = () => {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!(state.isConnected && state.isInternetReachable));
        });
        return () => unsubscribe();
    }, []);

    return { isOffline };
};
